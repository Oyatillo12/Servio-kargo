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

import PgBoss from 'pg-boss';

import {
  NOTIFY_QUEUE,
  notifyDedupeKey,
  type NotifyJob,
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

/** Graceful shutdown for the producer/consumer process. */
export async function stopBoss(): Promise<void> {
  if (!bossPromise) return;
  const boss = await bossPromise;
  bossPromise = undefined;
  await boss.stop({ graceful: true });
}
