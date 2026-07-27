import { PanelSection, SectionStack } from '@/components/ui/panel-section';
import { Skeleton } from '@/components/ui/skeleton';

/** Settings placeholder — same section rhythm and 4/2 grid as the real screen. */
export default function SettingsLoading() {
  return (
    <>
      <Skeleton className="mb-3 h-6 w-32 md:mb-4" />

      <SectionStack className="md:grid md:grid-cols-6 md:items-start">
        <PanelSection flush className="md:col-span-4">
          <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex min-h-[56px] items-center gap-3 border-t border-n-divider px-4 py-2"
            >
              <Skeleton className="h-[18px] w-[18px] rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </PanelSection>

        <PanelSection className="md:col-span-2">
          <Skeleton className="h-3.5 w-20" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-md md:h-10" />
            <Skeleton className="h-11 flex-1 rounded-md md:h-10" />
          </div>
        </PanelSection>

        <PanelSection className="md:col-span-4">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-2 h-3 w-3/4" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-md md:h-10" />
            <Skeleton className="h-11 flex-1 rounded-md md:h-10" />
          </div>
        </PanelSection>

        <PanelSection className="md:col-span-2">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="mt-3 h-[104px] w-full rounded-sm" />
        </PanelSection>

        <PanelSection className="md:col-span-4">
          <Skeleton className="h-3.5 w-28" />
          <div className="mt-3 space-y-3">
            <Skeleton className="h-11 w-full rounded-sm" />
            <div className="flex flex-col gap-3 md:flex-row">
              <Skeleton className="h-11 flex-1 rounded-sm" />
              <Skeleton className="h-11 flex-1 rounded-sm" />
            </div>
          </div>
        </PanelSection>
      </SectionStack>
    </>
  );
}
