import { describe, expect, it } from 'vitest';

import { ru, statusNotification, t, uz } from './index';

describe('menu labels (SPEC §3.1)', () => {
  it('uz labels are exact', () => {
    expect(uz.menuAddTrack).toBe("➕ Trek qo'shish");
    expect(uz.menuMyTracks).toBe('📦 Mening yuklarim');
    expect(uz.menuBalance).toBe('💰 Balans');
    expect(uz.menuInfo).toBe("ℹ️ Ma'lumot");
    expect(uz.menuLang).toBe('🌐 Til / Язык');
  });

  it('ru labels are exact', () => {
    expect(ru.menuAddTrack).toBe('➕ Добавить трек');
    expect(ru.menuMyTracks).toBe('📦 Мои посылки');
    expect(ru.menuBalance).toBe('💰 Баланс');
    expect(ru.menuInfo).toBe('ℹ️ Информация');
    expect(ru.menuLang).toBe('🌐 Til / Язык');
  });
});

describe('canonical §4.1 texts', () => {
  it('registered embeds the client code', () => {
    expect(uz.registered('DK-1042')).toContain('DK-1042');
    expect(uz.registered('DK-1042')).toContain('mijoz kodingiz');
  });
});

describe('t(lang)', () => {
  it('selects the right catalogue and defaults to uz', () => {
    expect(t('uz')).toBe(uz);
    expect(t('ru')).toBe(ru);
  });
});

describe('statusNotification builder (§4.2)', () => {
  const vars = {
    code: 'AB12345678',
    pickupAddress: 'Chilonzor 1',
    workingHours: '09:00–18:00',
    statusLabel: "Yo'qolgan",
    contactPhone: '+998901112233',
  };

  it('returns null for CREATED (no notification)', () => {
    expect(statusNotification(uz, 'CREATED', vars)).toBeNull();
  });

  it('builds a READY_FOR_PICKUP message, omitting unset weight/price lines', () => {
    const msg = statusNotification(uz, 'READY_FOR_PICKUP', vars)!;
    expect(msg).toContain('AB12345678 — yukingiz tayyor!');
    expect(msg).toContain('📍 Manzil: Chilonzor 1');
    expect(msg).not.toContain("Og'irligi");
  });

  it('includes weight/price lines when set', () => {
    const msg = statusNotification(uz, 'READY_FOR_PICKUP', {
      ...vars,
      kg: '1.5',
      som: '82 500',
    })!;
    expect(msg).toContain("⚖️ Og'irligi: 1.5 kg");
    expect(msg).toContain("💵 To'lov: 82 500 so'm");
  });

  it('uses the side-state template for LOST', () => {
    const msg = statusNotification(uz, 'LOST', vars)!;
    expect(msg).toContain("holat: Yo'qolgan");
    expect(msg).toContain('+998901112233');
  });
});

describe('volumetric weight is never a bare number (§7.16, D-007)', () => {
  const vars = {
    code: 'AB12345678',
    pickupAddress: 'Chilonzor 1',
    workingHours: '09:00–18:00',
    statusLabel: '',
    contactPhone: '+998901112233',
  };

  it('the ready notification names both weights and the reason', () => {
    const msg = statusNotification(uz, 'READY_FOR_PICKUP', {
      ...vars,
      kg: '10.02',
      actualKg: '5.2',
      som: '300 600',
    })!;
    expect(msg).toContain('10.02 kg');
    expect(msg).toContain('hajmiy');
    expect(msg).toContain('5.2 kg');

    const ruMsg = statusNotification(ru, 'READY_FOR_PICKUP', {
      ...vars,
      kg: '10.02',
      actualKg: '5.2',
      som: '300 600',
    })!;
    expect(ruMsg).toContain('объёмный');
    expect(ruMsg).toContain('5.2 кг');
  });

  it('says plain weight when the scale won — no unexplained label', () => {
    const msg = statusNotification(uz, 'READY_FOR_PICKUP', {
      ...vars,
      kg: '5.2',
      som: '156 000',
    })!;
    expect(msg).toContain("⚖️ Og'irligi: 5.2 kg");
    expect(msg).not.toContain('hajmiy');
  });

  it('the lookup card follows the same rule in both languages', () => {
    const card = uz.lookupCard({
      code: 'AB12345678',
      statusEmoji: '📦',
      statusLabel: 'Xitoy omborida',
      date: '16.08.2026',
      kg: '10.02',
      actualKg: '5.2',
      som: '300 600',
    });
    expect(card).toContain('Hisob vazni: 10.02 kg (hajmiy)');
    expect(card).toContain('haqiqiy 5.2 kg');

    expect(
      ru.lookupCard({
        code: 'AB12345678',
        statusEmoji: '📦',
        statusLabel: 'На складе в Китае',
        date: '16.08.2026',
        kg: '10.02',
        som: '300 600',
      }),
    ).toContain('⚖️ Вес: 10.02 кг');
  });

  it('the calculator answers with the reason only when volume won', () => {
    const withVolume = uz.calcResult({
      tariffName: 'Avia',
      kg: '10.02',
      som: '300 600',
      actualKg: '3.2',
    });
    expect(withVolume).toContain('hajmiy');
    expect(withVolume).toContain('haqiqiy 3.2 kg');

    const plain = uz.calcResult({
      tariffName: 'Avia',
      kg: '3.2',
      som: '96 000',
    });
    expect(plain).not.toContain('hajmiy');
    expect(plain).toContain('3.2 kg ≈ 96 000');
  });

  it('both catalogues number the calculator steps 1/3 … 3/3', () => {
    expect(uz.calcStepTariff).toContain('1/3');
    expect(uz.calcStepKg).toContain('2/3');
    expect(uz.calcStepDims).toContain('3/3');
    expect(ru.calcStepTariff).toContain('1/3');
    expect(ru.calcStepKg).toContain('2/3');
    expect(ru.calcStepDims).toContain('3/3');
  });
});

describe('readyDetail keeps kg and so\'m consistent (§3.3, §7.16)', () => {
  it('marks the line volumetric so the arithmetic adds up', () => {
    expect(uz.readyDetail({ kg: '10.02', actualKg: '5.2', som: '300 600' })).toBe(
      " — 10.02 kg (hajmiy), 300 600 so'm",
    );
    expect(ru.readyDetail({ kg: '10.02', actualKg: '5.2', som: '300 600' })).toContain(
      'объёмный',
    );
  });

  it('stays exactly as before when the scale won', () => {
    expect(uz.readyDetail({ kg: '1.5', som: '82 500' })).toBe(
      " — 1.5 kg, 82 500 so'm",
    );
  });
});
