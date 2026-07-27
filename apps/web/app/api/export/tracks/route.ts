import { getLocale } from 'next-intl/server';
import { z } from 'zod';

import {
  EXPORT_FILE_BASE,
  EXPORT_MAX_ROWS,
  TRACK_STATUSES,
  TRACK_WORKLISTS,
  buildTracksSheet,
  truncationNotice,
  type Lang,
} from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import { xlsxResponse } from '@/lib/export-http';
import { listTracksForExport } from '@/lib/queries';

/**
 * Excel export of the tracks list (AUDIT.md T2), honouring the filters the
 * admin currently has on screen. The tenant comes from the session, never the
 * URL (CLAUDE.md rule 1); soft-deleted tracks are excluded (§7.8).
 */

// Each filter degrades to "no filter" on a bad value instead of erroring —
// exactly what /tracks does with an unknown status, so a stale link still works.
const Query = z.object({
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  status: z.enum(TRACK_STATUSES).optional().catch(undefined),
  batch: z.string().uuid().optional().catch(undefined),
  // The dashboard worklists (AUDIT.md T19) are filters like any other, so the
  // Excel button on `/tracks?work=…` has to carry them or the file would be
  // wider than the screen it came from.
  work: z.enum(TRACK_WORKLISTS).optional().catch(undefined),
});

export async function GET(req: Request) {
  const { tenant } = await requireAdmin();
  // The spreadsheet leaves the building — an owner forwards it to an
  // accountant — so it is written in the language the admin is working in.
  const lang = (await getLocale()) as Lang;

  const params = new URL(req.url).searchParams;
  const { q, status, batch, work } = Query.parse({
    q: params.get('q') ?? undefined,
    status: params.get('status') ?? undefined,
    batch: params.get('batch') ?? undefined,
    work: params.get('work') ?? undefined,
  });

  const { rows, total } = await listTracksForExport({
    tenantId: tenant.id,
    q,
    status,
    batchId: batch,
    work,
  });

  const sheet = buildTracksSheet(rows, {
    lang,
    notice: truncationNotice(total, EXPORT_MAX_ROWS, lang),
  });
  return xlsxResponse(sheet, EXPORT_FILE_BASE[lang].tracks);
}
