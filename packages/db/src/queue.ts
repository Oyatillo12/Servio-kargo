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
  NOTIFY_QUEUE,
  REMINDER_QUEUE,
  REMINDER_SWEEP_CRON,
  REMINDER_SWEEP_QUEUE,
  REMINDER_TZ,
  notifyDedupeKey,
  type BroadcastJob,
  type NotifyJob,
  type ReminderJob,
} from '@kargotrack/shared';

// SPEC §8: retry ×5 with exponential backoff.
const RETRY_LIMIT = 5;
const RETRY_BACKOFF = true;

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

/** Attempt metadata handed to the worker so it can log final failures. */
export interface JobMeta {
  id: string;
  retryCount: number;
  retryLimit: number;
}

export type NotifyJobHandler = (job: NotifyJob, meta: JobMeta) => Promise<void>;

/**
 * Register the notification worker. Processes one job at a time (batchSize 1) so
 * a failure retries just that job; the handler applies Telegram rate limits and
 * must re-throw on send failure so pg-boss retries with backoff.
 */
export function workNotifications(handler: NotifyJobHandler): Promise<string> {
  return getBoss().then((boss) =>
    boss.work<NotifyJob>(
      NOTIFY_QUEUE,
      { batchSize: 1, includeMetadata: true, pollingIntervalSeconds: 1 },
      async (jobs) => {
        for (const job of jobs) {
          await handler(job.data, {
            id: job.id,
            retryCount: job.retryCount,
            retryLimit: job.retryLimit,
          });
        }
      },
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

export type ReminderJobHandler = (
  job: ReminderJob,
  meta: JobMeta,
) => Promise<void>;

/** Register the per-customer reminder worker (mirrors {@link workNotifications}). */
export function workReminders(handler: ReminderJobHandler): Promise<string> {
  return getBoss().then((boss) =>
    boss.work<ReminderJob>(
      REMINDER_QUEUE,
      { batchSize: 1, includeMetadata: true, pollingIntervalSeconds: 1 },
      async (jobs) => {
        for (const job of jobs) {
          await handler(job.data, {
            id: job.id,
            retryCount: job.retryCount,
            retryLimit: job.retryLimit,
          });
        }
      },
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
 * Enqueue one broadcast delivery. No `singletonKey`: under the 'standard' policy
 * keys are ignored, so every recipient's job is kept (a broadcast fans out to
 * one job per customer, all through this throttled queue).
 */
export function enqueueBroadcast(job: BroadcastJob): Promise<string | null> {
  return getBoss().then((boss) =>
    boss.send(BROADCAST_QUEUE, job, {
      retryLimit: RETRY_LIMIT,
      retryBackoff: RETRY_BACKOFF,
    }),
  );
}

export type BroadcastJobHandler = (
  job: BroadcastJob,
  meta: JobMeta,
) => Promise<void>;

/** Register the per-customer broadcast worker (mirrors {@link workReminders}). */
export function workBroadcasts(handler: BroadcastJobHandler): Promise<string> {
  return getBoss().then((boss) =>
    boss.work<BroadcastJob>(
      BROADCAST_QUEUE,
      { batchSize: 1, includeMetadata: true, pollingIntervalSeconds: 1 },
      async (jobs) => {
        for (const job of jobs) {
          await handler(job.data, {
            id: job.id,
            retryCount: job.retryCount,
            retryLimit: job.retryLimit,
          });
        }
      },
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
