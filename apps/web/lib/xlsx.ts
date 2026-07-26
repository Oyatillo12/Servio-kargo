/**
 * Spreadsheet I/O: parsing for import (SPEC §5.4) and writing for export
 * (AUDIT.md T2). Row shaping lives in `@kargotrack/shared` — this module only
 * knows about the file format.
 */

import 'server-only';

import * as XLSX from 'xlsx';

import type { ExportSheet } from '@kargotrack/shared';

/** Read an .xlsx buffer and return all non-empty cell values as strings. */
export function readXlsxCandidates(buffer: Buffer): string[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const out: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
    });
    for (const row of rows) {
      for (const cell of row) {
        if (cell == null) continue;
        const str = String(cell).trim();
        if (str) out.push(str);
      }
    }
  }
  return out;
}

// --- Export (AUDIT.md T2) ---------------------------------------------------

/** Roomy-but-bounded column width, in characters, derived from the content. */
function columnWidths(header: string[], rows: readonly unknown[][]): number[] {
  return header.map((label, col) => {
    let widest = label.length;
    for (const row of rows) {
      const cell = row[col];
      if (cell == null) continue;
      const len = String(cell).length;
      if (len > widest) widest = len;
    }
    return Math.min(Math.max(widest + 2, 8), 40);
  });
}

/**
 * Render sheets to an .xlsx buffer.
 *
 * Cells are written through `aoa_to_sheet`, which types every string as a
 * string (`t: 's'`) — never a formula. That is what makes a track code such as
 * `=cmd|...` inert here, unlike a CSV export, so imported codes go out
 * unmangled.
 */
export function writeXlsx(sheets: readonly ExportSheet[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa: unknown[][] = [sheet.header, ...sheet.rows];
    // A capped export says so in the file itself, one blank row below the data.
    if (sheet.notice) aoa.push([], [sheet.notice]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = columnWidths(sheet.header, sheet.rows).map((wch) => ({ wch }));
    // Header filter dropdowns — the owner's first move is "show me only
    // Topshirildi". Covers the data rows only, never the notice row.
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: sheet.rows.length, c: Math.max(sheet.header.length - 1, 0) },
      }),
    };
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
