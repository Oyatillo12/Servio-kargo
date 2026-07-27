import { getLocale } from 'next-intl/server';
import { z } from 'zod';

import {
  EXPORT_FILE_BASE,
  EXPORT_MAX_ROWS,
  buildPaymentsSheet,
  truncationNotice,
  type Lang,
} from '@kargotrack/shared';

import { requireCapability } from '@/lib/auth';
import { xlsxResponse } from '@/lib/export-http';
import { listPaymentsForExport } from '@/lib/queries';

/**
 * Excel export of the payment ledger (AUDIT.md T2). `customer=<uuid>` narrows
 * it to one customer's statement; the query stays tenant-scoped either way, so
 * another tenant's customer id simply matches nothing.
 */

const Query = z.object({
  customer: z.string().uuid().optional().catch(undefined),
});

export async function GET(req: Request) {
  const { tenant } = await requireCapability('export.data');
  const lang = (await getLocale()) as Lang;

  const params = new URL(req.url).searchParams;
  const { customer } = Query.parse({
    customer: params.get('customer') ?? undefined,
  });

  const { rows, total } = await listPaymentsForExport(tenant.id, {
    customerId: customer,
  });

  const sheet = buildPaymentsSheet(rows, {
    lang,
    notice: truncationNotice(total, EXPORT_MAX_ROWS, lang),
  });
  return xlsxResponse(sheet, EXPORT_FILE_BASE[lang].payments);
}
