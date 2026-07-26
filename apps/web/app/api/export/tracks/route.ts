import { z } from 'zod';

import {
  EXPORT_MAX_ROWS,
  TRACK_STATUSES,
  buildTracksSheet,
  truncationNotice,
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
});

export async function GET(req: Request) {
  const { tenant } = await requireAdmin();

  const params = new URL(req.url).searchParams;
  const { q, status, batch } = Query.parse({
    q: params.get('q') ?? undefined,
    status: params.get('status') ?? undefined,
    batch: params.get('batch') ?? undefined,
  });

  const { rows, total } = await listTracksForExport({
    tenantId: tenant.id,
    q,
    status,
    batchId: batch,
  });

  const sheet = buildTracksSheet(rows, {
    notice: truncationNotice(total, EXPORT_MAX_ROWS),
  });
  return xlsxResponse(sheet, 'treklar');
}
