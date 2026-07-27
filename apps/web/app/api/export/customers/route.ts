import { getLocale } from 'next-intl/server';
import { z } from 'zod';

import {
  EXPORT_FILE_BASE,
  EXPORT_MAX_ROWS,
  buildCustomersSheet,
  truncationNotice,
  type Lang,
} from '@kargotrack/shared';

import { requireCapability } from '@/lib/auth';
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
  const { tenant } = await requireCapability('export.data');
  const lang = (await getLocale()) as Lang;

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
    lang,
    notice: truncationNotice(total, EXPORT_MAX_ROWS, lang),
  });
  return xlsxResponse(
    sheet,
    EXPORT_FILE_BASE[lang][onlyDebtors ? 'debtors' : 'customers'],
  );
}
