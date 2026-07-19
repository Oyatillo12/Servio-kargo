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
