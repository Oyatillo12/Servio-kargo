import { requireAdmin } from '@/lib/auth';
import { listBatches } from '@/lib/queries';

import { ImportWizard } from './import-wizard';

export const metadata = { title: 'Import — SERVIO Kargo' };

export default async function ImportPage() {
  const { tenant } = await requireAdmin();
  const batches = await listBatches(tenant.id);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-bold text-foreground">Import</h1>
      <ImportWizard batches={batches.map((b) => ({ id: b.id, name: b.name }))} />
    </div>
  );
}
