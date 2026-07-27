import { Skeleton } from '@/components/ui/skeleton';
import { ListSkeleton } from '@/components/shared/skeletons';

export default function BroadcastLoading() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-52 w-full rounded-xl" />
      <ListSkeleton rows={3} />
    </div>
  );
}
