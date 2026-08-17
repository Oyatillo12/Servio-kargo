import { getTranslations } from 'next-intl/server';

import { requireCapability } from '@/lib/auth';
import { listBatches, listImportRuns } from '@/lib/queries';
import { PageHeader } from '@/components/layout/page-header';
import { ImportRunsCard } from '@/features/import/components/import-runs-card';
import { ImportWizard } from '@/features/import/components/import-wizard';

export async function generateMetadata() {
  const t = await getTranslations('import');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

export default async function ImportPage() {
  const { tenant } = await requireCapability('import.run');
  const t = await getTranslations('import');

  const [batches, runs] = await Promise.all([
    listBatches(tenant.id),
    listImportRuns(tenant.id),
  ]);

  return (
    <div>
      <PageHeader title={t('pageTitle')} className="mb-4" />

      {/* The wizard is a table-shaped job — a column mapping over a six-row
          sample — and it used to run in a 448px column on every screen, so the
          preview it exists to show was the first thing to be cut off. It gets
          the width now, and the run history moves alongside it rather than a
          screen below: the undo window is 60 minutes, and it has to be visible
          while the next file is being prepared. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5">
        <div className="lg:col-span-2">
          <ImportWizard
            batches={batches.map((b) => ({ id: b.id, name: b.name }))}
          />
        </div>
        {/* §7.18: the undo has to outlive the result screen. */}
        <ImportRunsCard runs={runs} />
      </div>
    </div>
  );
}
