import { Skeleton } from '@/components/ui/skeleton';

/** Tracks list loading skeleton (design screen 16). */
export default function TracksLoading() {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-foreground">Treklar</h1>
      </div>
      <Skeleton className="mb-4 h-11 w-full rounded-lg" />

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-3 border-b border-[#eef0f4] px-4 py-3.5 last:border-0"
          >
            <Skeleton className="h-5 w-5 rounded-md" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
              <Skeleton className="h-2.5 w-44" />
              <Skeleton className="h-2.5 w-52" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
