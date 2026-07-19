/**
 * Spreadsheet parsing for import (SPEC §5.4). Extracts every non-empty cell as a
 * candidate token from all sheets; classification into valid/malformed happens
 * in the shared parser. Header cells that happen to normalize to a valid code
 * are caught by the admin at the preview step.
 */

import 'server-only';

import * as XLSX from 'xlsx';

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
