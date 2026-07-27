import { PanelSection, SectionStack } from '@/components/ui/panel-section';
import { Skeleton } from '@/components/ui/skeleton';

/** Team placeholder — the roster's avatar + two-line row rhythm. */
export default function TeamLoading() {
  return (
    <>
      <div className="mb-3 flex items-center justify-between md:mb-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      <SectionStack>
        <PanelSection flush>
          <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 border-t border-n-divider px-4 py-3"
            >
              <Skeleton className="h-8 w-8 flex-none rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-8 flex-none rounded-md" />
            </div>
          ))}
        </PanelSection>
      </SectionStack>
    </>
  );
}
