/**
 * pg-boss queue (CLAUDE.md tech stack: Postgres-backed job queue, no Redis).
 *
 * This module is the single owner of pg-boss so producer (web) and consumer
 * (bot) share one payload + dedupe rule (shape/constants come from
 * `@kargotrack/shared`). It runs against the same Postgres as Drizzle.
 *
 * Notifications (SPEC §4.2, §7.6, §8):
 *  - dedupe: the queue uses pg-boss `policy: 'short'`, so with a `singletonKey`
 *    of (track, status) only one *queued* job per key exists — a duplicate
 *    enqueue while the first is still pending returns null (§7.6). We
 *    deliberately avoid `singletonSeconds`: it debounces delivery to a
 *    throttle-slot boundary (up to the whole window), delaying legitimate
 *    notifications. Timely delivery wins.
 *  - retries: 5 attempts with exponential backoff.
 */

import { randomUUID } from 'node:crypto';

import PgBoss from 'pg-boss';

import {
  BROADCAST_QUEUE,
  BULK_CHUNK,
  NOTIFY_QUEUE,
  REMINDER_QUEUE,
  REMINDER_SWEEP_CRON,
  REMINDER_SWEEP_QUEUE,
  REMINDER_TZ,
  chunked,
  notifyDedupeKey,
  type BroadcastJob,
  type NotifyJob,
  type ReminderJob,
} from '@kargotrack/shared';

// SPEC §8: retry ×5 with exponential backoff.
const RETRY_LIMIT = 5;
const RETRY_BACKOFF = true;

/**
 * Jobs fetched per poll and handled concurrently (AUDIT.md T3/F3).
 *
 * Sending one message is ~1 DB read + a Telegram round trip; awaited one at a
 * time that caps the whole system at a few messages a second no matter what
 * the rate limiter allows. Handling a batch concurrently overlaps the waiting,
 * and the limiter (which books its slot synchronously) still spaces the actual
 * sends — so throughput rises to the Telegram ceiling instead of the latency
 * ceiling. 20 keeps the in-flight count comfortably under the Postgres pool
 * even with all three workers busy.
 */
const BATCH_SIZE = 20;

let bossPromise: Promise<PgBoss> | undefined;

/** Start (once) and return the shared pg-boss instance with the queue ensured. */
export function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error('DATABASE_URL is not set');
      const boss = new PgBoss(url);
      // pg-boss reports background/maintenance errors here — never let them throw.
      boss.on('error', (err) => {
        // eslint-disable-next-line no-console
        console.error('[pg-boss] background error', err);
      });
      await boss.start();
      // 'short' policy = at most one queued job per singletonKey (§7.6 dedupe).
      // createQueue is idempotent but won't change an existing queue's policy,
      // so updateQueue migrates one created before this policy was set.
      await boss.createQueue(NOTIFY_QUEUE, {
        name: NOTIFY_QUEUE,
        policy: 'short',
      });
      await boss.updateQueue(NOTIFY_QUEUE, {
        name: NOTIFY_QUEUE,
        policy: 'short',
      });
      // Reminders: 'short' so a `singletonKey` collapses duplicate queued jobs
      // (weekly dedupe, §7.7). Only the 'short' policy indexes singleton_key on
      // created jobs — under 'standard' the key is ignored — so manual reminders
      // must carry a *unique* key (see enqueueReminder) or they'd all collide on
      // the empty key.
      for (const name of [REMINDER_QUEUE, REMINDER_SWEEP_QUEUE]) {
        const policy = name === REMINDER_QUEUE ? 'short' : 'standard';
        await boss.createQueue(name, { name, policy });
        await boss.updateQueue(name, { name, policy });
      }
      // Broadcasts: 'standard' — one job per recipient, no dedupe (§7.11).
      await boss.createQueue(BROADCAST_QUEUE, {
        name: BROADCAST_QUEUE,
        policy: 'standard',
      });
      await boss.updateQueue(BROADCAST_QUEUE, {
        name: BROADCAST_QUEUE,
        policy: 'standard',
      });
      return boss;
    })().catch((err) => {
      // Allow a later call to retry a failed startup.
      bossPromise = undefined;
      throw err;
    });
  }
  return bossPromise;
}

/**
 * Enqueue a customer notification, collapsing a duplicate in-flight job for the
 * same (track, status) into the pending one (§7.6).
 */
export function enqueueNotification(job: NotifyJob): Promise<string | null> {
  return getBoss().then((boss) =>
    boss.send(NOTIFY_QUEUE, job, {
      singletonKey: notifyDedupeKey(job.trackId, job.status),
      retryLimit: RETRY_LIMIT,
      retryBackoff: RETRY_BACKOFF,
    }),
  );
}

/**
 * Enqueue a whole bulk status change (AUDIT.md T7). One `boss.send` per track
 * is one round trip per track: flipping a 2 500-track flight spent them all
 * with the admin's request hanging on it. `boss.insert` writes a chunk per
 * statement instead.
 *
 * Dedupe is preserved, unlike the broadcast fan-out: `insert` carries
 * `singletonKey` into the same column `send` uses, and its `ON CONFLICT DO
 * NOTHING` lands on NOTIFY_QUEUE's 'short'-policy unique index — so a job that
 * duplicates one still queued is dropped exactly as §7.6 requires. Two rows in
 * one chunk can't collide anyway: a bulk change lists each track once.
 *
 * Callers must invoke this only AFTER their transaction commits — pg-boss
 * writes through its own connection, so jobs sent mid-transaction would survive
 * a rollback and notify about rows that were never written.
 */
export async function enqueueNotifications(jobs: NotifyJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const boss = await getBoss();
  for (const chunk of chunked(jobs, BULK_CHUNK)) {
    await boss.insert(
      chunk.map((data) => ({
        name: NOTIFY_QUEUE,
        data,
        singletonKey: notifyDedupeKey(data.trackId, data.status),
        retryLimit: RETRY_LIMIT,
        retryBackoff: RETRY_BACKOFF,
      })),
    );
  }
}

/** Attempt metadata handed to the worker so it can log final failures. */
export interface JobMeta {
  id: string;
  retryCount: number;
  retryLimit: number;
}

/** A per-job handler; throwing asks pg-boss to retry that job with backoff. */
type JobHandler<T> = (job: T, meta: JobMeta) => Promise<void>;

/** `Error` doesn't survive JSON.stringify — keep the parts worth storing. */
function failurePayload(reason: unknown): Record<string, unknown> {
  return reason instanceof Error
    ? { message: reason.message, stack: reason.stack, name: reason.name }
    : { message: String(reason) };
}

/**
 * Run a fetched batch concurrently while keeping per-job failure isolation.
 *
 * This is the subtle part of batching. pg-boss treats the batch callback as
 * all-or-nothing: if it throws, `manager.watch` fails *every* job id in the
 * batch, so one unreachable chat would resend to the other 19 recipients on
 * retry. So instead of throwing, the jobs that failed are failed explicitly by
 * id — `fail()` applies the same retry/backoff a thrown error would — and the
 * callback returns normally. pg-boss then completes the batch, but its
 * completion SQL is guarded by `state = 'active'` and `fail()` has already
 * moved those rows out of that state, so the failures are not resurrected as
 * successes.
 */
async function runBatch<T>(
  boss: PgBoss,
  queue: string,
  jobs: PgBoss.JobWithMetadata<T>[],
  handler: JobHandler<T>,
): Promise<void> {
  const results = await Promise.allSettled(
    jobs.map((job) =>
      handler(job.data, {
        id: job.id,
        retryCount: job.retryCount,
        retryLimit: job.retryLimit,
      }),
    ),
  );

  const failures: Array<{ id: string; reason: unknown }> = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      failures.push({ id: jobs[i]!.id, reason: result.reason });
    }
  });
  if (failures.length === 0) return;

  // This must not reject. If it did, pg-boss would fail the WHOLE batch and
  // retry it — re-sending to the recipients that already received their
  // message. Losing one job's retry is the lesser harm, and it is logged.
  await Promise.all(
    failures.map(({ id, reason }) =>
      boss.fail(queue, id, failurePayload(reason)).catch((failErr) => {
        // eslint-disable-next-line no-console
        console.error(
          `[queue] ${queue}: could not mark job ${id} failed`,
          failErr,
          reason,
        );
      }),
    ),
  );
}

export type NotifyJobHandler = JobHandler<NotifyJob>;

/**
 * Register the notification worker. A batch is handled concurrently and each
 * job succeeds or retries on its own (see {@link runBatch}); the handler
 * applies Telegram rate limits and must re-throw on send failure so pg-boss
 * retries with backoff.
 */
export function workNotifications(handler: NotifyJobHandler): Promise<string> {
  return getBoss().then((boss) =>
    boss.work<NotifyJob>(
      NOTIFY_QUEUE,
      { batchSize: BATCH_SIZE, includeMetadata: true, pollingIntervalSeconds: 1 },
      (jobs) => runBatch(boss, NOTIFY_QUEUE, jobs, handler),
    ),
  );
}

// --- Debt reminders (SPEC §4.4, §7.7) --------------------------------------

/**
 * Enqueue a single debtor reminder. Weekly-sweep callers pass a
 * `singletonKey` of `weeklyReminderDedupeKey(customerId, dateKey)` so a re-run
 * of the same hourly tick can't double-message a debtor. Manual (admin-button)
 * callers omit it and get a unique key — an empty key would collapse every
 * keyless job under the 'short' policy, so a bulk "send to all" would enqueue
 * only one; a unique key also lets an admin deliberately re-send.
 */
export function enqueueReminder(
  job: ReminderJob,
  opts?: { singletonKey?: string },
): Promise<string | null> {
  const singletonKey =
    opts?.singletonKey ?? `reminder-manual:${job.customerId}:${randomUUID()}`;
  return getBoss().then((boss) =>
    boss.send(REMINDER_QUEUE, job, {
      singletonKey,
      retryLimit: RETRY_LIMIT,
      retryBackoff: RETRY_BACKOFF,
    }),
  );
}

export type ReminderJobHandler = JobHandler<ReminderJob>;

/** Register the per-customer reminder worker (mirrors {@link workNotifications}). */
export function workReminders(handler: ReminderJobHandler): Promise<string> {
  return getBoss().then((boss) =>
    boss.work<ReminderJob>(
      REMINDER_QUEUE,
      { batchSize: BATCH_SIZE, includeMetadata: true, pollingIntervalSeconds: 1 },
      (jobs) => runBatch(boss, REMINDER_QUEUE, jobs, handler),
    ),
  );
}

export type SweepHandler = () => Promise<void>;

/**
 * Register the hourly debtor-sweep worker. The scheduled tick (see
 * {@link scheduleReminderSweep}) fires jobs onto {@link REMINDER_SWEEP_QUEUE};
 * the handler decides which tenants are due this hour and fans out reminders.
 */
export function workReminderSweeps(handler: SweepHandler): Promise<string> {
  return getBoss().then((boss) =>
    boss.work(
      REMINDER_SWEEP_QUEUE,
      { batchSize: 1, pollingIntervalSeconds: 30 },
      async () => {
        await handler();
      },
    ),
  );
}

/**
 * Install the repeatable hourly sweep tick (idempotent — pg-boss upserts the
 * schedule by queue name). The worker projects "now" onto Asia/Tashkent, so the
 * cron only needs to fire hourly; `tz` keeps DST-free but explicit (§7.9).
 */
export function scheduleReminderSweep(): Promise<void> {
  return getBoss().then((boss) =>
    boss.schedule(REMINDER_SWEEP_QUEUE, REMINDER_SWEEP_CRON, undefined, {
      tz: REMINDER_TZ,
    }),
  );
}

// --- Broadcasts (SPEC §5.8, §7.11) -----------------------------------------

/**
 * Enqueue a whole broadcast fan-out (SPEC §7.11, AUDIT.md T3). One `boss.send`
 * per recipient is one round trip per recipient: a 3 000-customer broadcast
 * spent minutes just writing rows, with the admin's request hanging on it.
 * `boss.insert` writes a chunk per statement instead.
 *
 * No `singletonKey`: BROADCAST_QUEUE runs the 'standard' policy, where keys are
 * ignored, so every recipient's job is kept. (Under 'short' the opposite is
 * true and a keyless bulk insert would collapse the whole fan-out into one job
 * — see {@link enqueueReminder}.)
 */
export async function enqueueBroadcasts(jobs: BroadcastJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const boss = await getBoss();
  for (const chunk of chunked(jobs, BULK_CHUNK)) {
    await boss.insert(
      chunk.map((data) => ({
        name: BROADCAST_QUEUE,
        data,
        retryLimit: RETRY_LIMIT,
        retryBackoff: RETRY_BACKOFF,
      })),
    );
  }
}

export type BroadcastJobHandler = JobHandler<BroadcastJob>;

/** Register the per-customer broadcast worker (mirrors {@link workReminders}). */
export function workBroadcasts(handler: BroadcastJobHandler): Promise<string> {
  return getBoss().then((boss) =>
    boss.work<BroadcastJob>(
      BROADCAST_QUEUE,
      { batchSize: BATCH_SIZE, includeMetadata: true, pollingIntervalSeconds: 1 },
      (jobs) => runBatch(boss, BROADCAST_QUEUE, jobs, handler),
    ),
  );
}

/** Graceful shutdown for the producer/consumer process. */
export async function stopBoss(): Promise<void> {
  if (!bossPromise) return;
  const boss = await bossPromise;
  bossPromise = undefined;
  await boss.stop({ graceful: true });
}
