import { cn } from '@/lib/utils';

/** Shimmer placeholder block (matches the design's loading skeleton). */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-sm bg-[linear-gradient(90deg,#efede7_25%,#e2ded2_50%,#efede7_75%)] bg-[length:600px_100%] [animation:sk_1.3s_infinite_linear]',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
