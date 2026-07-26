import { describe, expect, it } from 'vitest';

import {
  EXPORT_LABELS,
  EXPORT_MAX_ROWS,
  buildCustomersSheet,
  buildPaymentsSheet,
  buildTracksSheet,
  exportFileName,
  kgFromGrams,
  somFromTiyin,
  truncationNotice,
  type CustomerExportRow,
  type PaymentExportRow,
  type TrackExportRow,
} from './export';

// 26.07.2026 20:30 Tashkent = 15:30 UTC (UTC+5, no DST).
const AT = new Date('2026-07-26T15:30:00Z');

const track = (over: Partial<TrackExportRow> = {}): TrackExportRow => ({
  codeOriginal: 'YT-7583-01',
  currentStatus: 'READY_FOR_PICKUP',
  clientCode: 'DK-1042',
  customerName: 'Aziz Karimov',
  customerPhone: '+998 90 123-45-67',
  batchName: 'Reys #12',
  weightGrams: 1500,
  priceTiyin: 8_250_000,
  createdAt: AT,
  ...over,
});

const customer = (over: Partial<CustomerExportRow> = {}): CustomerExportRow => ({
  clientCode: 'DK-1042',
  fullName: 'Aziz Karimov',
  phone: '+998901234567',
  lang: 'uz',
  hasTelegram: true,
  trackCount: 3,
  debtTiyin: 12_500_000,
  createdAt: AT,
  ...over,
});

const payment = (over: Partial<PaymentExportRow> = {}): PaymentExportRow => ({
  createdAt: AT,
  clientCode: 'DK-1042',
  customerName: 'Aziz Karimov',
  customerPhone: '+998901234567',
  method: 'cash',
  amountTiyin: 5_000_000,
  note: 'oldindan',
  ...over,
});

describe('value conversion', () => {
  it('converts tiyin to whole som as a number', () => {
    // Numbers, not "1 250 000" strings — the column must be SUM-able in Excel.
    expect(somFromTiyin(125_000_000)).toBe(1_250_000);
    expect(somFromTiyin(0)).toBe(0);
    expect(somFromTiyin(null)).toBeNull();
  });

  it('rounds tiyin to the nearest som, matching formatSom', () => {
    expect(somFromTiyin(150)).toBe(2); // 1.5 som → 2
    expect(somFromTiyin(149)).toBe(1);
  });

  it('keeps an advance (negative debt) signed', () => {
    expect(somFromTiyin(-4_000_000)).toBe(-40_000);
  });

  it('converts grams to kg with at most 2 decimals', () => {
    expect(kgFromGrams(1500)).toBe(1.5);
    expect(kgFromGrams(25_000)).toBe(25);
    expect(kgFromGrams(300)).toBe(0.3);
    expect(kgFromGrams(1236)).toBe(1.24);
    expect(kgFromGrams(null)).toBeNull();
  });
});

describe('buildTracksSheet', () => {
  it('emits the header then one row per track', () => {
    const sheet = buildTracksSheet([track()]);
    expect(sheet.name).toBe('Treklar');
    expect(sheet.header).toEqual(EXPORT_LABELS.uz.tracks);
    expect(sheet.rows).toHaveLength(1);
    expect(sheet.rows[0]).toHaveLength(sheet.header.length);
  });

  it('shapes every column of a track row', () => {
    expect(buildTracksSheet([track()]).rows[0]).toEqual([
      'YT-7583-01',
      'Olib ketishga tayyor',
      'DK-1042',
      'Aziz Karimov',
      '+998 90 123-45-67',
      'Reys #12',
      1.5,
      82_500,
      '26.07.2026 20:30',
    ]);
  });

  it('leaves unassigned / unweighed fields empty rather than dashes', () => {
    const [row] = buildTracksSheet([
      track({
        clientCode: null,
        customerName: null,
        customerPhone: null,
        batchName: null,
        weightGrams: null,
        priceTiyin: null,
      }),
    ]).rows;
    expect(row).toEqual([
      'YT-7583-01',
      'Olib ketishga tayyor',
      null,
      null,
      null,
      null,
      null,
      null,
      '26.07.2026 20:30',
    ]);
  });

  it('renders dates in Asia/Tashkent, not UTC', () => {
    // 23:00 UTC is already the next Tashkent day.
    const [row] = buildTracksSheet([
      track({ createdAt: new Date('2026-07-26T23:00:00Z') }),
    ]).rows;
    expect(row![8]).toBe('27.07.2026 04:00');
  });

  it('localises status labels and headers to Russian', () => {
    const sheet = buildTracksSheet([track()], { lang: 'ru' });
    expect(sheet.name).toBe('Треки');
    expect(sheet.header).toEqual(EXPORT_LABELS.ru.tracks);
    expect(sheet.rows[0]![1]).toBe('Готов к выдаче');
  });

  it('handles an empty result set', () => {
    const sheet = buildTracksSheet([]);
    expect(sheet.rows).toEqual([]);
    expect(sheet.header.length).toBeGreaterThan(0);
  });
});

describe('buildCustomersSheet', () => {
  it('shapes every column of a customer row', () => {
    expect(buildCustomersSheet([customer()]).rows[0]).toEqual([
      'DK-1042',
      'Aziz Karimov',
      '+998901234567',
      'uz',
      'Ha',
      3,
      125_000,
      '26.07.2026 20:30',
    ]);
  });

  it('marks a hand-entered customer as not on Telegram', () => {
    const [row] = buildCustomersSheet([
      customer({ hasTelegram: false, fullName: null, phone: null }),
    ]).rows;
    expect(row![1]).toBeNull();
    expect(row![2]).toBeNull();
    expect(row![4]).toBe("Yo'q");
  });

  it('keeps an advance negative so the column still sums correctly', () => {
    const [row] = buildCustomersSheet([customer({ debtTiyin: -4_000_000 })]).rows;
    expect(row![6]).toBe(-40_000);
  });
});

describe('buildPaymentsSheet', () => {
  it('shapes every column and labels the method from the i18n catalogue', () => {
    expect(buildPaymentsSheet([payment()]).rows[0]).toEqual([
      '26.07.2026 20:30',
      'DK-1042',
      'Aziz Karimov',
      '+998901234567',
      'naqd',
      50_000,
      'oldindan',
    ]);
  });

  it('labels the method in Russian too', () => {
    const [row] = buildPaymentsSheet([payment({ method: 'click' })], {
      lang: 'ru',
    }).rows;
    expect(row![4]).toBe('Click');
  });

  it('leaves a missing note empty', () => {
    expect(buildPaymentsSheet([payment({ note: null })]).rows[0]![6]).toBeNull();
  });
});

describe('truncation', () => {
  it('is absent when everything fit', () => {
    expect(truncationNotice(100, 100)).toBeUndefined();
    expect(truncationNotice(5, 50_000)).toBeUndefined();
  });

  it('names both counts so a partial export is never silent', () => {
    const notice = truncationNotice(80_000, EXPORT_MAX_ROWS);
    expect(notice).toContain('80000');
    expect(notice).toContain(String(EXPORT_MAX_ROWS));
  });

  it('is carried onto the sheet the builder returns', () => {
    const notice = truncationNotice(80_000, EXPORT_MAX_ROWS)!;
    expect(buildTracksSheet([], { notice }).notice).toBe(notice);
  });

  it('exists in Russian as well', () => {
    expect(truncationNotice(80_000, EXPORT_MAX_ROWS, 'ru')).toContain('80000');
  });
});

describe('exportFileName', () => {
  it('stamps the Tashkent calendar day', () => {
    expect(exportFileName('treklar', AT)).toBe('treklar-2026-07-26.xlsx');
  });

  it('uses the Tashkent day, not the UTC day', () => {
    expect(exportFileName('treklar', new Date('2026-07-26T23:00:00Z'))).toBe(
      'treklar-2026-07-27.xlsx',
    );
  });
});

describe('label catalogues', () => {
  it('covers both languages with matching column counts', () => {
    for (const key of ['tracks', 'customers', 'payments'] as const) {
      expect(EXPORT_LABELS.ru[key]).toHaveLength(EXPORT_LABELS.uz[key].length);
      for (const label of [...EXPORT_LABELS.uz[key], ...EXPORT_LABELS.ru[key]]) {
        expect(label.trim()).not.toBe('');
      }
    }
  });

  it('keeps sheet names within the Excel 31-char limit and free of "[]:*?/\\"', () => {
    for (const lang of ['uz', 'ru'] as const) {
      for (const name of Object.values(EXPORT_LABELS[lang].sheet)) {
        expect(name.length).toBeLessThanOrEqual(31);
        expect(name).not.toMatch(/[[\]:*?/\\]/);
      }
    }
  });
});
