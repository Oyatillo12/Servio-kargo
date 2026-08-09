import {
  statusSortIndex,
  isTerminalStatus,
  type TrackStatus,
} from '@kargotrack/shared';

/**
 * The signature element (SPEC §10): the parcel's journey as five stations —
 * China → transit → Tashkent → pickup → delivered. Indigo marks the road
 * already travelled, the single copper (pulsing) dot is the parcel NOW.
 * LOST/RETURNED render nothing — their screens show an error banner instead.
 */

const STATIONS: TrackStatus[] = [
  'CHINA_WAREHOUSE',
  'IN_TRANSIT',
  'TASHKENT_WAREHOUSE',
  'READY_FOR_PICKUP',
  'DELIVERED',
];

export function Pipeline({
  status,
  mini = false,
}: {
  status: TrackStatus;
  mini?: boolean;
}) {
  if (isTerminalStatus(status) && status !== 'DELIVERED') return null;
  const now = statusSortIndex(status);

  return (
    <div
      className={`twa-pipe ${mini ? 'twa-pipe--mini' : ''}`}
      aria-hidden="true"
    >
      {STATIONS.map((station, i) => {
        const idx = statusSortIndex(station);
        const dot =
          idx === now
            ? 'twa-pipe__dot--now'
            : idx < now
              ? 'twa-pipe__dot--done'
              : '';
        return (
          <span key={station} className="contents">
            {i > 0 ? (
              <span
                className={`twa-pipe__line ${idx <= now ? 'twa-pipe__line--done' : ''}`}
              />
            ) : null}
            <span className={`twa-pipe__dot ${dot}`} />
          </span>
        );
      })}
    </div>
  );
}
