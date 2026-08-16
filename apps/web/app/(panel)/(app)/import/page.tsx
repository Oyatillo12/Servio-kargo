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
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title={t('pageTitle')} className="mb-4" />
      <ImportWizard batches={batches.map((b) => ({ id: b.id, name: b.name }))} />
      {/* §7.18: the undo has to outlive the result screen. */}
      <ImportRunsCard runs={runs} />
    </div>
  );
}
