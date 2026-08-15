import { describe, expect, it } from 'vitest';

import {
  classifyMappedRows,
  customerRefKeys,
  detectImportLayout,
  parseImportPrice,
  parseImportWeight,
  planImportPricing,
  type ColumnMapping,
} from './importMapping';

describe('parseImportWeight', () => {
  it('reads kg with either decimal mark', () => {
    expect(parseImportWeight('1.5')).toBe(1500);
    expect(parseImportWeight('1,5')).toBe(1500);
    expect(parseImportWeight('3')).toBe(3000);
  });

  it('reads unit suffixes and grouped digits', () => {
    expect(parseImportWeight('2 kg')).toBe(2000);
    expect(parseImportWeight('2кг')).toBe(2000);
    expect(parseImportWeight('800 g')).toBe(800);
    expect(parseImportWeight('1 500')).toBe(1_500_000);
  });

  it('rejects blanks, zero, text and absurd weights', () => {
    expect(parseImportWeight('')).toBeNull();
    expect(parseImportWeight('0')).toBeNull();
    expect(parseImportWeight('yoq')).toBeNull();
    expect(parseImportWeight('-2')).toBeNull();
    expect(parseImportWeight('200000')).toBeNull(); // 200 t
  });
});

describe('parseImportPrice', () => {
  it('reads grouped so’m into tiyin', () => {
    expect(parseImportPrice('150000')).toBe(15_000_000);
    expect(parseImportPrice('150 000')).toBe(15_000_000);
    expect(parseImportPrice('150.000')).toBe(15_000_000);
    expect(parseImportPrice('150,000')).toBe(15_000_000);
    expect(parseImportPrice("150 000 so'm")).toBe(15_000_000);
  });

  it('treats 1-2 trailing digits as a fraction', () => {
    expect(parseImportPrice('1 500,50')).toBe(150_050);
    expect(parseImportPrice('1.500,5')).toBe(150_050);
    expect(parseImportPrice('12,3')).toBe(1230);
  });

  it('refuses dollar amounts rather than guessing', () => {
    expect(parseImportPrice('$12')).toBeNull();
    expect(parseImportPrice('12 usd')).toBeNull();
  });

  it('rejects blanks, zero and text', () => {
    expect(parseImportPrice('')).toBeNull();
    expect(parseImportPrice('0')).toBeNull();
    expect(parseImportPrice('kelishilgan')).toBeNull();
  });
});

describe('customerRefKeys', () => {
  it('classifies a client code', () => {
    const k = customerRefKeys('DK-1042')!;
    expect(k.codeKey).toBe('DK1042');
    expect(k.phoneKey).toBeNull();
    expect(k.nameKey).toBeNull();
  });

  it('classifies a phone in any spelling', () => {
    expect(customerRefKeys('+998 90 123-45-67')!.phoneKey).toBe('901234567');
    expect(customerRefKeys('901234567')!.phoneKey).toBe('901234567');
  });

  it('classifies a name, and keeps both keys for name + phone cells', () => {
    expect(customerRefKeys('  Alisher   Valiyev ')!.nameKey).toBe(
      'alisher valiyev',
    );
    const mixed = customerRefKeys('Alisher +998901234567')!;
    expect(mixed.phoneKey).toBe('901234567');
    expect(mixed.nameKey).toBe('alisher +998901234567');
  });

  it('returns null for a blank cell', () => {
    expect(customerRefKeys('   ')).toBeNull();
  });
});

describe('detectImportLayout', () => {
  it('maps a labelled header', () => {
    const layout = detectImportLayout([
      ['Trek kodi', 'Mijoz', 'Kg', 'Narx'],
      ['YT1000000001', 'DK-1042', '1,5', '150 000'],
    ]);
    expect(layout.hasHeader).toBe(true);
    expect(layout.mapping).toEqual({
      code: 0,
      customer: 1,
      weight: 2,
      price: 3,
      description: null,
    });
  });

  it('maps a realistic manifest with a наименование column (H1)', () => {
    const layout = detectImportLayout([
      ['Трек', 'Марка клиента', 'Кг', 'Наименование товара'],
      ['YT1000000001', 'DK-1042', '1,5', 'чёрные футболки, 2 кор.'],
    ]);
    expect(layout.hasHeader).toBe(true);
    expect(layout.mapping).toEqual({
      code: 0,
      customer: 1,
      weight: 2,
      price: null,
      description: 3,
    });
  });

  it('claims an English "Item name" column as description, not customer', () => {
    // `name` is a customer keyword; DETECT_ORDER tests description first so a
    // goods column is not mistaken for an owner column.
    const layout = detectImportLayout([
      ['Track', 'Item name', 'Client'],
      ['YT1000000001', 'black t-shirts', 'DK-1042'],
    ]);
    expect(layout.mapping?.description).toBe(1);
    expect(layout.mapping?.customer).toBe(2);
  });

  it('falls back to the column that holds codes when there is no header', () => {
    const layout = detectImportLayout([
      ['Alisher', 'YT1000000001', '2'],
      ['Bobur', 'YT1000000002', '3'],
    ]);
    expect(layout.hasHeader).toBe(false);
    expect(layout.mapping?.code).toBe(1);
  });

  it('reports no mapping when nothing looks like a code', () => {
    expect(detectImportLayout([['a', 'b']]).mapping).toBeNull();
  });
});

describe('classifyMappedRows', () => {
  const mapping: ColumnMapping = {
    code: 0,
    customer: 1,
    weight: 2,
    price: 3,
    description: 4,
  };

  it('keeps a row whose kg cell is unreadable, and warns', () => {
    const res = classifyMappedRows(
      [
        ['Kod', 'Mijoz', 'Kg', 'Narx'],
        ['yt-1000 000 001', 'DK-1042', 'ogir', '150000'],
      ],
      mapping,
      true,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.normalized).toBe('YT1000000001');
    expect(res.rows[0]!.weightGrams).toBeNull();
    expect(res.rows[0]!.priceTiyin).toBe(15_000_000);
    expect(res.warnings).toEqual([{ line: 2, field: 'weight', value: 'ogir' }]);
  });

  it('rejects a bad code row and drops in-file duplicates', () => {
    const res = classifyMappedRows(
      [
        ['SF123', '', '', ''],
        ['YT1000000001', '', '', ''],
        ['yt 1000 000 001', '', '', ''],
      ],
      mapping,
      false,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.malformed).toEqual([{ line: 1, text: 'SF123' }]);
    expect(res.duplicateCount).toBe(1);
  });

  it('keeps a description cell as typed and blanks as null (§7.13)', () => {
    const res = classifyMappedRows(
      [
        ['YT1000000001', 'DK-1042', '1,5', '', 'qora ko‘ylak, 2 quti'],
        ['YT1000000002', '', '', '', '-'],
      ],
      mapping,
      false,
    );
    expect(res.rows[0]!.description).toBe('qora ko‘ylak, 2 quti');
    // The owner cell keeps its code shape → doubles as the marka upstream.
    expect(res.rows[0]!.customerRef?.codeKey).toBe('DK1042');
    expect(res.rows[1]!.description).toBeNull();
    expect(res.warnings).toEqual([]);
  });
});

describe('planImportPricing', () => {
  const uzs = {
    currency: 'UZS' as const,
    usdRateTiyin: null,
    tariff: { id: 't1', pricePerKgMinor: 3_500_000 }, // 35 000 so'm/kg
  };

  it('stores a file price as a manual override', () => {
    const plan = planImportPricing(
      { weightGrams: 1500, priceTiyin: 9_000_000 },
      uzs,
    )!;
    expect(plan.priceManual).toBe(true);
    expect(plan.priceTiyin).toBe(9_000_000);
    expect(plan.tariffId).toBe('t1');
  });

  it('computes kg × tariff when the file carries no price', () => {
    const plan = planImportPricing(
      { weightGrams: 1500, priceTiyin: null },
      uzs,
    )!;
    expect(plan.priceManual).toBe(false);
    expect(plan.priceTiyin).toBe(5_250_000); // 1.5 kg × 35 000 so'm
  });

  it('freezes the rate for a USD tenant', () => {
    const plan = planImportPricing(
      { weightGrams: 1000, priceTiyin: null },
      {
        currency: 'USD',
        usdRateTiyin: 1_250_000, // 12 500 so'm per $
        tariff: { id: 't1', pricePerKgMinor: 300 }, // $3/kg
      },
    )!;
    expect(plan.priceUsdCents).toBe(300);
    expect(plan.usdRateUsed).toBe(1_250_000);
    expect(plan.priceTiyin).toBe(3_750_000);
  });

  it('keeps the weight but no price when the tenant has no tariff', () => {
    const plan = planImportPricing(
      { weightGrams: 1000, priceTiyin: null },
      { currency: 'UZS', usdRateTiyin: null, tariff: null },
    )!;
    expect(plan.weightGrams).toBe(1000);
    expect(plan.priceTiyin).toBeNull();
  });

  it('writes nothing when the row has neither kg nor price', () => {
    expect(
      planImportPricing({ weightGrams: null, priceTiyin: null }, uzs),
    ).toBeNull();
  });
});
