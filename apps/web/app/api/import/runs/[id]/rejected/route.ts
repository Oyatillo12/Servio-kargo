import { getLocale } from 'next-intl/server';
import { z } from 'zod';

import {
  EXPORT_FILE_BASE,
  EXPORT_LABELS,
  MAX_REJECTED_ROWS,
  buildRejectedSheet,
  type Lang,
} from '@kargotrack/shared';

import { requireCapability } from '@/lib/auth';
import { xlsxResponse } from '@/lib/export-http';
import { getImportRunRejected } from '@/lib/queries';

/**
 * The rows an import could not use, as an .xlsx (SPEC §7.18, tasks.md M3).
 *
 * A route handler rather than a Server Action because it returns a file. The
 * run id comes from the URL but the tenant comes from the session (rule 1), so
 * one tenant's run id is a 404 for another.
 *
 * Guarded by `import.run`: whoever may import may see what the file could not
 * deliver — that is the same piece of work.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { tenant } = await requireCapability('import.run');
  const { id } = params;
  if (!z.string().uuid().safeParse(id).success) {
    return new Response('Not found', { status: 404 });
  }

  const run = await getImportRunRejected(tenant.id, id);
  if (!run) return new Response('Not found', { status: 404 });

  // The file leaves the building — it goes to the Guangzhou office — so it is
  // written in the language the admin is working in (§5.11's stance).
  const lang = (await getLocale()) as Lang;
  const sheet = buildRejectedSheet(run.rows, {
    lang,
    // Never silently partial: the run stored the first 1 000 problem rows.
    notice:
      run.total > run.rows.length
        ? EXPORT_LABELS[lang].rejectedTruncated(run.total, MAX_REJECTED_ROWS)
        : undefined,
  });
  return xlsxResponse(sheet, EXPORT_FILE_BASE[lang].rejected);
}
