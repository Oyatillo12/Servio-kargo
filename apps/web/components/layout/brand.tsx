import Image from 'next/image';

import { cn } from '@/lib/utils';
import logo from '../../public/logo.png';
import mark from '../../public/favicon.png';

/**
 * The route mark under the SERVIO Kargo wordmark: China → transit → Tashkent.
 *
 * Squares on a dashed line rather than dots on a dotted one (SPEC 5.0) — the
 * same shape language as the status chips, and the first stop is filled with
 * signal because that is where a parcel starts.
 */
export function RouteDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="h-[7px] w-[7px] rounded-[1px] bg-signal" />
      <span className="w-8 border-t-2 border-dashed border-rule" />
      <span className="h-[7px] w-[7px] rounded-[1px] border-2 border-rule bg-surface" />
      <span className="w-8 border-t-2 border-dashed border-rule" />
      <span className="h-[7px] w-[7px] rounded-[1px] border-2 border-rule bg-surface" />
    </div>
  );
}

/**
 * Compact square SERVIO mark — for places the horizontal wordmark is too wide,
 * i.e. the mobile top bar (design 02) where it sits next to the tenant name.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src={mark}
      alt="SERVIO Kargo"
      priority
      className={cn('h-7 w-7 rounded-sm', className)}
    />
  );
}

/** SERVIO Kargo wordmark — the horizontal "servio kargo" logo lockup. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Image
      src={logo}
      alt="SERVIO Kargo"
      priority
      className={cn('h-6 w-auto', className)}
    />
  );
}
