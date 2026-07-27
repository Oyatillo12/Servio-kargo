import { Skeleton } from '@/components/ui/skeleton';
import { HeaderSkeleton, ListSkeleton } from '@/components/shared/skeletons';

export default function BatchesLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <HeaderSkeleton withAction={false} />
      <Skeleton className="mb-3 h-11 w-full rounded-lg" />
      <ListSkeleton rows={5} />
    </div>
  );
}
