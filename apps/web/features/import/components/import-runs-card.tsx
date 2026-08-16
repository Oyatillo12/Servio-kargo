import { Download } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { formatDateTime, importUndoRemainingMs } from '@kargotrack/shared';

import type { ImportRunSummary } from '@/lib/queries';

import { UndoImportButton } from './undo-import-button';

/**
 * `Oxirgi importlar` (SPEC §5.4, §7.18).
 *
 * The result screen dies with the page, and a wrong import outlives one browser
 * tab — the minute somebody realizes the file was yesterday's is usually a
 * minute after they navigated away. This is the same undo, reachable after a
 * reload, plus the problem-rows download for every run that had any.
 */
export async function ImportRunsCard({ runs }: { runs: ImportRunSummary[] }) {
  const t = await getTranslations('import');
  if (runs.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 text-[13.5px] font-semibold text-foreground">
        {t('runsTitle')}
      </h2>
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        {runs.map((run) => {
          const summary = t('runCounts', {
            created: run.created,
            updated: run.updated,
          });
          return (
            <div
              key={run.id}
              className="border-b border-[#eef0f4] px-4 py-3 last:border-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11.5px] text-muted-foreground">
                  {formatDateTime(run.createdAt)}
                  {run.createdByName ? ` · ${run.createdByName}` : ''}
                </span>
                <span className="shrink-0 text-[11.5px] font-semibold text-primary">
                  {summary}
                </span>
              </div>

              {run.sourceName ? (
                <p className="mt-0.5 truncate text-[13px] text-foreground">
                  {run.sourceName}
                </p>
              ) : null}

              {run.undoneAt ? (
                <p className="mt-1 text-[11.5px] font-semibold text-[#b3261e]">
                  {t('runUndone', {
                    reverted: run.undoneReverted ?? 0,
                    skipped: run.undoneSkipped ?? 0,
                  })}
                </p>
              ) : null}

              <div className="mt-1 flex items-center justify-between gap-3">
                {run.rejected > 0 ? (
                  <a
                    href={`/api/import/runs/${run.id}/rejected`}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    {t('rejectedDownload', { count: run.rejected })}
                  </a>
                ) : (
                  <span />
                )}
                {run.undo === 'available' && !run.evidenceGone ? (
                  <UndoImportButton
                    runId={run.id}
                    minutesLeft={Math.ceil(
                      importUndoRemainingMs(run.createdAt) / 60_000,
                    )}
                    summary={summary}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
