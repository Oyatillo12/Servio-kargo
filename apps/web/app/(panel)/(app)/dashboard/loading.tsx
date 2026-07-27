import { PanelSection, SectionStack } from '@/components/ui/panel-section';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Dashboard placeholder (design screen 1d). It reproduces the real section
 * rhythm — full-bleed blocks and grey bands on phones, the six-column grid on
 * desktop — so nothing shifts when the queries land.
 */
export default function DashboardLoading() {
  return (
    <>
      <div className="mb-3 flex items-center gap-3 md:mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-7 w-40 rounded-md" />
      </div>

      <SectionStack className="md:grid md:grid-cols-6 md:items-start">
        <PanelSection flush>
          <div className="px-4 pb-3 pt-3.5">
            <Skeleton className="h-3.5 w-40" />
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex min-h-[56px] items-center gap-3 border-t border-n-divider px-4 py-2.5"
            >
              <Skeleton className="h-[18px] w-[18px] rounded-sm" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
              <Skeleton className="h-4 w-5" />
            </div>
          ))}
        </PanelSection>

        <PanelSection flush>
          <div className="flex items-center justify-between border-b border-n-divider px-4 py-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2.5 px-4 pb-4 pt-3.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
        </PanelSection>

        <PanelSection className="md:col-span-full">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="mt-3.5 h-2.5 w-full rounded-[3px]" />
          <Skeleton className="mt-3 h-3 w-64" />
        </PanelSection>

        <PanelSection>
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="mt-3 h-[88px] w-full md:h-[100px]" />
        </PanelSection>

        <PanelSection className="order-first md:order-none md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-5 w-6" />
          </div>
        </PanelSection>
      </SectionStack>
    </>
  );
}
