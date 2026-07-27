import { CardsSkeleton, HeaderSkeleton } from '@/components/shared/skeletons';

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <HeaderSkeleton withAction={false} />
      <div className="md:grid md:grid-cols-2 md:items-start md:gap-3">
        <CardsSkeleton cards={3} />
        <CardsSkeleton cards={3} className="mt-3 md:mt-0" />
      </div>
    </div>
  );
}
