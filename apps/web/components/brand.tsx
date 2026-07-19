import { cn } from '@/lib/utils';

/** The dotted route mark used under the KargoTrack wordmark (design 01/14). */
export function RouteDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="h-[7px] w-[7px] rounded-full bg-primary" />
      <span className="w-8 border-t-2 border-dotted border-[#b9c0cf]" />
      <span className="h-[7px] w-[7px] rounded-full border-2 border-[#b9c0cf] bg-white" />
      <span className="w-8 border-t-2 border-dotted border-[#b9c0cf]" />
      <span className="h-[7px] w-[7px] rounded-full border-2 border-[#b9c0cf] bg-white" />
    </div>
  );
}

/** KargoTrack wordmark. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'text-lg font-bold tracking-tight text-primary',
        className,
      )}
    >
      KargoTrack
    </span>
  );
}
