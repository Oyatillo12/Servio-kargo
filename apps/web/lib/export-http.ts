/**
 * HTTP plumbing shared by the three `/api/export/*` handlers (AUDIT.md T2):
 * render sheets to .xlsx and hand them back as a download.
 */

import 'server-only';

import { exportFileName, type ExportSheet } from '@kargotrack/shared';

import { writeXlsx } from './xlsx';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * A one-sheet .xlsx download. `baseName` must be ASCII — a non-ASCII plain
 * `filename=` is mangled by some browsers, and the alternative (`filename*`
 * RFC 5987 encoding) buys nothing here since every export name transliterates
 * cleanly (treklar, mijozlar, qarzdorlar, tolovlar).
 *
 * `no-store`: the file contains the tenant's whole customer list, so it must
 * never sit in a shared proxy cache or in the browser's back-forward cache.
 */
export function xlsxResponse(sheet: ExportSheet, baseName: string): Response {
  const buf = writeXlsx([sheet]);
  const filename = exportFileName(baseName, new Date());
  // Node's `Buffer<ArrayBufferLike>` isn't assignable to the DOM `BodyInit`;
  // a plain view over the same bytes is what the web `Response` wants.
  const body = Uint8Array.from(buf);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
