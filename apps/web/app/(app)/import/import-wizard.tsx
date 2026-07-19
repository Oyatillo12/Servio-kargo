'use client';

import { useState, useTransition, type FormEvent } from 'react';

import { STATUS_META, TRACK_STATUSES, type ImportCode } from '@kargotrack/shared';

import {
  applyImportAction,
  previewImportAction,
  type ApplyResult,
  type PreviewResult,
} from './actions';

/** Expandable count block for a preview category. */
function PreviewGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: 'green' | 'amber' | 'red';
}) {
  const toneClass = {
    green: 'text-green-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
  }[tone];
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400">
        {label}: 0
      </div>
    );
  }
  return (
    <details className="rounded-lg border border-slate-200 px-3 py-2">
      <summary className={`cursor-pointer text-sm font-medium ${toneClass}`}>
        {label}: {items.length}
      </summary>
      <div className="mt-2 max-h-40 overflow-y-auto font-mono text-xs text-slate-600">
        {items.map((it, i) => (
          <div key={`${it}-${i}`}>{it}</div>
        ))}
      </div>
    </details>
  );
}

export function ImportWizard() {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function onPreview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await previewImportAction(formData);
      setPreview(res);
    });
  }

  function onApply() {
    if (!preview?.ok || !preview.status) return;
    const codes: ImportCode[] = [
      ...(preview.toCreate ?? []),
      ...(preview.toUpdate ?? []),
    ];
    startTransition(async () => {
      const res = await applyImportAction({ status: preview.status!, codes });
      setApplied(res);
    });
  }

  function reset() {
    setPreview(null);
    setApplied(null);
  }

  // --- Step 3: result -------------------------------------------------------
  if (applied?.ok) {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Import yakunlandi</h2>
        <ul className="space-y-1 text-sm text-slate-700">
          <li>✅ Yaratildi: {applied.created}</li>
          <li>♻️ Yangilandi: {applied.updated}</li>
          <li>📨 {applied.queued} ta xabar navbatga qo'yildi</li>
        </ul>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Yana import qilish
        </button>
      </div>
    );
  }

  // --- Step 2: preview ------------------------------------------------------
  if (preview?.ok && preview.status) {
    const meta = STATUS_META[preview.status];
    const willNotify = (preview.toUpdate ?? []).length;
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm text-slate-600">
            Qo'llaniladigan status:{' '}
            <span className="font-medium text-slate-900">
              {meta.emoji} {meta.uz}
            </span>
          </p>
          <div className="space-y-2">
            <PreviewGroup
              label="Yangi"
              tone="green"
              items={(preview.toCreate ?? []).map((c) => c.original)}
            />
            <PreviewGroup
              label="Yangilanadi"
              tone="amber"
              items={(preview.toUpdate ?? []).map((c) => c.original)}
            />
            <PreviewGroup
              label="Xato qator"
              tone="red"
              items={preview.malformed ?? []}
            />
          </div>
          {preview.duplicateCount ? (
            <p className="mt-2 text-xs text-slate-400">
              Faylda takrorlangan {preview.duplicateCount} ta kod e'tiborga
              olinmadi.
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onApply}
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isPending ? 'Qo’llanmoqda…' : 'Tasdiqlash va qo’llash'}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={isPending}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Bekor qilish
          </button>
          <span className="ml-auto text-xs text-slate-400">
            {willNotify} ta trekka xabar yuborilishi mumkin
          </span>
        </div>
      </div>
    );
  }

  // --- Step 1: input --------------------------------------------------------
  return (
    <form
      onSubmit={onPreview}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"
    >
      {preview?.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {preview.error}
        </p>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Excel fayl (.xlsx)
        </label>
        <input
          type="file"
          name="file"
          accept=".xlsx"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
        />
      </div>

      <div className="text-center text-xs uppercase tracking-wide text-slate-400">
        yoki
      </div>

      <div>
        <label
          htmlFor="text"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Trek kodlari (matn)
        </label>
        <textarea
          id="text"
          name="text"
          rows={6}
          placeholder={'YT1000000001\nYT1000000002\n…'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
      </div>

      <div>
        <label
          htmlFor="status"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue="TASHKENT_WAREHOUSE"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        >
          {TRACK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].emoji} {STATUS_META[s].uz}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {isPending ? 'Tekshirilmoqda…' : "Ko'rib chiqish"}
      </button>
    </form>
  );
}
