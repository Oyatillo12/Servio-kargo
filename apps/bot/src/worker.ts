/**
 * Notification worker (SPEC §4.2, §8, CLAUDE.md rule 3). Consumes pg-boss
 * `notify` jobs and sends each customer their status message via that tenant's
 * bot, respecting Telegram rate limits with pg-boss retry/backoff behind it.
 *
 * The job payload is minimal (tenant/track/customer/status); everything shown
 * is re-read fresh here so a message always reflects current data.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Api, GrammyError, InputFile } from 'grammy';

import {
  enqueueReminder,
  scheduleReminderSweep,
  workBroadcasts,
  workNotifications,
  workReminderSweeps,
  workReminders,
  workTicketDeliveries,
  type JobMeta,
} from '@kargotrack/db/queue';
import {
  computeDebtTiyin,
  formatKg,
  formatSom,
  statusNotification,
  STATUS_META,
  TICKET_CATEGORY_META,
  t,
  tashkentSchedule,
  weeklyReminderDedupeKey,
  type BroadcastJob,
  type NotifyJob,
  type ReminderJob,
  type TicketJob,
} from '@kargotrack/shared';

import { getConfig } from './config';
import { logger } from './logger';
import { captureError } from './sentry';
import {
  getNotifyContext,
  getSendContext,
  getTicketDeliveryContext,
  incrementBroadcastSent,
  insertMessageOutcome,
  listCustomerPayments,
  listCustomerTracks,
  listTenantDebtorIds,
  listTenants,
  listTrackPhotoPaths,
  pruneStaleSessions,
  SESSION_MAX_AGE_DAYS,
  type MessageOutcome,
} from './queries';
import { TelegramRateLimiter } from './rateLimiter';

/** One grammY Api per bot token (lighter than a full Bot for outbound sends). */
const apiByToken = new Map<string, Api>();
function apiFor(token: string): Api {
  let api = apiByToken.get(token);
  if (!api) {
    api = new Api(token);
    apiByToken.set(token, api);
  }
  return api;
}

const limiter = new TelegramRateLimiter();

/** Telegram errors that won't succeed on retry (blocked/deleted/invalid chat). */
function isPermanentSendError(err: unknown): boolean {
  if (err instanceof GrammyError) {
    // 403 = bot blocked / kicked; 400 = chat not found / bad request.
    return err.error_code === 403 || err.error_code === 400;
  }
  return false;
}

/** Short technical reason for a `message_log` row. */
function sendErrorText(err: unknown): string {
  return err instanceof GrammyError ? err.description : String(err);
}

/**
 * Record a delivery outcome (AUDIT.md T13) — best-effort by design: the log is
 * observability, and a failed INSERT must never fail or re-run a send.
 */
async function logOutcome(o: MessageOutcome): Promise<void> {
  try {
    await insertMessageOutcome(o);
  } catch (err) {
    logger.error({ err, outcome: o }, 'message_log write failed');
  }
}

async function handleNotifyJob(job: NotifyJob, meta: JobMeta): Promise<void> {
  // One round trip for tenant + track + customer + batch (AUDIT.md T3).
  const ctx = await getNotifyContext(job.tenantId, job.trackId, job.customerId);
  if (!ctx) {
    logger.warn({ job }, 'notify: tenant gone, dropping');
    return;
  }
  const { tenant, track, customer, batch } = ctx;

  // Skip soft-deleted or missing tracks (SPEC §7.8: hidden from notifications).
  if (!track || track.deletedAt) {
    logger.warn({ trackId: job.trackId }, 'notify: track missing/deleted, dropping');
    return;
  }

  if (!customer?.tgUserId) {
    logger.warn({ customerId: job.customerId }, 'notify: no telegram id, dropping');
    await logOutcome({
      tenantId: job.tenantId,
      customerId: job.customerId,
      kind: 'notify',
      status: 'dropped',
      trackId: job.trackId,
      error: 'no telegram id',
    });
    return;
  }

  // §4.2: IN_TRANSIT carries the batch ETA line when the track's batch has one.
  let eta: string | undefined;
  if (job.status === 'IN_TRANSIT' && batch?.etaDate) {
    const [y, m, d] = batch.etaDate.split('-');
    eta = d && m && y ? `${d}.${m}.${y}` : batch.etaDate;
  }

  const s = t(customer.lang);
  const message = statusNotification(s, job.status, {
    code: track.codeOriginal,
    kg: track.weightGrams != null ? formatKg(track.weightGrams) : undefined,
    som: track.priceTiyin != null ? formatSom(track.priceTiyin) : undefined,
    pickupAddress: tenant.pickupAddress ?? '',
    workingHours: tenant.workingHours ?? '',
    statusLabel: STATUS_META[job.status][customer.lang],
    contactPhone: tenant.contactPhone ?? '',
    eta,
  });
  // CREATED (or any non-notifiable status that slipped through) → nothing to send.
  if (!message) return;

  const api = apiFor(tenant.botToken);
  const chatId = customer.tgUserId;

  await limiter.acquire(tenant.botToken, chatId);
  try {
    // Attach the NEWEST warehouse photo to the status notification when one
    // exists (§7.14), so the customer's next update after a staff upload
    // carries it (§3.8, §4.2).
    const [newestPath] = await listTrackPhotoPaths(tenant.id, track.id, 1);
    const photoAbs = newestPath
      ? join(getConfig().uploadsDir, newestPath)
      : undefined;

    if (photoAbs && existsSync(photoAbs)) {
      await api.sendPhoto(chatId, new InputFile(photoAbs), { caption: message });
    } else {
      await api.sendMessage(chatId, message);
    }
    await logOutcome({
      tenantId: job.tenantId,
      customerId: customer.id,
      kind: 'notify',
      status: 'sent',
      trackId: track.id,
    });
  } catch (err) {
    if (isPermanentSendError(err)) {
      // Don't burn retries on an unreachable chat — complete the job.
      logger.warn(
        { err: err instanceof GrammyError ? err.description : err, chatId },
        'notify: permanent send error, dropping',
      );
      await logOutcome({
        tenantId: job.tenantId,
        customerId: customer.id,
        kind: 'notify',
        status: 'dropped',
        trackId: track.id,
        error: sendErrorText(err),
      });
      return;
    }
    if (meta.retryCount >= meta.retryLimit) {
      logger.error({ jobId: meta.id, chatId, err }, 'notify: failed after retries');
      await logOutcome({
        tenantId: job.tenantId,
        customerId: customer.id,
        kind: 'notify',
        status: 'failed',
        trackId: track.id,
        error: sendErrorText(err),
      });
      // A notification that never arrives is the product failing at its one job.
      captureError(err, {
        queue: 'notify',
        jobId: meta.id,
        tenantId: job.tenantId,
        trackId: job.trackId,
        status: job.status,
      });
    }
    throw err; // transient → let pg-boss retry with backoff
  }
}

/** Start consuming notification jobs. */
export async function startNotificationWorker(): Promise<void> {
  await workNotifications(handleNotifyJob);
  logger.info('notification worker started');
}

// --- Ticket deliveries (SPEC §5.16/§7.15, tasks.md H4) ----------------------

/**
 * Deliver one staff ticket reply or closure notice to the customer's chat.
 * Same rate-limit / retry / outcome-log discipline as notifications; the
 * outcome row carries `ticket_message_id` so the panel thread can show
 * whether the customer actually received the answer.
 */
async function handleTicketJob(job: TicketJob, meta: JobMeta): Promise<void> {
  const ctx = await getTicketDeliveryContext(
    job.tenantId,
    job.ticketId,
    job.messageId,
  );
  if (!ctx) {
    logger.warn({ job }, 'ticket: ticket gone, dropping');
    return;
  }
  const { tenant, ticket, customer, message } = ctx;

  if (job.kind === 'reply' && !message) {
    logger.warn({ job }, 'ticket: message gone, dropping');
    return;
  }
  if (!customer.tgUserId) {
    logger.warn({ customerId: customer.id }, 'ticket: no telegram id, dropping');
    await logOutcome({
      tenantId: job.tenantId,
      customerId: customer.id,
      kind: 'ticket',
      status: 'dropped',
      ticketMessageId: job.messageId,
      error: 'no telegram id',
    });
    return;
  }

  const s = t(customer.lang);
  const catMeta = TICKET_CATEGORY_META[ticket.category];
  const category = `${catMeta.emoji} ${catMeta[customer.lang]}`;
  const text =
    job.kind === 'reply'
      ? s.ticketReply(category, message!.text)
      : s.ticketClosedNotice(category);

  const api = apiFor(tenant.botToken);
  const chatId = customer.tgUserId;

  await limiter.acquire(tenant.botToken, chatId);
  try {
    await api.sendMessage(chatId, text);
    await logOutcome({
      tenantId: job.tenantId,
      customerId: customer.id,
      kind: 'ticket',
      status: 'sent',
      ticketMessageId: job.messageId,
    });
  } catch (err) {
    if (isPermanentSendError(err)) {
      logger.warn(
        { err: err instanceof GrammyError ? err.description : err, chatId },
        'ticket: permanent send error, dropping',
      );
      await logOutcome({
        tenantId: job.tenantId,
        customerId: customer.id,
        kind: 'ticket',
        status: 'dropped',
        ticketMessageId: job.messageId,
        error: sendErrorText(err),
      });
      return;
    }
    if (meta.retryCount >= meta.retryLimit) {
      logger.error({ jobId: meta.id, chatId, err }, 'ticket: failed after retries');
      await logOutcome({
        tenantId: job.tenantId,
        customerId: customer.id,
        kind: 'ticket',
        status: 'failed',
        ticketMessageId: job.messageId,
        error: sendErrorText(err),
      });
      captureError(err, {
        queue: 'ticket',
        jobId: meta.id,
        tenantId: job.tenantId,
        ticketId: job.ticketId,
      });
    }
    throw err; // transient → let pg-boss retry with backoff
  }
}

/** Start consuming ticket-delivery jobs. */
export async function startTicketWorker(): Promise<void> {
  await workTicketDeliveries(handleTicketJob);
  logger.info('ticket delivery worker started');
}

// --- Debt reminders (SPEC §4.4, §7.7) --------------------------------------

/**
 * Send one debtor reminder. Re-reads tenant/customer fresh and recomputes debt,
 * so a customer who has since paid (debt ≤ 0) is skipped — this matters for both
 * queued manual sends and the weekly sweep (§7.7).
 */
async function handleReminderJob(
  job: ReminderJob,
  meta: JobMeta,
): Promise<void> {
  const ctx = await getSendContext(job.tenantId, job.customerId);
  if (!ctx) {
    logger.warn({ job }, 'reminder: tenant gone, dropping');
    return;
  }
  const { tenant, customer } = ctx;

  if (!customer?.tgUserId) {
    logger.warn({ customerId: job.customerId }, 'reminder: no telegram id, dropping');
    await logOutcome({
      tenantId: job.tenantId,
      customerId: job.customerId,
      kind: 'reminder',
      status: 'dropped',
      error: 'no telegram id',
    });
    return;
  }

  const tracks = await listCustomerTracks(job.tenantId, customer.id);
  const payments = await listCustomerPayments(job.tenantId, customer.id);
  const debt = computeDebtTiyin(
    tracks.map((tr) => ({
      currentStatus: tr.currentStatus,
      priceTiyin: tr.priceTiyin,
      deletedAt: tr.deletedAt,
    })),
    payments.map((p) => ({ amountTiyin: p.amountTiyin })),
  );
  // §7.7: never nag a customer who is settled or in advance.
  if (debt <= 0) {
    logger.info({ customerId: customer.id, reason: job.reason }, 'reminder: no debt, skipping');
    return;
  }

  const s = t(customer.lang);
  const message = s.debtReminder(
    customer.fullName ?? customer.clientCode,
    tenant.name,
    formatSom(debt),
    tenant.contactPhone ?? '',
  );

  const api = apiFor(tenant.botToken);
  const chatId = customer.tgUserId;

  await limiter.acquire(tenant.botToken, chatId);
  try {
    await api.sendMessage(chatId, message);
    await logOutcome({
      tenantId: job.tenantId,
      customerId: customer.id,
      kind: 'reminder',
      status: 'sent',
    });
  } catch (err) {
    if (isPermanentSendError(err)) {
      logger.warn(
        { err: err instanceof GrammyError ? err.description : err, chatId },
        'reminder: permanent send error, dropping',
      );
      await logOutcome({
        tenantId: job.tenantId,
        customerId: customer.id,
        kind: 'reminder',
        status: 'dropped',
        error: sendErrorText(err),
      });
      return;
    }
    if (meta.retryCount >= meta.retryLimit) {
      logger.error({ jobId: meta.id, chatId, err }, 'reminder: failed after retries');
      await logOutcome({
        tenantId: job.tenantId,
        customerId: customer.id,
        kind: 'reminder',
        status: 'failed',
        error: sendErrorText(err),
      });
      captureError(err, {
        queue: 'reminder',
        jobId: meta.id,
        tenantId: job.tenantId,
        reason: job.reason,
      });
    }
    throw err; // transient → let pg-boss retry with backoff
  }
}

/**
 * Hourly sweep: for every tenant whose configured weekly slot matches "now"
 * (Asia/Tashkent), enqueue a reminder per debtor. The dated singletonKey makes a
 * re-run of the same hour a no-op, so a debtor is messaged at most once per week.
 */
async function handleSweepJob(): Promise<void> {
  const { weekday, hour, dateKey } = tashkentSchedule(new Date());
  const tenants = await listTenants();

  for (const tenant of tenants) {
    const reminders = tenant.settings?.reminders;
    if (!reminders?.weekly_enabled) continue;
    if (reminders.weekday !== weekday || reminders.hour !== hour) continue;

    const debtorIds = await listTenantDebtorIds(tenant.id);
    for (const customerId of debtorIds) {
      await enqueueReminder(
        { tenantId: tenant.id, customerId, reason: 'weekly' },
        { singletonKey: weeklyReminderDedupeKey(customerId, dateKey) },
      );
    }
    logger.info(
      { tenant: tenant.name, count: debtorIds.length },
      'reminder sweep: enqueued weekly reminders',
    );
  }

  // Housekeeping on the same hourly tick: forget month-old flow state.
  const pruned = await pruneStaleSessions(SESSION_MAX_AGE_DAYS);
  if (pruned > 0) {
    logger.info({ pruned }, 'reminder sweep: pruned stale bot sessions');
  }
}

/** Start the reminder worker + install the hourly sweep schedule. */
export async function startReminderWorker(): Promise<void> {
  await workReminders(handleReminderJob);
  await workReminderSweeps(handleSweepJob);
  await scheduleReminderSweep();
  logger.info('reminder worker started');
}

// --- Broadcasts (SPEC §5.8, §7.11) -----------------------------------------

/**
 * Send one broadcast delivery. Sent through the same rate limiter as every other
 * outbound message; on success it bumps `broadcasts.sent_count` so the row
 * records the final delivered count (§7.11). Blocked/invalid chats are dropped
 * (no count), transient errors re-throw for pg-boss retry.
 */
async function handleBroadcastJob(
  job: BroadcastJob,
  meta: JobMeta,
): Promise<void> {
  const ctx = await getSendContext(job.tenantId, job.customerId);
  if (!ctx) {
    logger.warn({ job }, 'broadcast: tenant gone, dropping');
    return;
  }
  const { tenant, customer } = ctx;

  if (!customer?.tgUserId) {
    logger.warn(
      { customerId: job.customerId },
      'broadcast: no telegram id, dropping',
    );
    await logOutcome({
      tenantId: job.tenantId,
      customerId: job.customerId,
      kind: 'broadcast',
      status: 'dropped',
      broadcastId: job.broadcastId,
      error: 'no telegram id',
    });
    return;
  }

  const api = apiFor(tenant.botToken);
  const chatId = customer.tgUserId;

  await limiter.acquire(tenant.botToken, chatId);
  try {
    await api.sendMessage(chatId, job.text);
    await incrementBroadcastSent(job.tenantId, job.broadcastId);
    await logOutcome({
      tenantId: job.tenantId,
      customerId: customer.id,
      kind: 'broadcast',
      status: 'sent',
      broadcastId: job.broadcastId,
    });
  } catch (err) {
    if (isPermanentSendError(err)) {
      logger.warn(
        { err: err instanceof GrammyError ? err.description : err, chatId },
        'broadcast: permanent send error, dropping',
      );
      await logOutcome({
        tenantId: job.tenantId,
        customerId: customer.id,
        kind: 'broadcast',
        status: 'dropped',
        broadcastId: job.broadcastId,
        error: sendErrorText(err),
      });
      return;
    }
    if (meta.retryCount >= meta.retryLimit) {
      logger.error({ jobId: meta.id, chatId, err }, 'broadcast: failed after retries');
      await logOutcome({
        tenantId: job.tenantId,
        customerId: customer.id,
        kind: 'broadcast',
        status: 'failed',
        broadcastId: job.broadcastId,
        error: sendErrorText(err),
      });
      captureError(err, {
        queue: 'broadcast',
        jobId: meta.id,
        tenantId: job.tenantId,
        broadcastId: job.broadcastId,
      });
    }
    throw err; // transient → let pg-boss retry with backoff
  }
}

/** Start consuming broadcast jobs. */
export async function startBroadcastWorker(): Promise<void> {
  await workBroadcasts(handleBroadcastJob);
  logger.info('broadcast worker started');
}
