/**
 * Spreadsheet I/O: parsing for import (SPEC §5.4) and writing for export
 * (AUDIT.md T2). Row shaping lives in `@kargotrack/shared` — this module only
 * knows about the file format.
 */

import 'server-only';

import * as XLSX from 'xlsx';

import {
  MAX_CELL_LENGTH,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  type ExportSheet,
} from '@kargotrack/shared';

export interface XlsxGrid {
  /** Row-major cells, trimmed strings, blanks kept so row numbers stay true. */
  rows: string[][];
  /** Sheet the grid was read from — shown so the admin can spot a wrong tab. */
  sheetName: string;
  /** True when the file had more rows than {@link MAX_IMPORT_ROWS}. */
  truncated: boolean;
}

/**
 * Read an .xlsx buffer as a GRID (SPEC §5.4 column mapping), not as a bag of
 * cells: the mapping step needs to know which column a value sat in.
 *
 * Cells are read formatted (`raw: false`) so a code stored as a number comes
 * back as `775123456789` rather than `7.75123e+11`, and `1,5` keeps the
 * separator the file showed. Blank rows are KEPT so a row number in the preview
 * matches the row number in Excel; trailing blank rows are trimmed.
 *
 * Only the first sheet that holds data is read — a workbook's second tab is
 * almost always last month's flight, and importing it silently would be worse
 * than ignoring it.
 */
export function readXlsxGrid(buffer: Buffer): XlsxGrid {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: true,
      defval: '',
      raw: false,
    });

    const rows: string[][] = raw
      .slice(0, MAX_IMPORT_ROWS)
      .map((row) =>
        (row ?? [])
          .slice(0, MAX_IMPORT_COLUMNS)
          .map((cell) =>
            cell == null ? '' : String(cell).trim().slice(0, MAX_CELL_LENGTH),
          ),
      );
    while (rows.length > 0 && rows[rows.length - 1]!.every((c) => c === '')) {
      rows.pop();
    }
    if (rows.length === 0) continue;

    return { rows, sheetName, truncated: raw.length > MAX_IMPORT_ROWS };
  }

  return { rows: [], sheetName: '', truncated: false };
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
    ws['!cols'] = columnWidths(sheet.header, sheet.rows).map((wch) => ({
      wch,
    }));
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
