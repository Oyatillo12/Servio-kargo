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

import { workNotifications, type JobMeta } from '@kargotrack/db/queue';
import {
  formatKg,
  formatSom,
  statusNotification,
  STATUS_META,
  t,
  type NotifyJob,
} from '@kargotrack/shared';

import { getConfig } from './config';
import { logger } from './logger';
import { getCustomerById, getTenantById, getTrackById } from './queries';
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
    // Attach the warehouse photo on READY_FOR_PICKUP when the file exists (§4.2).
    const photoAbs =
      job.status === 'READY_FOR_PICKUP' && track.photoPath
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
