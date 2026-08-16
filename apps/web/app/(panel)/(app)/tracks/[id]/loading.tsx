import { Skeleton } from '@/components/ui/skeleton';
import { CardsSkeleton } from '@/components/shared/skeletons';

export default function TrackDetailLoading() {
  return (
    <div className="mx-auto max-w-md space-y-3">
      <Skeleton className="h-4 w-20" />
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <CardsSkeleton cards={3} />
    </div>
  );
}
