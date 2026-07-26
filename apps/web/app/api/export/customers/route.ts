import { z } from 'zod';

import {
  EXPORT_MAX_ROWS,
  buildCustomersSheet,
  truncationNotice,
} from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import { xlsxResponse } from '@/lib/export-http';
import { listCustomersForExport } from '@/lib/queries';

/**
 * Excel export of the customer list with the debt column (AUDIT.md T2).
 * `debtors=1` narrows it to the /debtors view (net debt > 0, largest first).
 */

const Query = z.object({
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  debtors: z.literal('1').optional().catch(undefined),
});

export async function GET(req: Request) {
  const { tenant } = await requireAdmin();

  const params = new URL(req.url).searchParams;
  const { q, debtors } = Query.parse({
    q: params.get('q') ?? undefined,
    debtors: params.get('debtors') ?? undefined,
  });
  const onlyDebtors = debtors === '1';

  const { rows, total } = await listCustomersForExport(tenant.id, {
    q,
    onlyDebtors,
  });

  const sheet = buildCustomersSheet(rows, {
    notice: truncationNotice(total, EXPORT_MAX_ROWS),
  });
  return xlsxResponse(sheet, onlyDebtors ? 'qarzdorlar' : 'mijozlar');
}
