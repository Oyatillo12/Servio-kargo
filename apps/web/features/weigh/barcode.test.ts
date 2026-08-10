import { afterEach, describe, expect, it, vi } from 'vitest';

import { canScan, createDetector, SCAN_FORMATS } from './barcode';

/**
 * The scan loop itself needs a camera and a real decoder, so what is worth
 * testing here is the negotiation around it: a detector built with a format the
 * device does not support throws on EVERY frame, which is the difference
 * between "no scan button" and a scanner that silently never reads anything.
 */

type Win = Record<string, unknown>;

/** Install a fake `window`/`navigator` for one test. */
function stubEnvironment(options: {
  detector?: unknown;
  secure?: boolean;
  media?: boolean;
}) {
  const win: Win = { isSecureContext: options.secure ?? true };
  if (options.detector !== undefined) win.BarcodeDetector = options.detector;
  vi.stubGlobal('window', win);
  vi.stubGlobal('navigator', {
    mediaDevices: options.media === false ? {} : { getUserMedia: () => {} },
  });
}

/** A `BarcodeDetector` stand-in reporting `supported` and recording its options. */
function fakeDetector(supported: string[]) {
  const constructed: string[][] = [];
  class Fake {
    constructor(opts?: { formats?: string[] }) {
      constructed.push(opts?.formats ?? []);
    }
    detect() {
      return Promise.resolve([]);
    }
  }
  (Fake as unknown as { getSupportedFormats: () => Promise<string[]> })
    .getSupportedFormats = () => Promise.resolve(supported);
  return { Fake, constructed };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canScan', () => {
  it('is true only with a decoder, a camera and a secure context', () => {
    stubEnvironment({ detector: fakeDetector(['code_128']).Fake });
    expect(canScan()).toBe(true);
  });

  it('is false where the API is missing — iOS Safari, desktop Firefox', () => {
    stubEnvironment({});
    expect(canScan()).toBe(false);
  });

  it('is false over plain HTTP, where getUserMedia would be refused', () => {
    // Exactly how someone first tries this: the panel on a LAN IP, no TLS.
    stubEnvironment({
      detector: fakeDetector(['code_128']).Fake,
      secure: false,
    });
    expect(canScan()).toBe(false);
  });

  it('is false without a camera API at all', () => {
    stubEnvironment({ detector: fakeDetector(['code_128']).Fake, media: false });
    expect(canScan()).toBe(false);
  });
});

describe('createDetector', () => {
  it('asks only for formats the device reports supporting', async () => {
    // A cheap phone that decodes Code 128 and QR but not ITF must not be handed
    // ITF — the constructor accepts it and then `detect` throws every frame.
    const { Fake, constructed } = fakeDetector(['code_128', 'qr_code', 'pdf417']);
    stubEnvironment({ detector: Fake });

    expect(await createDetector()).not.toBeNull();
    expect(constructed).toEqual([['code_128', 'qr_code']]);
  });

  it('keeps the order the formats are declared in', async () => {
    const { Fake, constructed } = fakeDetector([...SCAN_FORMATS].reverse());
    stubEnvironment({ detector: Fake });

    await createDetector();
    expect(constructed[0]).toEqual([...SCAN_FORMATS]);
  });

  it('returns null when nothing useful overlaps', async () => {
    // A decoder that only reads 2D postal codes is no use on a cargo label.
    stubEnvironment({ detector: fakeDetector(['pdf417', 'aztec']).Fake });
    expect(await createDetector()).toBeNull();
  });

  it('returns null rather than throwing when the API misbehaves', async () => {
    class Broken {
      static getSupportedFormats() {
        return Promise.reject(new Error('not allowed'));
      }
    }
    stubEnvironment({ detector: Broken });
    expect(await createDetector()).toBeNull();
  });

  it('returns null when the API is absent', async () => {
    stubEnvironment({});
    expect(await createDetector()).toBeNull();
  });
});
