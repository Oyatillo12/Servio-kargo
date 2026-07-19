/**
 * Uzbek (Latin) strings — the default locale. Texts are canonical per SPEC §4;
 * do not paraphrase the ones quoted verbatim in the spec.
 */

import type { Strings } from './index';

export const uz: Strings = {
  // --- §4.1 ---
  welcome: (tenantName) =>
    `Assalomu alaykum! ${tenantName} botiga xush kelibsiz.\nTilni tanlang / Выберите язык:`,
  askPhone: "Ro'yxatdan o'tish uchun telefon raqamingizni yuboring 👇",
  askPhoneButton: '📱 Raqamni yuborish',
  registered: (clientCode) =>
    `Tayyor! Sizning mijoz kodingiz: ${clientCode}\n\nEndi trek kodlaringizni yuboring — bir nechtasini birdaniga, har birini alohida qatorda yozsangiz ham bo'ladi.`,
  askTracks: 'Trek kodlarini yuboring (bir nechtasini birdan yozish mumkin):',
  noTracks:
    "Hozircha yuklaringiz yo'q. ➕ Trek qo'shish tugmasi orqali trek kodingizni yuboring.",
  helpFallback:
    'Tushunmadim 🤔 Trek kodini yuboring yoki quyidagi menyudan foydalaning.',
  errorGeneric: "Xatolik yuz berdi, birozdan so'ng qayta urinib ko'ring.",

  // --- §3.1 menu labels ---
  menuAddTrack: "➕ Trek qo'shish",
  menuMyTracks: '📦 Mening yuklarim',
  menuCalculator: '🧮 Kalkulyator',
  menuBalance: '💰 Balans',
  menuChinaAddress: '🇨🇳 Ombor manzili',
  menuInfo: "ℹ️ Ma'lumot",
  menuLang: '🌐 Til / Язык',

  // --- §4.3 add-track summary ---
  summaryAdded: (n, codes) => `✅ Qo'shildi (${n}): ${codes}`,
  summaryClaimed: (n, codes) => `♻️ Sizga biriktirildi (${n}): ${codes}`,
  summaryOtherOwner: (n, codes) =>
    `⛔ Boshqa mijozga tegishli (${n}): ${codes}`,
  summaryBadFormat: (n, lines) => `❌ Noto'g'ri format (${n}): ${lines}`,
  addNothingNew: "Yangi trek qo'shilmadi.",

  // --- §3.3 my tracks ---
  myTracksHeader: '📦 Mening yuklarim:',
  readyDetail: ({ kg, som }) => ` — ${kg} kg, ${som} so'm`,
  pageIndicator: (page, pages) => `Sahifa ${page}/${pages}`,

  // --- §3.4 balance ---
  balanceDebt: (som) => `💰 Qarzingiz: ${som} so'm`,
  balanceAdvance: (som) => `💰 Avans: ${som} so'm`,
  balanceZero: "💰 Qarzingiz yo'q. ✅",
  paymentsHeader: "Oxirgi to'lovlar:",
  noPayments: "To'lovlar tarixi hozircha bo'sh.",
  paymentLine: (date, som, method) => `${date} — ${som} so'm (${method})`,
  paymentMethod: {
    cash: 'naqd',
    click: 'Click',
    payme: 'Payme',
    other: 'boshqa',
  },

  // --- §3.5 info ---
  infoCard: ({ tariffLines, usdRateSom, address, hours, phone, infoText }) => {
    const lines = ["ℹ️ Ma'lumot"];
    if (tariffLines.length > 0) {
      lines.push('', '💵 Tariflar:');
      for (const line of tariffLines) lines.push(line);
    }
    if (usdRateSom) lines.push('', `Kurs: 1$ = ${usdRateSom} so'm`);
    if (address || hours || phone) {
      lines.push('');
      if (address) lines.push(`📍 Manzil: ${address}`);
      if (hours) lines.push(`🕘 Ish vaqti: ${hours}`);
      if (phone) lines.push(`📞 Aloqa: ${phone}`);
    }
    if (infoText) lines.push('', infoText);
    return lines.join('\n');
  },

  // --- §3.6 lookup ---
  lookupCard: ({
    code,
    statusEmoji,
    statusLabel,
    date,
    batchName,
    batchEta,
    kg,
    som,
  }) => {
    const lines = [
      `🔍 ${code}`,
      `Holat: ${statusEmoji} ${statusLabel}`,
      `Sanasi: ${date}`,
    ];
    if (batchName) {
      lines.push(
        batchEta
          ? `🚚 Reys: ${batchName} · Taxminan: ${batchEta}`
          : `🚚 Reys: ${batchName}`,
      );
    }
    if (kg != null) lines.push(`⚖️ Og'irligi: ${kg} kg`);
    if (som != null) lines.push(`💵 To'lov: ${som} so'm`);
    return lines.join('\n');
  },
  lookupNotFound: (code) => `🔍 ${code} — bunday trek topilmadi.`,

  // --- §3.9 calculator (§4.5) ---
  calcChooseTariff: 'Tarifni tanlang:',
  calcAskKg: "Og'irlikni kiriting (kg), masalan: 3.2",
  calcResult: ({ tariffName, kg, som, usd }) =>
    `🧮 ${tariffName}\n${kg} kg ≈ ${som} so'm${usd ? ` (${usd})` : ''}\n\nAniq summa yuk tortilganda hisoblanadi.`,
  calcInvalid: 'Raqam kiriting, masalan: 2.5',

  // --- §3.10 China warehouse address (§4.5) ---
  chinaAddrHeader:
    '🇨🇳 Xitoy ombori manzili — sotuvchiga (постовщик) shuni yuboring:',
  chinaAddrFooter: (clientCode) =>
    `❗️ Har bir qutiga shu kodni yozdirishni unutmang: ${clientCode}`,
  chinaAddrMissing: (contactPhone) =>
    `Manzil hali kiritilmagan. Administrator bilan bog'laning: ${contactPhone}`,

  // --- §3.7 ---
  langSwitched: "Til o'zgartirildi ✅",

  // --- §3.8 staff mode (weighing + photo) / §4.5 staff strings ---
  staffPhotoNoCaption:
    "Rasmni yuborishda izoh (caption) sifatida trek kodini yozing.",
  staffSaved: (code, kg, som) => `✅ ${code}: ${kg} kg → ${som} so'm`,
  staffSavedNew: (code, kg, som) =>
    `🆕 ${code}: yangi trek yaratildi (${kg} kg → ${som} so'm). Mijoz hali biriktirilmagan.`,
  staffPhotoOk: (code) => `📷 ${code}: rasm biriktirildi.`,
  staffNotFound: (code) =>
    `❓ ${code} topilmadi. Vazn bilan yuborsangiz, yangi trek sifatida yarataman, masalan: ${code} 3.2`,
  staffPhotoTooLarge: (maxMb) =>
    `❌ Rasm hajmi juda katta. Ruxsat etilgan eng katta hajm — ${maxMb} MB.`,
  staffPhotoError: "Rasmni yuklab bo'lmadi, birozdan so'ng qayta urinib ko'ring.",

  // --- §4.2 notifications ---
  notifChinaWarehouse: (code) =>
    `📦 ${code} — yukingiz Xitoy omboriga qabul qilindi.`,
  notifInTransit: (code, eta) =>
    `🚚 ${code} — yukingiz yo'lga chiqdi.` +
    (eta ? `\n📅 Taxminiy yetib kelishi: ${eta}` : ''),
  notifTashkentWarehouse: (code) =>
    `🇺🇿 ${code} — yukingiz Toshkentga yetib keldi. Tez orada olib ketishga tayyor bo'ladi.`,
  notifReadyForPickup: ({ code, kg, som, pickupAddress, workingHours }) => {
    const lines = [`✅ ${code} — yukingiz tayyor!`];
    if (kg != null) lines.push(`⚖️ Og'irligi: ${kg} kg`);
    if (som != null) lines.push(`💵 To'lov: ${som} so'm`);
    lines.push(`📍 Manzil: ${pickupAddress}`);
    lines.push(`🕘 Ish vaqti: ${workingHours}`);
    return lines.join('\n');
  },
  notifDelivered: (code) =>
    `🎉 ${code} — yukingiz topshirildi. Xaridingiz muborak bo'lsin!`,
  notifSideState: (code, statusLabel, contactPhone) =>
    `⚠️ ${code} bo'yicha holat: ${statusLabel}. Batafsil ma'lumot uchun biz bilan bog'laning: ${contactPhone}`,

  // --- §4.4 ---
  debtReminder: (name, tenantName, debtSom, contactPhone) =>
    `Assalomu alaykum, ${name}! ${tenantName} bo'yicha qarzingiz: ${debtSom} so'm.\nIltimos, to'lovni amalga oshiring. Savol bo'lsa shu botga yozing yoki qo'ng'iroq qiling: ${contactPhone}`,
};
