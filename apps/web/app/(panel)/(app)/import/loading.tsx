import { Skeleton } from '@/components/ui/skeleton';

export default function ImportLoading() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}
