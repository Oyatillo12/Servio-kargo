import { STATUS_META, type Lang, type TrackStatus } from '@kargotrack/shared';

/**
 * Status pill in the TWA color language (twa.css `.twa-pill--*`): theme-aware
 * tokens, unlike the panel's fixed-light StatusBadge. Label from the shared
 * catalogue, language from the CUSTOMER row — passed explicitly, `useLocale`
 * here would read the admin's panel cookie.
 */
export function StatusPill({
  status,
  lang,
  className,
}: {
  status: TrackStatus;
  lang: Lang;
  className?: string;
}) {
  return (
    <span className={`twa-pill twa-pill--${status} ${className ?? ''}`}>
      {STATUS_META[status][lang]}
    </span>
  );
}
