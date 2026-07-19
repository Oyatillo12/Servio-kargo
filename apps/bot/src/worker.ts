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
  workNotifications,
  workReminderSweeps,
  workReminders,
  type JobMeta,
} from '@kargotrack/db/queue';
import {
  computeDebtTiyin,
  formatKg,
  formatSom,
  statusNotification,
  STATUS_META,
  t,
  tashkentSchedule,
  weeklyReminderDedupeKey,
  type NotifyJob,
  type ReminderJob,
} from '@kargotrack/shared';

import { getConfig } from './config';
import { logger } from './logger';
import {
  getCustomerById,
  getTenantById,
  getTrackById,
  listCustomerPayments,
  listCustomerTracks,
  listTenantDebtorIds,
  listTenants,
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

async function handleNotifyJob(job: NotifyJob, meta: JobMeta): Promise<void> {
  const tenant = await getTenantById(job.tenantId);
  if (!tenant) {
    logger.warn({ job }, 'notify: tenant gone, dropping');
    return;
  }

  const track = await getTrackById(job.tenantId, job.trackId);
  // Skip soft-deleted or missing tracks (SPEC §7.8: hidden from notifications).
  if (!track || track.deletedAt) {
    logger.warn({ trackId: job.trackId }, 'notify: track missing/deleted, dropping');
    return;
  }

  const customer = await getCustomerById(job.tenantId, job.customerId);
  if (!customer?.tgUserId) {
    logger.warn({ customerId: job.customerId }, 'notify: no telegram id, dropping');
    return;
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
  });
  // CREATED (or any non-notifiable status that slipped through) → nothing to send.
  if (!message) return;

  const api = apiFor(tenant.botToken);
  const chatId = customer.tgUserId;

  await limiter.acquire(chatId);
  try {
    // Attach the warehouse photo to the status notification when one exists, so
    // the customer's next update after a staff upload carries it (§3.8, §4.2).
    const photoAbs = track.photoPath
      ? join(getConfig().uploadsDir, track.photoPath)
      : undefined;

    if (photoAbs && existsSync(photoAbs)) {
      await api.sendPhoto(chatId, new InputFile(photoAbs), { caption: message });
    } else {
      await api.sendMessage(chatId, message);
    }
  } catch (err) {
    if (isPermanentSendError(err)) {
      // Don't burn retries on an unreachable chat — complete the job.
      logger.warn(
        { err: err instanceof GrammyError ? err.description : err, chatId },
        'notify: permanent send error, dropping',
      );
      return;
    }
    if (meta.retryCount >= meta.retryLimit) {
      logger.error({ jobId: meta.id, chatId, err }, 'notify: failed after retries');
    }
    throw err; // transient → let pg-boss retry with backoff
  }
}

/** Start consuming notification jobs. */
export async function startNotificationWorker(): Promise<void> {
  await workNotifications(handleNotifyJob);
  logger.info('notification worker started');
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
  const tenant = await getTenantById(job.tenantId);
  if (!tenant) {
    logger.warn({ job }, 'reminder: tenant gone, dropping');
    return;
  }

  const customer = await getCustomerById(job.tenantId, job.customerId);
  if (!customer?.tgUserId) {
    logger.warn({ customerId: job.customerId }, 'reminder: no telegram id, dropping');
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

  await limiter.acquire(chatId);
  try {
    await api.sendMessage(chatId, message);
  } catch (err) {
    if (isPermanentSendError(err)) {
      logger.warn(
        { err: err instanceof GrammyError ? err.description : err, chatId },
        'reminder: permanent send error, dropping',
      );
      return;
    }
    if (meta.retryCount >= meta.retryLimit) {
      logger.error({ jobId: meta.id, chatId, err }, 'reminder: failed after retries');
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
}

/** Start the reminder worker + install the hourly sweep schedule. */
export async function startReminderWorker(): Promise<void> {
  await workReminders(handleReminderJob);
  await workReminderSweeps(handleSweepJob);
  await scheduleReminderSweep();
  logger.info('reminder worker started');
}
