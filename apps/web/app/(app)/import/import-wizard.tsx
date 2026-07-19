'use client';

import Link from 'next/link';
import {
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import { Check, UploadCloud, X } from 'lucide-react';

import {
  STATUS_META,
  TRACK_STATUSES,
  type ImportCode,
  type TrackStatus,
} from '@kargotrack/shared';

import { RouteDots } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  applyImportAction,
  previewImportAction,
  type ApplyResult,
  type PreviewResult,
} from './actions';

const DEFAULT_STATUS: TrackStatus = 'CHINA_WAREHOUSE';

/** 1 → 2 → 3 progress header (design 06–08). */
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = ['Yuklash', 'Tekshirish', 'Natija'];
  return (
    <div className="flex items-center">
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < step;
        const active = n === step;
        return (
          <div key={label} className="contents">
            {i > 0 ? (
              <div
                className={cn(
                  'mx-2.5 flex-1 border-t-2',
                  n <= step
                    ? 'border-solid border-primary'
                    : 'border-dotted border-[#c3c9d6]',
                )}
              />
            ) : null}
            <div className="flex flex-none items-center gap-1.5">
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  active && 'bg-primary text-white',
                  done && 'border-[1.5px] border-[#177338] bg-[#e2f6e8] text-[#177338]',
                  !active && !done &&
                    'border-[1.5px] border-[#c3c9d6] bg-white text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
              </div>
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
          </div>
        );
      })}
    </div>
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
      <div className="font-mono text-lg font-semibold">{n}</div>
      <div className="text-[11.5px] font-semibold">{label}</div>
    </div>
  );
}

const NO_BATCH = '__none__';

export function ImportWizard({
  batches,
}: {
  batches: { id: string; name: string }[];
}) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [applyStatus, setApplyStatus] = useState<TrackStatus | null>(null);
  const [batchId, setBatchId] = useState<string>(NO_BATCH);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const step: 1 | 2 | 3 = applied?.ok ? 3 : preview?.ok ? 2 : 1;

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
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-[1.5px] border-[#177338] bg-[#e2f6e8] text-2xl text-[#177338]">
            ✓
          </div>
          <p className="text-lg font-bold">
            {(applied.created ?? 0) + (applied.updated ?? 0)} ta trek saqlandi
          </p>
          <p className="-mt-2 text-sm text-muted-foreground">
            {applied.queued ?? 0} ta xabar navbatga qo&apos;yildi
          </p>
          <RouteDots className="mt-1" />
          <div className="mt-2 flex w-full flex-col gap-2.5">
            <Button asChild className="w-full">
              <Link href="/tracks">Treklarga o&apos;tish</Link>
            </Button>
            <Button variant="secondary" className="w-full" onClick={reset}>
              Yana import qilish
            </Button>
          </div>
        </div>
      ) : null}

      {/* --- Step 2: preview ------------------------------------------------- */}
      {step === 2 && preview?.ok ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <StatCard n={(preview.toCreate ?? []).length} label="Yangi" tone="green" />
            <StatCard
              n={(preview.toUpdate ?? []).length}
              label="Yangilanadi"
              tone="amber"
            />
            <StatCard n={(preview.malformed ?? []).length} label="Xato" tone="red" />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <PreviewRow
              label="Yangi treklar"
              items={(preview.toCreate ?? []).map((c) => c.original)}
            />
            <PreviewRow
              label="Yangilanadigan"
              items={(preview.toUpdate ?? []).map((c) => c.original)}
            />
            <PreviewRow
              label="Xato qatorlar"
              tone="red"
              items={preview.malformed ?? []}
            />
          </div>

          {preview.duplicateCount ? (
            <p className="text-xs text-muted-foreground">
              Faylda takrorlangan {preview.duplicateCount} ta kod e&apos;tiborga
              olinmadi.
            </p>
          ) : null}

          <div className="rounded-xl border border-border bg-white p-3.5">
            <Label className="mb-2 block">Qaysi statusga o&apos;tkazamiz?</Label>
            <Select
              value={applyStatus ?? preview.status ?? DEFAULT_STATUS}
              onValueChange={(v) => setApplyStatus(v as TrackStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRACK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].emoji} {STATUS_META[s].uz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              Yangi va yangilanadigan treklar shu statusni oladi.
            </p>
          </div>

          {batches.length > 0 ? (
            <div className="rounded-xl border border-border bg-white p-3.5">
              <Label className="mb-2 block">Reys (ixtiyoriy)</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BATCH}>Reyssiz</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                Tanlansa, barcha import qilingan treklar shu reysga biriktiriladi.
              </p>
            </div>
          ) : null}

          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              onClick={reset}
              disabled={isPending}
            >
              Orqaga
            </Button>
            <Button className="flex-1" onClick={onApply} disabled={isPending}>
              {isPending
                ? 'Saqlanmoqda…'
                : `${
                    (preview.toCreate ?? []).length +
                    (preview.toUpdate ?? []).length
                  } ta trekni saqlash`}
            </Button>
          </div>
        </div>
      ) : null}

      {/* --- Step 1: input --------------------------------------------------- */}
      {step === 1 ? (
        <form
          ref={formRef}
          onSubmit={onPreview}
          className="space-y-3"
        >
          <input type="hidden" name="status" value={DEFAULT_STATUS} />

          {preview?.error ? (
            <p className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-[#b3261e]">
              {preview.error}
            </p>
          ) : null}

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[#c3c9d6] bg-white px-4 py-7 text-center">
            <UploadCloud className="h-7 w-7 text-primary" strokeWidth={1.6} />
            <span className="text-sm font-semibold">Excel faylni tanlang</span>
            <span className="text-[12.5px] text-muted-foreground">
              .xlsx · birinchi qator — sarlavha
            </span>
            <input
              type="file"
              name="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>

          {fileName ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-3.5 py-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#e2f6e8] font-mono text-[10px] font-bold text-[#177338]">
                XLSX
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                {fileName}
              </span>
              <button
                type="button"
                aria-label="Faylni olib tashlash"
                onClick={() => {
                  setFileName(null);
                  formRef.current?.reset();
                }}
                className="p-1 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">
            yoki
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="text">Trek kodlari (matn)</Label>
            <textarea
              id="text"
              name="text"
              rows={5}
              placeholder={'YT1000000001\nYT1000000002\n…'}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Tekshirilmoqda…' : 'Davom etish'}
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
        <span className="font-mono">0</span>
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
          {label} · {items.length}
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
