import { requireAdmin } from '@/lib/auth';

import { ImportWizard } from './import-wizard';

export const metadata = { title: 'Import — KargoTrack' };

export default async function ImportPage() {
  await requireAdmin();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Import</h1>
        <p className="mt-1 text-sm text-slate-500">
          Excel fayl yuklang yoki trek kodlarini joylashtiring. Tasdiqlashdan
          oldin natijani ko'rib chiqasiz.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
