'use client';

import Link from 'next/link';
import { useRef, useState, useTransition, type FormEvent } from 'react';
import { Check, UploadCloud, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  TRACK_STATUSES,
  type ColumnMapping,
  type ImportField,
  type Lang,
  type TrackStatus,
} from '@kargotrack/shared';

import { RouteDots } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
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
  readImportSourceAction,
  type ApplyResult,
  type PreviewLine,
  type PreviewResult,
  type SourceResult,
} from '../actions';

const DEFAULT_STATUS: TrackStatus = 'CHINA_WAREHOUSE';
const NO_BATCH = '__none__';
const NO_COLUMN = '__none__';

type Step = 1 | 2 | 3 | 4;

/** `0 → A`, `25 → Z`, `26 → AA` — how a spreadsheet names its columns. */
function columnLetter(index: number): string {
  let out = '';
  let n = index;
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** 1 → 2 → 3 → 4 progress header (design 06–08). */
function Stepper({ step, labels }: { step: Step; labels: string[] }) {
  const t = useTranslations('import');

  return (
    <ol className="flex items-center" aria-label={t('pageTitle')}>
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const active = n === step;
        return (
          <li key={label} className="contents">
            {i > 0 ? (
              <div
                aria-hidden
                className={cn(
                  'mx-1.5 flex-1 border-t-2',
                  n <= step
                    ? 'border-solid border-primary'
                    : 'border-dotted border-[#c3c9d6]',
                )}
              />
            ) : null}
            <div
              className="flex flex-none items-center gap-1"
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
                  'text-[11px]',
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

/** One `field → column` picker of the mapping step. */
function ColumnPicker({
  field,
  value,
  required,
  columns,
  onChange,
}: {
  field: ImportField;
  value: number | null;
  required?: boolean;
  columns: { index: number; label: string }[];
  onChange: (value: number | null) => void;
}) {
  const t = useTranslations('import');
  const id = `col-${field}`;

  return (
    <div className="flex items-center gap-2.5">
      <Label htmlFor={id} className="w-[92px] flex-none text-[13px]">
        {t(`field_${field}`)}
        {required ? <span className="text-[#b3261e]"> *</span> : null}
      </Label>
      <Select
        value={value == null ? NO_COLUMN : String(value)}
        onValueChange={(v) => onChange(v === NO_COLUMN ? null : Number(v))}
      >
        <SelectTrigger id={id} className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {required ? null : (
            <SelectItem value={NO_COLUMN}>{t('columnNone')}</SelectItem>
          )}
          {columns.map((c) => (
            <SelectItem key={c.index} value={String(c.index)}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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

  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [source, setSource] = useState<SourceResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [status, setStatus] = useState<TrackStatus>(DEFAULT_STATUS);
  const [batchId, setBatchId] = useState<string>(NO_BATCH);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const step: Step = applied?.ok
    ? 4
    : preview?.ok
      ? 3
      : source?.ok && mapping
        ? 2
        : 1;
  const counts = preview?.counts;
  const applyCount = (counts?.create ?? 0) + (counts?.update ?? 0);
  const locked = source?.lockedFields ?? [];

  /** The source + mapping fields every step re-sends (see actions.ts). */
  function baseFormData(): FormData {
    const fd = new FormData();
    if (file) fd.set('file', file);
    else fd.set('text', text);
    if (mapping) {
      fd.set('col.code', String(mapping.code));
      if (mapping.customer != null)
        fd.set('col.customer', String(mapping.customer));
      if (mapping.weight != null) fd.set('col.weight', String(mapping.weight));
      if (mapping.price != null) fd.set('col.price', String(mapping.price));
      if (mapping.description != null)
        fd.set('col.description', String(mapping.description));
    }
    fd.set('hasHeader', hasHeader ? '1' : '0');
    fd.set('status', status);
    return fd;
  }

  function onReadSource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    if (file) fd.set('file', file);
    else fd.set('text', text);
    startTransition(async () => {
      const res = await readImportSourceAction(fd);
      if (!res.ok || !res.mapping) {
        setError(res.error ?? tCommon('errorGeneric'));
        return;
      }
      setSource(res);
      setMapping(res.mapping);
      setHasHeader(res.hasHeader ?? false);
    });
  }

  function onPreview() {
    setError(null);
    startTransition(async () => {
      const res = await previewImportAction(baseFormData());
      if (!res.ok) {
        setError(res.error ?? tCommon('errorGeneric'));
        return;
      }
      setPreview(res);
    });
  }

  function onApply() {
    setError(null);
    const fd = baseFormData();
    if (batchId !== NO_BATCH) fd.set('batchId', batchId);
    startTransition(async () => {
      const res = await applyImportAction(fd);
      if (!res.ok) {
        setError(res.error ?? tCommon('errorGeneric'));
        return;
      }
      setApplied(res);
    });
  }

  function reset() {
    setFile(null);
    setText('');
    setSource(null);
    setMapping(null);
    setPreview(null);
    setApplied(null);
    setStatus(DEFAULT_STATUS);
    setBatchId(NO_BATCH);
    setError(null);
    formRef.current?.reset();
  }

  function backToMapping() {
    setPreview(null);
    setError(null);
  }

  const columns = Array.from(
    { length: source?.columnCount ?? 0 },
    (_, index) => {
      const header = hasHeader ? (source?.sample?.[0]?.[index] ?? '') : '';
      return {
        index,
        label: header
          ? `${columnLetter(index)} · ${header}`
          : t('columnN', { letter: columnLetter(index) }),
      };
    },
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-4">
        <Stepper
          step={step}
          labels={[t('step1'), t('step2'), t('step3'), t('step4')]}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-[#b3261e]"
        >
          {error}
        </p>
      ) : null}

      {/* --- Step 4: result -------------------------------------------------- */}
      {step === 4 && applied?.ok ? (
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
          <div className="-mt-2 space-y-0.5 text-sm text-muted-foreground">
            {applied.assigned ? (
              <p>{t('resultAssigned', { count: applied.assigned })}</p>
            ) : null}
            {applied.enriched ? (
              <p>{t('resultEnriched', { count: applied.enriched })}</p>
            ) : null}
            <p>{t('resultQueued', { count: applied.queued ?? 0 })}</p>
          </div>
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

      {/* --- Step 2: column mapping ------------------------------------------ */}
      {step === 2 && mapping ? (
        <div className="space-y-4">
          <SectionCard>
            <p className="mb-3 text-[13px] text-muted-foreground">
              {source?.sheetName
                ? t('sourceSheet', {
                    sheet: source.sheetName,
                    count: source.rowCount ?? 0,
                  })
                : t('sourceRows', { count: source?.rowCount ?? 0 })}
            </p>

            <label className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium">{t('hasHeader')}</span>
              <Switch checked={hasHeader} onCheckedChange={setHasHeader} />
            </label>

            <div className="space-y-2.5">
              <ColumnPicker
                field="code"
                required
                value={mapping.code}
                columns={columns}
                onChange={(v) =>
                  v != null && setMapping({ ...mapping, code: v })
                }
              />
              {(['customer', 'weight', 'price', 'description'] as const).map((field) =>
                locked.includes(field) ? null : (
                  <ColumnPicker
                    key={field}
                    field={field}
                    value={mapping[field]}
                    columns={columns}
                    onChange={(v) => setMapping({ ...mapping, [field]: v })}
                  />
                ),
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t('mappingHint')}
            </p>
          </SectionCard>

          {source?.sample?.length ? (
            <div className="overflow-hidden rounded-xl border border-border bg-white">
              <div className="border-b border-[#eef0f4] px-3.5 py-2.5 text-[13px] font-semibold">
                {t('samplePreview')}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <tbody>
                    {source.sample.map((row, r) => (
                      <tr
                        key={r}
                        className={cn(
                          'border-b border-[#f2f4f7] last:border-0',
                          hasHeader && r === 0 && 'bg-[#f8fafc] font-semibold',
                        )}
                      >
                        {columns.map((c) => {
                          const role = (
                            [
                              'code',
                              'customer',
                              'weight',
                              'price',
                              'description',
                            ] as const
                          ).find((f) => mapping[f] === c.index);
                          return (
                            <td
                              key={c.index}
                              className={cn(
                                'max-w-[140px] truncate px-2.5 py-1.5',
                                role
                                  ? 'text-foreground'
                                  : 'text-muted-foreground/60',
                                role === 'code' && 'font-mono',
                              )}
                            >
                              {row[c.index] ?? ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {source?.truncated ? (
            <p className="text-xs text-[#92600a]">{t('truncated')}</p>
          ) : null}

          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={reset} disabled={isPending}>
              {tCommon('back')}
            </Button>
            <Button className="flex-1" onClick={onPreview} disabled={isPending}>
              {isPending ? <Spinner /> : null}
              {t('continue')}
            </Button>
          </div>
        </div>
      ) : null}

      {/* --- Step 3: preview ------------------------------------------------- */}
      {step === 3 && preview?.ok && counts ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <StatCard n={counts.create} label={t('statNew')} tone="green" />
            <StatCard n={counts.update} label={t('statUpdated')} tone="amber" />
            <StatCard n={counts.malformed} label={t('statError')} tone="red" />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <PreviewRow label={t('rowNew')} items={preview.samples?.create} />
            <PreviewRow
              label={t('rowUpdated')}
              items={preview.samples?.update}
            />
            <PreviewRow
              label={t('rowError')}
              tone="red"
              items={preview.samples?.malformed}
            />
            {mapping?.customer != null ? (
              <>
                <PreviewCount
                  label={t('rowAssigned')}
                  count={counts.assign}
                  tone="green"
                />
                <PreviewRow
                  label={t('rowUnresolved')}
                  tone="amber"
                  count={counts.missing + counts.ambiguous}
                  items={preview.samples?.unresolved}
                />
              </>
            ) : null}
            {mapping?.weight != null ? (
              <PreviewCount label={t('rowWeighed')} count={counts.weight} />
            ) : null}
            {mapping?.price != null ? (
              <PreviewCount label={t('rowPriced')} count={counts.price} />
            ) : null}
            {mapping?.description != null ? (
              <PreviewCount
                label={t('rowDescribed')}
                count={counts.description}
              />
            ) : null}
            <PreviewRow
              label={t('rowWarnings')}
              tone="amber"
              items={preview.samples?.warnings}
            />
          </div>

          {counts.duplicate ? (
            <p className="text-xs text-muted-foreground">
              {t('duplicates', { count: counts.duplicate })}
            </p>
          ) : null}
          {counts.missing + counts.ambiguous > 0 ? (
            <p className="text-xs text-[#92600a]">{t('unresolvedHint')}</p>
          ) : null}

          <SectionCard>
            <Label htmlFor="target-status" className="mb-2 block">
              {t('targetStatus')}
            </Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as TrackStatus)}
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
            <Button
              variant="secondary"
              onClick={backToMapping}
              disabled={isPending}
            >
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
        <form ref={formRef} onSubmit={onReadSource} className="space-y-3">
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
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-3.5 py-3">
              <span
                className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#e2f6e8] font-mono text-[10px] font-bold text-[#177338]"
                aria-hidden
              >
                XLSX
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                {file.name}
              </span>
              <button
                type="button"
                aria-label={t('removeFile')}
                onClick={() => {
                  setFile(null);
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
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'YT1000000001\nYT1000000002\n…'}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">{t('textHint')}</p>
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

/** A counted-only preview line (nothing to expand). */
function PreviewCount({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone?: 'green';
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#eef0f4] px-3.5 py-3 text-[13.5px] last:border-0">
      <span className={cn(count > 0 && tone === 'green' && 'text-[#177338]')}>
        {label}
      </span>
      <span className="font-mono tabular-nums">{count}</span>
    </div>
  );
}

/** Expandable preview row for a category. */
function PreviewRow({
  label,
  items,
  count,
  tone,
}: {
  label: string;
  items: PreviewLine[] | undefined;
  /** Real total when `items` is a capped sample. Defaults to `items.length`. */
  count?: number;
  tone?: 'red' | 'amber';
}) {
  const list = items ?? [];
  const total = count ?? list.length;
  if (total === 0) {
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
          tone === 'red'
            ? 'text-[#b3261e]'
            : tone === 'amber'
              ? 'text-[#92600a]'
              : 'text-foreground',
        )}
      >
        <span>
          {label} · <span className="font-mono tabular-nums">{total}</span>
        </span>
      </summary>
      <div className="max-h-40 overflow-y-auto px-3.5 pb-3 font-mono text-[12px] text-slate-600">
        {list.map((it, i) => (
          <div key={`${it.line}-${i}`} className="flex gap-2 py-0.5">
            <span className="w-8 flex-none text-right tabular-nums text-muted-foreground">
              {it.line}
            </span>
            <span className="min-w-0 flex-1 truncate">{it.text}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
