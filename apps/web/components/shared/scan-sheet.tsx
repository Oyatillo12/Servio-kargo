'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Spinner } from '@/components/ui/spinner';

import { createDetector } from './barcode';

/**
 * Full-screen camera scanner (tasks.md W3).
 *
 * Mounted only when the device passed `canScan()`, so everything here can
 * assume a `BarcodeDetector` and a camera exist; what it still has to handle is
 * the person saying no to the permission prompt, which is a normal answer and
 * not an error worth a red screen.
 *
 * The scan loop runs on `requestAnimationFrame` but only actually decodes a few
 * times a second: decoding every frame pins a mid-range phone's CPU and drains
 * the battery of the one device the warehouse is working from.
 */
const DECODE_INTERVAL_MS = 250;

export function ScanSheet({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('weigh');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Read out of the catalogue up front so the effect below depends on two
  // strings rather than on `t`: a re-created `t` would tear the camera down and
  // start it again mid-scan, which on a phone reads as the screen flickering.
  const unsupportedText = t('scanUnsupported');
  const noCameraText = t('scanNoCamera');

  // Held in refs, not state: the loop must see the current values without
  // being re-created, and a second detection after the first must be ignored.
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const frameRef = useRef<number>();

  const stop = useCallback(() => {
    doneRef.current = true;
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    // Releasing every track is what turns the phone's camera light off. Skip it
    // and the camera stays held until the tab is closed.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const detector = await createDetector();
      if (!detector) {
        setError(unsupportedText);
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // The back camera: nobody scans a parcel with the selfie lens.
          video: { facingMode: { ideal: 'environment' } },
        });
      } catch {
        // Denied, or the camera is already in use by another app.
        if (!cancelled) setError(noCameraText);
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay refusal — the poster frame stays, the loop still decodes.
      }
      setReady(true);

      let lastDecode = 0;
      const tick = async (now: number) => {
        if (doneRef.current) return;
        if (now - lastDecode >= DECODE_INTERVAL_MS && video.readyState >= 2) {
          lastDecode = now;
          try {
            const [hit] = await detector.detect(video);
            if (hit?.rawValue && !doneRef.current) {
              stop();
              onDetected(hit.rawValue);
              return;
            }
          } catch {
            // One undecodable frame is the normal case, not a failure.
          }
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [onDetected, stop, unsupportedText, noCameraText]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex h-[52px] flex-none items-center justify-between px-3 text-white">
        <span className="text-body font-semibold">{t('scanTitle')}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('scanClose')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface/10"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {/* Aiming frame — a barcode held anywhere in view decodes, but people
            need to be told where to point. */}
        {ready && !error ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 h-28 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
          />
        ) : null}

        {!ready && !error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner className="text-white" />
          </div>
        ) : null}

        {error ? (
          <p className="absolute inset-x-6 text-center text-body font-medium text-white">
            {error}
          </p>
        ) : null}
      </div>

      <p className="flex-none px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4 text-center text-micro text-white/70">
        {t('scanHint')}
      </p>
    </div>
  );
}
