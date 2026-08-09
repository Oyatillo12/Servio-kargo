import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import {
  formatDateTime,
  isValidTrackCode,
  isThrottled,
  normalizeCode,
  PUBLIC_LOOKUP_THROTTLE,
  throttleKey,
  type Lang,
  type TrackStatus,
} from '@kargotrack/shared';

import { clientIp } from '@/lib/client-ip';
import { bumpThrottle } from '@/lib/queries/throttle';
import { getTwaContext } from '@/lib/twa/auth';
import { getTwaPublicTrack } from '@/lib/twa/queries';

import { StatusPill } from '../status-pill';

/**
 * Public track lookup (tasks.md B6) — the ONE Mini App screen that works
 * without registration: status + last-change date only, so non-customers can
 * follow a parcel and get pulled toward registering. GET with ?code=, no
 * client JS; every lookup render counts against the caller's IP window.
 */
export default async function TwaLookupPage({
  params,
  searchParams,
}: {
  params: { tenantId: string };
  searchParams: { code?: string };
}) {
  const gate = await getTwaContext(params.tenantId);
  if (gate.state === 'not_found') notFound();
  const lang: Lang = gate.state === 'ok' ? gate.customer.lang : 'uz';
  const t = await getTranslations({ locale: lang, namespace: 'twa' });

  if (gate.state === 'not_premium') {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-base font-bold text-foreground">
          {t('notEnabledTitle')}
        </p>
        <p className="text-sm text-muted-foreground">{t('notEnabledBody')}</p>
      </div>
    );
  }

  const raw = (searchParams.code ?? '').trim();
  const normalized = raw ? normalizeCode(raw) : '';

  let result:
    | { kind: 'idle' }
    | { kind: 'invalid' }
    | { kind: 'throttled' }
    | { kind: 'not_found' }
    | { kind: 'found'; status: TrackStatus; lastEventAt: Date } = {
    kind: 'idle',
  };

  if (raw) {
    if (!isValidTrackCode(normalized)) {
      result = { kind: 'invalid' };
    } else {
      const count = await bumpThrottle(
        throttleKey('lookup', clientIp()),
        PUBLIC_LOOKUP_THROTTLE.windowSeconds,
      );
      if (isThrottled(count, PUBLIC_LOOKUP_THROTTLE)) {
        result = { kind: 'throttled' };
      } else {
        const track = await getTwaPublicTrack(params.tenantId, normalized);
        result = track
          ? {
              kind: 'found',
              status: track.currentStatus,
              lastEventAt: track.lastEventAt,
            }
          : { kind: 'not_found' };
      }
    }
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">{t('navLookup')}</h1>
        <Link
          href={`/m/${params.tenantId}`}
          className="text-sm text-muted-foreground"
        >
          {t('backHome')}
        </Link>
      </header>

      <form method="GET" className="flex gap-2">
        <input
          name="code"
          defaultValue={raw}
          placeholder={t('lookupPlaceholder')}
          inputMode="text"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-[#dfe3ea] px-3 py-2.5 font-mono text-sm outline-none focus:border-slate-400"
        />
        <button
          type="submit"
          className="flex-none rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {t('lookupButton')}
        </button>
      </form>

      {result.kind === 'invalid' ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('lookupInvalid')}
        </p>
      ) : result.kind === 'throttled' ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('lookupThrottled')}
        </p>
      ) : result.kind === 'not_found' ? (
        <p className="rounded-xl border border-dashed border-[#dfe3ea] px-4 py-8 text-center text-sm text-muted-foreground">
          {t('lookupNotFound')}
        </p>
      ) : result.kind === 'found' ? (
        <div className="rounded-xl border border-[#eef0f4] bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="break-all font-mono text-[13.5px] font-semibold text-foreground">
              {raw}
            </span>
            <StatusPill status={result.status} lang={lang} className="flex-none" />
          </div>
          <p className="mt-2 border-t border-[#eef0f4] pt-2 font-mono text-[11.5px] text-muted-foreground">
            {t('lookupLastUpdate')} {formatDateTime(result.lastEventAt)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
