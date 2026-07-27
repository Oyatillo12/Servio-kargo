import { Skeleton } from '@/components/ui/skeleton';
import { CardsSkeleton } from '@/components/shared/skeletons';

export default function CustomerDetailLoading() {
  return (
    <div className="mx-auto max-w-md space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <CardsSkeleton cards={3} />
    </div>
  );
}
