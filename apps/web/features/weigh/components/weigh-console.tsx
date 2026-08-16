'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ImageIcon,
  Lock,
  LockOpen,
  ScanLine,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatKg, formatSom, type MarkaOutcomeKind } from '@kargotrack/shared';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { WeighedRow } from '@/lib/queries/weighing';

import { weighAction, type WeighField } from '../actions';
import { canScan } from '../barcode';
import { ScanSheet } from './scan-sheet';

/** SPEC §8: warehouse photos are JPEG, max 10 MB — the same rule as the bot. */
const MAX_PHOTO_MB = 10;
const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;

/**
 * The warehouse weighing console (tasks.md W1, W3, W4).
 *
 * Built for one posture: a phone in one hand, a parcel in the other, at a
 * receiving desk in Guangzhou. Everything follows from that — the code field
 * holds focus so a USB scanner (which types and presses Enter) lands in it
 * without a tap, Enter walks code → weight → save, and the day list sits right
 * underneath so a wrong weight or a parcel attached to the wrong person is seen
 * within a second rather than at the end of the shift.
 *
 * The list is optimistic in one direction only: nothing appears in it until the
 * server has written it. A row that is on screen happened.
 */
export function WeighConsole({
  initialRows,
  canAssign,
  /** Warning banner text when the tenant cannot price a parcel yet, else null. */
  blockedReason,
}: {
  initialRows: WeighedRow[];
  canAssign: boolean;
  blockedReason: string | null;
}) {
  const t = useTranslations('weigh');
  const tCommon = useTranslations('common');
  const [pending, startTransition] = useTransition();

  const [code, setCode] = useState('');
  const [weight, setWeight] = useState('');
  const [marka, setMarka] = useState('');
  /** Keep the marka between parcels — a customer's boxes arrive together. */
  const [markaLocked, setMarkaLocked] = useState(false);
  const [rows, setRows] = useState<WeighedRow[]>(initialRows);

  /**
   * Dimensions (§7.16) stay behind a toggle, closed by default. The scanner
   * flow is this screen's reason to exist: while the block is closed there are
   * no extra fields in the tab order and Enter on the weight still saves. An
   * operator who never measures a box pays nothing for the feature.
   */
  const [dimsOpen, setDimsOpen] = useState(false);
  const [dims, setDims] = useState({ lengthCm: '', widthCm: '', heightCm: '' });
  const lengthRef = useRef<HTMLInputElement>(null);

  const [scanning, setScanning] = useState(false);
  /**
   * Whether this device can scan, resolved AFTER mount: `BarcodeDetector` and
   * `isSecureContext` don't exist on the server, and rendering the button in
   * the server pass would make it flicker away on hydration.
   */
  const [scanSupported, setScanSupported] = useState(false);
  useEffect(() => setScanSupported(canScan()), []);

  const codeRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const markaRef = useRef<HTMLInputElement>(null);

  const fieldRefs: Record<WeighField, typeof codeRef> = {
    code: codeRef,
    weight: weightRef,
    marka: markaRef,
    dims: lengthRef,
  };

  /** A scanned code behaves exactly like a scanned-by-USB one: on to the weight. */
  const onDetected = useCallback((raw: string) => {
    setCode(raw.trim());
    setScanning(false);
    // The sheet is unmounting; wait for the field to exist again before asking
    // for focus, or the keyboard opens on nothing.
    setTimeout(() => weightRef.current?.focus(), 0);
  }, []);

  function submit() {
    if (pending) return;
    startTransition(async () => {
      const res = await weighAction({
        code,
        weight,
        marka: canAssign ? marka : null,
        ...(dimsOpen ? dims : {}),
      });

      if (res.error || !res.row) {
        toast.error(res.error ?? tCommon('errorGeneric'));
        // Put the cursor on the field that was wrong, with its value intact so
        // it can be corrected rather than re-scanned.
        fieldRefs[res.field ?? 'code'].current?.focus();
        fieldRefs[res.field ?? 'code'].current?.select();
        return;
      }

      setRows((prev) => [res.row!, ...prev]);
      setCode('');
      setWeight('');
      if (!markaLocked) setMarka('');
      // Sides belong to the box that just left the desk — never carried over,
      // unlike the marka, whose whole point is a run of one customer's boxes.
      setDims({ lengthCm: '', widthCm: '', heightCm: '' });
      codeRef.current?.focus();
    });
  }

  const totals = rows.reduce(
    (acc, r) => ({
      grams: acc.grams + r.weightGrams,
      tiyin: acc.tiyin + r.priceTiyin,
    }),
    { grams: 0, tiyin: 0 },
  );

  // --- Warehouse photo (W4) -------------------------------------------------
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  async function uploadPhoto(trackId: string, file: File) {
    // Checked here as well as on the server so a 9 MB shot on a warehouse
    // connection is refused instantly instead of after the upload.
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error(t('photoTooLarge', { max: MAX_PHOTO_MB }));
      return;
    }

    const body = new FormData();
    body.append('photo', file);

    setUploadingId(trackId);
    try {
      const res = await fetch(`/api/tracks/${trackId}/photo`, {
        method: 'POST',
        body,
      });
      if (!res.ok) {
        const code = await res
          .json()
          .then((j: { error?: string }) => j.error)
          .catch(() => undefined);
        toast.error(photoErrorText(code));
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.trackId === trackId ? { ...r, hasPhoto: true } : r)),
      );
      toast.success(t('photoOk'));
    } catch {
      // Offline, or the request never left the phone.
      toast.error(t('photoFailed'));
    } finally {
      setUploadingId(null);
    }
  }

  function photoErrorText(code: string | undefined): string {
    if (code === 'TOO_LARGE') return t('photoTooLarge', { max: MAX_PHOTO_MB });
    if (code === 'BAD_TYPE') return t('photoBadType');
    return t('photoFailed');
  }

  return (
    <div className="flex flex-col gap-4">
      {blockedReason ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2.5 text-[13px] font-medium text-warning">
          <AlertTriangle className="mt-px h-4 w-4 flex-none" aria-hidden />
          {blockedReason}
        </p>
      ) : null}

      {/* Entry form. Big targets: this is used with cold hands and gloves. */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-3.5 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="weigh-code">{t('codeLabel')}</Label>
          <div className="flex items-stretch gap-2">
            <input
              id="weigh-code"
              ref={codeRef}
              value={code}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="next"
              placeholder={t('codePlaceholder')}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                // A USB scanner types the code and presses Enter. That must land
                // on the weight field, not submit an entry with no weight.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  weightRef.current?.focus();
                }
              }}
              // `uppercase` is for the typed code, not the hint — a shouted
              // placeholder reads as an error message.
              className="h-14 min-w-0 flex-1 rounded-lg border border-input bg-white px-3.5 font-mono text-[20px] font-semibold uppercase tracking-wide outline-none placeholder:normal-case focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {/* W3: only on devices that actually have a decoder and a camera —
                elsewhere there is no button rather than one that does nothing. */}
            {scanSupported ? (
              <button
                type="button"
                onClick={() => setScanning(true)}
                aria-label={t('scanTitle')}
                className="flex h-14 w-14 flex-none items-center justify-center rounded-lg border border-input bg-white text-primary active:bg-accent"
              >
                <ScanLine className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="weigh-weight">{t('weightLabel')}</Label>
          <div className="flex items-center overflow-hidden rounded-lg border border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <input
              id="weigh-weight"
              ref={weightRef}
              value={weight}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              placeholder="0"
              onChange={(e) => setWeight(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              className="h-14 min-w-0 flex-1 bg-white px-3.5 font-mono text-[20px] font-semibold outline-none"
            />
            <span className="self-stretch border-l border-border bg-[#f7f8fa] px-4 py-[18px] text-[13px] text-muted-foreground">
              {tCommon('kg')}
            </span>
          </div>
        </div>

        {/* §7.16 dimensions — a toggle, not a row of fields: see `dimsOpen`. */}
        {dimsOpen ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="weigh-len">
                {t('dimsLabel')}{' '}
                <span className="font-normal text-muted-foreground">
                  · {tCommon('optional')}
                </span>
              </Label>
              <button
                type="button"
                onClick={() => {
                  setDimsOpen(false);
                  setDims({ lengthCm: '', widthCm: '', heightCm: '' });
                }}
                className="rounded-md px-1.5 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-secondary"
              >
                {tCommon('cancel')}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {(['lengthCm', 'widthCm', 'heightCm'] as const).map((side, i) => (
                <div
                  key={side}
                  className="flex min-w-0 flex-1 items-center gap-1.5"
                >
                  {i > 0 ? (
                    <span className="flex-none text-[15px] text-muted-foreground">
                      ×
                    </span>
                  ) : null}
                  <input
                    id={i === 0 ? 'weigh-len' : undefined}
                    ref={i === 0 ? lengthRef : undefined}
                    value={dims[side]}
                    inputMode="numeric"
                    autoComplete="off"
                    enterKeyHint="done"
                    placeholder={['50', '40', '30'][i]}
                    aria-label={
                      [t('dimLength'), t('dimWidth'), t('dimHeight')][i]
                    }
                    onChange={(e) =>
                      setDims((d) => ({ ...d, [side]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        submit();
                      }
                    }}
                    className="h-12 min-w-0 flex-1 rounded-lg border border-input bg-white px-3 font-mono text-[16px] font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              ))}
              <span className="flex-none text-[13px] text-muted-foreground">
                {tCommon('cm')}
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDimsOpen(true);
              setTimeout(() => lengthRef.current?.focus(), 0);
            }}
            className="self-start rounded-md px-1 py-1 text-[13px] font-medium text-primary hover:bg-secondary"
          >
            + {t('dimsAdd')}
          </button>
        )}

        {canAssign ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="weigh-marka">
                {t('markaLabel')}{' '}
                <span className="font-normal text-muted-foreground">
                  · {tCommon('optional')}
                </span>
              </Label>
              <button
                type="button"
                onClick={() => setMarkaLocked((v) => !v)}
                aria-pressed={markaLocked}
                className={cn(
                  'flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-medium transition-colors',
                  markaLocked
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:bg-secondary',
                )}
              >
                {markaLocked ? (
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <LockOpen className="h-3.5 w-3.5" aria-hidden />
                )}
                {t('markaKeep')}
              </button>
            </div>
            <div
              className={cn(
                'flex items-center overflow-hidden rounded-lg border focus-within:ring-2 focus-within:ring-primary/20',
                // A held marka is the one way this screen can silently attach a
                // parcel to the wrong person, so it never looks like an empty field.
                markaLocked ? 'border-primary bg-accent' : 'border-input',
              )}
            >
              <input
                id="weigh-marka"
                ref={markaRef}
                value={marka}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="done"
                placeholder={t('markaPlaceholder')}
                onChange={(e) => setMarka(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                  }
                }}
                className="h-12 min-w-0 flex-1 bg-transparent px-3.5 font-mono text-[16px] font-semibold uppercase outline-none"
              />
              {marka ? (
                <button
                  type="button"
                  onClick={() => {
                    setMarka('');
                    markaRef.current?.focus();
                  }}
                  aria-label={t('markaClear')}
                  className="flex h-12 w-12 flex-none items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <Button
          onClick={submit}
          disabled={pending}
          className="h-14 w-full text-[16px]"
        >
          {pending ? <Spinner /> : null}
          {tCommon('save')}
        </Button>
      </div>

      {/* Today's entries — the whole point of the screen: mistakes are visible. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between px-0.5">
          <h2 className="text-[13px] font-semibold text-foreground">
            {t('todayTitle')}
          </h2>
          {rows.length > 0 ? (
            <p className="font-mono text-[12px] text-muted-foreground">
              {t('todayTotals', {
                count: rows.length,
                kg: formatKg(totals.grams),
                som: formatSom(totals.tiyin),
              })}
            </p>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-input px-3 py-6 text-center text-[13px] text-muted-foreground">
            {t('todayEmpty')}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
            {rows.map((row, i) => (
              <WeighRow
                key={`${row.trackId}-${i}`}
                row={row}
                uploading={uploadingId === row.trackId}
                onPhoto={(file) => void uploadPhoto(row.trackId, file)}
              />
            ))}
          </ul>
        )}
      </div>

      {scanning ? (
        <ScanSheet onDetected={onDetected} onClose={() => setScanning(false)} />
      ) : null}
    </div>
  );
}

/** Marka outcomes worth interrupting the operator about. */
const MARKA_WARNINGS: Partial<Record<MarkaOutcomeKind, string>> = {
  conflict: 'markaConflict',
  notFound: 'markaNotFound',
};

function WeighRow({
  row,
  uploading,
  onPhoto,
}: {
  row: WeighedRow;
  uploading: boolean;
  onPhoto: (file: File) => void;
}) {
  const t = useTranslations('weigh');
  const tCommon = useTranslations('common');
  const warningKey = MARKA_WARNINGS[row.marka];
  const inputId = `weigh-photo-${row.trackId}`;

  return (
    <li className="flex flex-col gap-1 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[14px] font-semibold text-foreground">
          {row.code}
        </span>
        <span className="flex flex-none items-center gap-1.5">
          <span className="font-mono text-[14px] font-semibold text-primary">
            {formatSom(row.priceTiyin)}{' '}
            <span className="text-[11px] font-medium text-muted-foreground">
              {tCommon('som')}
            </span>
          </span>
          {/* W4: the photo belongs to the parcel that was JUST weighed, so it
              lives on the row rather than in the form — by the time you reach
              for the camera, the next code is already in the field.

              A real <label>/<input> pair rather than a button calling .click():
              tapping the label is what opens the phone camera natively, and the
              input stays focusable so this works from a keyboard too. `capture`
              asks for the camera rather than the gallery; JPEG only, because
              nothing here converts formats and the file is served as JPEG. */}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg"
            capture="environment"
            disabled={uploading}
            className="peer sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Cleared so re-taking the same parcel's photo fires `change`
              // again even if the phone hands back an identically-named file.
              e.target.value = '';
              if (file) onPhoto(file);
            }}
          />
          <label
            htmlFor={inputId}
            aria-label={row.hasPhoto ? t('photoReplace') : t('photoAdd')}
            className={cn(
              'flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-md border transition-colors',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
              uploading && 'pointer-events-none opacity-50',
              row.hasPhoto
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-input bg-white text-muted-foreground active:bg-secondary',
            )}
          >
            {uploading ? (
              <Spinner className="h-4 w-4" />
            ) : row.hasPhoto ? (
              <ImageIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            ) : (
              <Camera className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            )}
          </label>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        <span className="font-mono text-muted-foreground">
          {formatKg(row.weightGrams)} {tCommon('kg')}
        </span>

        {/* §7.16: the price came from the volume, and this is the number the
            customer will ask about — so the operator sees it while the box is
            still on the desk, not after the call. */}
        {row.basis === 'volumetric' ? (
          <Tag className="bg-accent text-primary">
            {t('tagVolumetric', { kg: formatKg(row.chargeableGrams) })}
          </Tag>
        ) : null}

        {row.owner ? (
          <span className="rounded bg-accent px-1.5 py-px font-mono font-semibold text-primary">
            {row.owner.clientCode}
          </span>
        ) : (
          <span className="text-muted-foreground">{t('ownerless')}</span>
        )}

        {row.created ? <Tag className="bg-secondary text-foreground">{t('tagNew')}</Tag> : null}
        {row.notified ? (
          <Tag className="bg-success/10 text-success">
            <Check className="h-3 w-3" aria-hidden />
            {t('tagNotified')}
          </Tag>
        ) : null}
      </div>

      {warningKey ? (
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-warning">
          <AlertTriangle className="h-3.5 w-3.5 flex-none" aria-hidden />
          {t(warningKey)}
        </p>
      ) : null}
    </li>
  );
}

function Tag({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-px text-[11px] font-semibold',
        className,
      )}
    >
      {children}
    </span>
  );
}
