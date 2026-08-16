import { useTranslations } from 'next-intl';

import { formatKg, formatSom } from '@kargotrack/shared';

import { PanelSection } from '@/components/ui/panel-section';
import { cn } from '@/lib/utils';

interface Stage {
  key: 'inChina' | 'inTashkent' | 'delivered';
  value: number;
  align: 'start' | 'center' | 'end';
}

/**
 * Where the tenant's cargo is right now, as one 10px bar (design 1a/1b).
 *
 * The pipeline China → Tashkent → delivered is a line, so it is drawn as a
 * line: each stage's share of the bar is its share of the parcels. A stage
 * holding nothing keeps a fixed narrow slot, hatched — "nothing here" has to
 * stay visible, because a stage that vanished would read as a stage that does
 * not exist, and the shape of the route is the point.
 */
export function CargoFlow({
  inChina,
  inTashkent,
  delivered,
  deliveredWeightGrams,
  deliveredPriceTiyin,
}: {
  inChina: number;
  inTashkent: number;
  delivered: number;
  deliveredWeightGrams: number;
  deliveredPriceTiyin: number;
}) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  const stages: Stage[] = [
    { key: 'inChina', value: inChina, align: 'start' },
    { key: 'inTashkent', value: inTashkent, align: 'center' },
    { key: 'delivered', value: delivered, align: 'end' },
  ];
  const total = stages.reduce((n, s) => n + s.value, 0);

  return (
    <PanelSection title={t('cargoFlow')} className="md:col-span-full">
      <div className="mt-3 flex gap-[3px]" aria-hidden>
        {stages.map((s) => (
          <div
            key={s.key}
            className={cn('h-2.5 rounded-[3px]', segmentWidth(s.value, total))}
            style={s.value > 0 ? { flexGrow: s.value } : undefined}
          />
        ))}
      </div>

      {total === 0 ? (
        <p className="mt-3 text-small text-faint">{t('cargoFlowEmpty')}</p>
      ) : (
        <>
          <ul className="mt-2 flex gap-[3px]">
            {stages.map((s) => (
              <li
                key={s.key}
                className={cn(
                  'min-w-0',
                  s.value > 0 ? 'flex-1' : 'flex-[0_0_64px] md:flex-[0_0_140px]',
                  s.align === 'end' && 'text-right',
                )}
                style={s.value > 0 ? { flexGrow: s.value } : undefined}
              >
                <span
                  className={cn(
                    'block text-lead font-semibold leading-tight md:inline md:me-1.5',
                    s.value > 0 ? 'text-foreground' : 'text-faint',
                  )}
                >
                  {s.value}
                </span>
                <span className="block truncate text-micro font-medium uppercase tracking-[0.05em] text-faint md:inline">
                  {t(s.key)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-2.5 text-small text-muted-foreground">
            {t('deliveredTotals')}{' '}
            <span className="font-semibold text-foreground">
              {formatKg(deliveredWeightGrams)}
            </span>{' '}
            {tCommon('kg')} ·{' '}
            <span className="font-semibold text-foreground">
              {formatSom(deliveredPriceTiyin)}
            </span>{' '}
            {tCommon('som')}
          </p>
        </>
      )}
    </PanelSection>
  );
}

/**
 * Occupied stages share the bar in proportion to their counts (`flexGrow` is
 * set inline); empty ones keep a fixed hatched slot. With nothing anywhere,
 * all three split it evenly so the route still reads as three stages.
 */
function segmentWidth(value: number, total: number): string {
  if (total === 0) return 'flex-1 hatch border border-n-200';
  if (value === 0) return 'flex-[0_0_64px] hatch border border-n-200 md:flex-[0_0_140px]';
  return 'flex-1 bg-primary';
}
