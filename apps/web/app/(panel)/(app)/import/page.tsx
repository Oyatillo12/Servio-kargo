import { getTranslations } from 'next-intl/server';

import { requireCapability } from '@/lib/auth';
import { listBatches } from '@/lib/queries';
import { PageHeader } from '@/components/layout/page-header';
import { ImportWizard } from '@/features/import/components/import-wizard';

export async function generateMetadata() {
  const t = await getTranslations('import');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

export default async function ImportPage() {
  const { tenant } = await requireCapability('import.run');
  const t = await getTranslations('import');

  const batches = await listBatches(tenant.id);

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title={t('pageTitle')} className="mb-4" />
      <ImportWizard batches={batches.map((b) => ({ id: b.id, name: b.name }))} />
    </div>
  );
}
