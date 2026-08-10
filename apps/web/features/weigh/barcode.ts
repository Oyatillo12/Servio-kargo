/**
 * Native barcode scanning (tasks.md W3).
 *
 * Android Chrome ships a `BarcodeDetector` behind `window` — a real decoder,
 * already on the phone, with no library to download over a warehouse's mobile
 * connection and no dependency to justify (CLAUDE.md library policy). Where it
 * is missing — iOS Safari, desktop Firefox — the console simply doesn't offer
 * the button and USB-scanner/manual entry carries on unchanged.
 *
 * These types are hand-written because `lib.dom` doesn't declare the API yet;
 * they cover only what this feature calls.
 */

/** Symbologies worth trying, in the order a cargo label is likely to use. */
export const SCAN_FORMATS = [
  // Chinese courier labels are overwhelmingly Code 128, with ITF on cartons.
  'code_128',
  'code_39',
  'itf',
  'ean_13',
  'qr_code',
] as const;

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

function ctor(): BarcodeDetectorConstructor | null {
  if (typeof window === 'undefined') return null;
  const found = (window as unknown as Record<string, unknown>).BarcodeDetector;
  return typeof found === 'function'
    ? (found as BarcodeDetectorConstructor)
    : null;
}

/**
 * Whether this device can scan at all.
 *
 * Camera access also needs a secure context, which the panel always has in
 * production (Caddy terminates HTTPS) and on localhost in dev — but not over a
 * plain-HTTP LAN address, which is exactly how someone would first try this
 * from a phone. Checking it here is what turns "the button does nothing" into
 * "there is no button".
 */
export function canScan(): boolean {
  return (
    ctor() !== null &&
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia != null &&
    window.isSecureContext
  );
}

/**
 * Build a detector limited to the formats this device actually supports.
 * Returns null when nothing usable overlaps — a detector constructed with an
 * unsupported format throws on `detect`, one frame at a time.
 */
export async function createDetector(): Promise<BarcodeDetectorLike | null> {
  const Detector = ctor();
  if (!Detector) return null;

  let supported: string[];
  try {
    supported = await Detector.getSupportedFormats();
  } catch {
    return null;
  }

  const formats = SCAN_FORMATS.filter((f) => supported.includes(f));
  if (formats.length === 0) return null;

  try {
    return new Detector({ formats });
  } catch {
    return null;
  }
}
