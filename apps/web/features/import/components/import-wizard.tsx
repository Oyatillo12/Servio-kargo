'use client';

import Link from 'next/link';
import { useRef, useState, useTransition, type FormEvent } from 'react';
import { Check, UploadCloud, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  TRACK_STATUSES,
  type ImportCode,
  type Lang,
  type TrackStatus,
} from '@kargotrack/shared';

import { RouteDots } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { statusOptionLabel } from '@/lib/status-ui';
import { cn } from '@/lib/utils';

import {
  applyImportAction,
  previewImportAction,
  type ApplyResult,
  type PreviewResult,
} from '../actions';

const DEFAULT_STATUS: TrackStatus = 'CHINA_WAREHOUSE';
const NO_BATCH = '__none__';

/** 1 → 2 → 3 progress header (design 06–08). */
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const t = useTranslations('import');
  const items = [t('step1'), t('step2'), t('step3')];

  return (
    <ol className="flex items-center" aria-label={t('pageTitle')}>
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < step;
        const active = n === step;
        return (
          <li key={label} className="contents">
            {i > 0 ? (
              <div
                aria-hidden
                className={cn(
                  'mx-2.5 flex-1 border-t-2',
                  n <= step
                    ? 'border-solid border-primary'
                    : 'border-dotted border-[#c3c9d6]',
                )}
              />
            ) : null}
            <div
              className="flex flex-none items-center gap-1.5"
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  active && 'bg-primary text-white',
                  done &&
                    'border-[1.5px] border-[#177338] bg-[#e2f6e8] text-[#177338]',
                  !active &&
                    !done &&
                    'border-[1.5px] border-[#c3c9d6] bg-white text-muted-foreground',
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                ) : (
                  n
                )}
              </span>
              <span
                className={cn(
                  'text-xs',
                  active
                    ? 'font-bold text-primary'
                    : done
                      ? 'font-medium text-[#177338]'
                      : 'font-medium text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatCard({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: 'green' | 'amber' | 'red';
}) {
  const cls = {
    green: 'bg-[#e2f6e8] border-[#c2e8cf] text-[#177338]',
    amber: 'bg-[#fdf3d8] border-[#f3e2b0] text-[#92600a]',
    red: 'bg-[#fde8e8] border-[#f5c8c6] text-[#b3261e]',
  }[tone];
  return (
    <div className={cn('flex-1 rounded-lg border p-2.5 text-center', cls)}>
      <div className="font-mono text-lg font-semibold tabular-nums">{n}</div>
      <div className="text-[11.5px] font-semibold">{label}</div>
    </div>
  );
}

export function ImportWizard({
  batches,
}: {
  batches: { id: string; name: string }[];
}) {
  const t = useTranslations('import');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Lang;

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [applyStatus, setApplyStatus] = useState<TrackStatus | null>(null);
  const [batchId, setBatchId] = useState<string>(NO_BATCH);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const step: 1 | 2 | 3 = applied?.ok ? 3 : preview?.ok ? 2 : 1;
  const applyCount =
    (preview?.toCreate ?? []).length + (preview?.toUpdate ?? []).length;

  function onPreview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await previewImportAction(formData);
      setPreview(res);
      if (res.ok && res.status) setApplyStatus(res.status);
    });
  }

  function onApply() {
    if (!preview?.ok) return;
    const status = applyStatus ?? preview.status ?? DEFAULT_STATUS;
    const codes: ImportCode[] = [
      ...(preview.toCreate ?? []),
      ...(preview.toUpdate ?? []),
    ];
    startTransition(async () => {
      const res = await applyImportAction({
        status,
        batchId: batchId === NO_BATCH ? null : batchId,
        codes,
      });
      setApplied(res);
    });
  }

  function reset() {
    setPreview(null);
    setApplied(null);
    setApplyStatus(null);
    setBatchId(NO_BATCH);
    setFileName(null);
    formRef.current?.reset();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-4">
        <Stepper step={step} />
      </div>

      {/* --- Step 3: result -------------------------------------------------- */}
      {applied?.ok ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-white px-6 py-10 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full border-[1.5px] border-[#177338] bg-[#e2f6e8] text-2xl text-[#177338]"
            aria-hidden
          >
            ✓
          </div>
          <p className="text-lg font-bold">
            {t('resultSaved', {
              count: (applied.created ?? 0) + (applied.updated ?? 0),
            })}
          </p>
          <p className="-mt-2 text-sm text-muted-foreground">
            {t('resultQueued', { count: applied.queued ?? 0 })}
          </p>
          <RouteDots className="mt-1" />
          <div className="mt-2 flex w-full flex-col gap-2.5">
            <Button asChild className="w-full">
              <Link href="/tracks">{t('goToTracks')}</Link>
            </Button>
            <Button variant="secondary" className="w-full" onClick={reset}>
              {t('importAgain')}
            </Button>
          </div>
        </div>
      ) : null}

      {/* --- Step 2: preview ------------------------------------------------- */}
      {step === 2 && preview?.ok ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <StatCard
              n={(preview.toCreate ?? []).length}
              label={t('statNew')}
              tone="green"
            />
            <StatCard
              n={(preview.toUpdate ?? []).length}
              label={t('statUpdated')}
              tone="amber"
            />
            <StatCard
              n={(preview.malformed ?? []).length}
              label={t('statError')}
              tone="red"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <PreviewRow
              label={t('rowNew')}
              items={(preview.toCreate ?? []).map((c) => c.original)}
            />
            <PreviewRow
              label={t('rowUpdated')}
              items={(preview.toUpdate ?? []).map((c) => c.original)}
            />
            <PreviewRow
              label={t('rowError')}
              tone="red"
              items={preview.malformed ?? []}
            />
          </div>

          {preview.duplicateCount ? (
            <p className="text-xs text-muted-foreground">
              {t('duplicates', { count: preview.duplicateCount })}
            </p>
          ) : null}

          <SectionCard>
            <Label htmlFor="target-status" className="mb-2 block">
              {t('targetStatus')}
            </Label>
            <Select
              value={applyStatus ?? preview.status ?? DEFAULT_STATUS}
              onValueChange={(v) => setApplyStatus(v as TrackStatus)}
            >
              <SelectTrigger id="target-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRACK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusOptionLabel(s, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('targetStatusHint')}
            </p>
          </SectionCard>

          {batches.length > 0 ? (
            <SectionCard>
              <Label htmlFor="import-batch" className="mb-2 block">
                {t('batchOptional')}
              </Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger id="import-batch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BATCH}>{t('noBatch')}</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('batchHint')}
              </p>
            </SectionCard>
          ) : null}

          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={reset} disabled={isPending}>
              {tCommon('back')}
            </Button>
            <Button className="flex-1" onClick={onApply} disabled={isPending}>
              {isPending ? <Spinner /> : null}
              {t('applyCount', { count: applyCount })}
            </Button>
          </div>
        </div>
      ) : null}

      {/* --- Step 1: input --------------------------------------------------- */}
      {step === 1 ? (
        <form ref={formRef} onSubmit={onPreview} className="space-y-3">
          <input type="hidden" name="status" value={DEFAULT_STATUS} />

          {preview?.error ? (
            <p
              role="alert"
              className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-[#b3261e]"
            >
              {preview.error}
            </p>
          ) : null}

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[#c3c9d6] bg-white px-4 py-7 text-center transition-colors hover:border-primary hover:bg-accent/30 focus-within:border-primary">
            <UploadCloud
              className="h-7 w-7 text-primary"
              strokeWidth={1.6}
              aria-hidden
            />
            <span className="text-sm font-semibold">{t('pickFile')}</span>
            <span className="text-[12.5px] text-muted-foreground">
              {t('pickFileHint')}
            </span>
            <input
              type="file"
              name="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>

          {fileName ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-3.5 py-3">
              <span
                className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#e2f6e8] font-mono text-[10px] font-bold text-[#177338]"
                aria-hidden
              >
                XLSX
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                {fileName}
              </span>
              <button
                type="button"
                aria-label={t('removeFile')}
                onClick={() => {
                  setFileName(null);
                  formRef.current?.reset();
                }}
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}

          <div className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">
            {t('or')}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="text">{t('textLabel')}</Label>
            <Textarea
              id="text"
              name="text"
              rows={5}
              placeholder={'YT1000000001\nYT1000000002\n…'}
              className="font-mono text-sm"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            {t('continue')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

/** Expandable preview row for a category. */
function PreviewRow({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone?: 'red';
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-between border-b border-[#eef0f4] px-3.5 py-3 text-[13.5px] text-muted-foreground last:border-0">
        <span>{label}</span>
        <span className="font-mono tabular-nums">0</span>
      </div>
    );
  }
  return (
    <details className="border-b border-[#eef0f4] last:border-0">
      <summary
        className={cn(
          'flex cursor-pointer items-center justify-between px-3.5 py-3 text-[13.5px] font-semibold',
          tone === 'red' ? 'text-[#b3261e]' : 'text-foreground',
        )}
      >
        <span>
          {label} · <span className="font-mono tabular-nums">{items.length}</span>
        </span>
      </summary>
      <div className="max-h-40 overflow-y-auto px-3.5 pb-3 font-mono text-[12px] text-slate-600">
        {items.map((it, i) => (
          <div key={`${it}-${i}`} className="py-0.5">
            {it}
          </div>
        ))}
      </div>
    </details>
  );
}
