import { cn } from '@/lib/utils';

/** Shimmer placeholder block (matches the design's loading skeleton). */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md bg-[linear-gradient(90deg,#eef0f4_25%,#e4e7ee_50%,#eef0f4_75%)] bg-[length:600px_100%] [animation:sk_1.3s_infinite_linear]',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
