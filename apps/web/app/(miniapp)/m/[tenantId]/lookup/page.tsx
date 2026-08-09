import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Search } from 'lucide-react';

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

import { Pipeline } from '@/features/twa/components/pipeline';
import { Screen } from '@/features/twa/components/screen';
import { StatusPill } from '@/features/twa/components/status-pill';
import { clientIp } from '@/lib/client-ip';
import { bumpThrottle } from '@/lib/queries/throttle';
import { getTwaContext } from '@/lib/twa/auth';
import { getTwaPublicTrack } from '@/lib/twa/queries';

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
      <div className="twa-rise flex min-h-[70vh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-[17px] font-extrabold">{t('notEnabledTitle')}</p>
        <p className="twa-hint text-sm leading-relaxed">{t('notEnabledBody')}</p>
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
    <Screen
      title={t('navLookup')}
      backHref={`/m/${params.tenantId}`}
      backLabel={t('backHome')}
    >
      <form method="GET" className="twa-rise flex gap-2">
        <input
          name="code"
          defaultValue={raw}
          placeholder={t('lookupPlaceholder')}
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          className="twa-input min-w-0 flex-1 font-mono"
        />
        <button
          type="submit"
          aria-label={t('lookupButton')}
          className="twa-btn twa-press w-auto flex-none px-4"
        >
          <Search className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </form>

      {result.kind === 'invalid' ? (
        <p
          className="twa-rise rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--twa-error-soft)', color: 'var(--twa-error)' }}
        >
          {t('lookupInvalid')}
        </p>
      ) : result.kind === 'throttled' ? (
        <p
          className="twa-rise rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'var(--twa-warning-soft)',
            color: 'var(--twa-warning)',
          }}
        >
          {t('lookupThrottled')}
        </p>
      ) : result.kind === 'not_found' ? (
        <p
          className="twa-hint twa-rise rounded-2xl border border-dashed px-4 py-8 text-center text-sm"
          style={{ borderColor: 'var(--twa-border)' }}
        >
          {t('lookupNotFound')}
        </p>
      ) : result.kind === 'found' ? (
        <div className="twa-card twa-rise px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 break-all font-mono text-[13.5px] font-semibold">
              {raw}
            </span>
            <StatusPill status={result.status} lang={lang} className="flex-none" />
          </div>
          <div className="mt-3">
            <Pipeline status={result.status} />
          </div>
          <p
            className="twa-hint mt-3 border-t pt-2.5 font-mono text-[11.5px]"
            style={{ borderColor: 'var(--twa-border)' }}
          >
            {t('lookupLastUpdate')} {formatDateTime(result.lastEventAt)}
          </p>
        </div>
      ) : null}
    </Screen>
  );
}
