import { Skeleton } from '@/components/ui/skeleton';
import { HeaderSkeleton, ListSkeleton } from '@/components/shared/skeletons';

/** Tracks list loading skeleton (design screen 16). */
export default function TracksLoading() {
  return (
    <div>
      <HeaderSkeleton />
      <Skeleton className="mb-3 h-11 w-full rounded-lg" />
      <div className="mb-4 flex gap-1.5 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 flex-none rounded-full" />
        ))}
      </div>
      <ListSkeleton rows={8} />
    </div>
  );
}
