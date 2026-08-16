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
  askTracks:
    "Trek kodlarini yuboring 👇\nBir nechtasini birdaniga yuborsangiz ham bo'ladi — har birini yangi qatorga yozing.",
  noTracks:
    "Hozircha yuklaringiz yo'q. ➕ Trek qo'shish tugmasi orqali trek kodingizni yuboring.",
  helpFallback:
    "Tushunmadim 🤔\nTrek kodini yuboring yoki quyidagi tugmalardan birini tanlang.",
  errorGeneric: "Xatolik yuz berdi, birozdan so'ng qayta urinib ko'ring.",

  // --- §3.1 menu labels ---
  menuAddTrack: "➕ Trek qo'shish",
  menuMyTracks: '📦 Mening yuklarim',
  menuCalculator: '🧮 Kalkulyator',
  menuBalance: '💰 Balans',
  menuChinaAddress: '🇨🇳 Ombor manzili',
  menuInfo: "ℹ️ Ma'lumot",
  menuLang: '🌐 Til / Язык',
  menuTicket: '✍️ Murojaat',
  // Premium only: the reply-keyboard entry into the Mini App (tasks.md B7).
  menuCabinet: '📱 Kabinet',

  // --- Telegram command-menu descriptions (setMyCommands) ---
  commands: {
    start: "Boshlash / Ro'yxatdan o'tish",
    mytracks: 'Mening yuklarim',
    balance: 'Balans va qarz',
    calc: 'Narx kalkulyatori',
    info: "Ma'lumot",
    manzil: 'Xitoy ombori manzili',
    help: 'Bot qanday ishlaydi',
  },

  // --- §3.11 inline navigation ---
  nav: {
    backToList: "⬅️ Ro'yxatga qaytish",
    refresh: '🔄 Yangilash',
    myTracks: '📦 Yuklarim',
    addMore: "➕ Yana qo'shish",
    balance: '💰 Balans',
    cancel: '❌ Bekor qilish',
    recalc: '🧮 Qayta hisoblash',
    photo: '📷 Rasm',
  },
  cancelled: 'Bekor qilindi.',
  refreshedNoChange: "O'zgarish yo'q",
  refreshed: 'Yangilandi',

  langChoose: 'Tilni tanlang / Выберите язык:',

  helpCard: [
    "ℹ️ Bot qanday ishlaydi",
    '',
    "1️⃣ Xitoydagi sotuvchidan trek kodini oling.",
    "2️⃣ ➕ Trek qo'shish tugmasini bosib, kodni yuboring — bir nechtasini birdaniga ham bo'ladi.",
    "3️⃣ Yuk holati o'zgarganda bot sizga o'zi xabar beradi.",
    '',
    "🔍 Istalgan payt trek kodini shunchaki yozib yuborsangiz, holatini ko'rsataman.",
    "📦 Yuklarim — barcha yuklaringiz ro'yxati.",
    "💰 Balans — qarzingiz va oxirgi to'lovlar.",
    "🧮 Kalkulyator — taxminiy narxni hisoblash.",
    "🇨🇳 Ombor manzili — sotuvchiga yuboriladigan manzil.",
  ].join('\n'),

  // --- §4.3 add-track summary ---
  summaryAdded: (n, codes) => `✅ Qo'shildi (${n}): ${codes}`,
  summaryClaimed: (n, codes) => `♻️ Sizga biriktirildi (${n}): ${codes}`,
  summaryOtherOwner: (n, codes) =>
    `⛔ Boshqa mijozga tegishli (${n}): ${codes}`,
  summaryBadFormat: (n, lines) => `❌ Noto'g'ri format (${n}): ${lines}`,
  addNothingNew: "Yangi trek qo'shilmadi.",

  // --- §3.3 my tracks ---
  myTracksHeader: '📦 Mening yuklarim:',
  myTracksTapHint: "👆 Batafsil ko'rish uchun trek ustiga bosing.",
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
    actualKg,
    som,
    description,
  }) => {
    const lines = [
      `🔍 ${code}`,
      `Holat: ${statusEmoji} ${statusLabel}`,
      `Sanasi: ${date}`,
    ];
    if (description) lines.push(`📦 Tavsif: ${description}`);
    if (batchName) {
      lines.push(
        batchEta
          ? `🚚 Reys: ${batchName} · Taxminan: ${batchEta}`
          : `🚚 Reys: ${batchName}`,
      );
    }
    // §7.16: when volume set the price, the customer is told the number AND
    // why it is bigger than what the scale said — the alternative is a ticket.
    if (kg != null) {
      lines.push(
        actualKg != null
          ? `⚖️ Hisob vazni: ${kg} kg (hajmiy) · haqiqiy ${actualKg} kg`
          : `⚖️ Og'irligi: ${kg} kg`,
      );
    }
    if (som != null) lines.push(`💵 To'lov: ${som} so'm`);
    return lines.join('\n');
  },
  lookupNotFound: (code) => `🔍 ${code} — bunday trek topilmadi.`,
  lookupClaimHint:
    "Bu trek sizga biriktirilmagan. O'zingizniki bo'lsa, ➕ Trek qo'shish orqali yuboring.",

  // --- §3.13 tickets (§4.6) ---
  ticketAskCategory: 'Muammo qaysi turga tegishli?',
  ticketAskText: 'Muammoni yozib yuboring — imkon qadar batafsil:',
  ticketCreated: '✅ Murojaatingiz qabul qilindi. Javobni shu botda olasiz.',
  ticketAppended: "✅ Xabaringiz murojaatga qo'shildi.",
  ticketOpenHeader: (category, status) =>
    `📮 Ochiq murojaatingiz: ${category} · ${status}\nYangi xabar yozing:`,
  ticketClosedChoice: (category) =>
    `Oxirgi murojaatingiz (${category}) yopilgan. Davom ettirasizmi yoki yangi ochasizmi?`,
  ticketContinue: '🔄 Davom ettirish',
  ticketNew: '🆕 Yangi murojaat',
  ticketIssueButton: '⚠️ Muammo bor',
  ticketRegisterFirst:
    "Murojaat yozish uchun avval ro'yxatdan o'ting — /start bosing.",
  ticketReply: (category, text) =>
    `💬 Murojaatingizga javob (${category}):\n\n${text}\n\nJavob yozish uchun: ✍️ Murojaat`,
  ticketClosedNotice: (category) =>
    `✅ Murojaatingiz (${category}) yopildi. Yana muammo bo'lsa — ✍️ Murojaat.`,

  // --- §3.9 calculator (§4.5) ---
  calcStepTariff: '🧮 1/3 · Tarifni tanlang',
  calcStepKg: "🧮 2/3 · Og'irlikni kiriting (kg), masalan: 3.2",
  calcStepDims:
    "🧮 3/3 · O'lchamlarni kiriting (sm): uzunlik×kenglik×balandlik, masalan: 50x40x30\nO'lchamsiz hisoblash uchun — o'tkazib yuboring.",
  calcSkipDims: "⏭ O'tkazib yuborish",
  calcResult: ({ tariffName, kg, som, usd, actualKg }) =>
    actualKg != null
      ? `🧮 ${tariffName}\nHisob vazni: ${kg} kg (hajmiy) · haqiqiy ${actualKg} kg\n≈ ${som} so'm${usd ? ` (${usd})` : ''}\n\nAniq summa yuk tortilganda hisoblanadi.`
      : `🧮 ${tariffName}\n${kg} kg ≈ ${som} so'm${usd ? ` (${usd})` : ''}\n\nAniq summa yuk tortilganda hisoblanadi.`,
  calcInvalid: 'Raqam kiriting, masalan: 2.5',
  calcDimsInvalid: "O'lchamlarni shunday kiriting: 50x40x30 (sm)",
  calcNoTariffs:
    "Hozircha tarif mavjud emas. Iltimos, administrator bilan bog'laning.",
  calcNoRate:
    "Valyuta kursi hali kiritilmagan. Iltimos, administrator bilan bog'laning.",

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
  staffVolumetricNote: (chargeableKg) =>
    `📐 Hajmiy vazn bo'yicha hisoblandi: ${chargeableKg} kg`,
  staffSaved: (code, kg, som) => `✅ ${code}: ${kg} kg → ${som} so'm`,
  staffSavedNew: (code, kg, som) =>
    `🆕 ${code}: yangi trek yaratildi (${kg} kg → ${som} so'm). Mijoz hali biriktirilmagan.`,
  staffSavedNewOwned: (code, kg, som, clientCode) =>
    `🆕 ${code}: yangi trek yaratildi (${kg} kg → ${som} so'm) va ${clientCode} ga biriktirildi.`,
  staffMarkaAttached: (clientCode) => `👤 ${clientCode} ga biriktirildi.`,
  staffMarkaConflict: (clientCode) =>
    `⚠️ Bu posilka ${clientCode} ga tegishli — egasi o'zgartirilmadi. Vazn saqlandi.`,
  staffMarkaNotFound: (marka) =>
    `⚠️ "${marka}" markasi topilmadi — posilka egasiz qoldi.`,
  staffPhotoOk: (code) => `📷 ${code}: rasm biriktirildi.`,
  staffNotFound: (code) =>
    `❓ ${code} topilmadi. Vazn bilan yuborsangiz, yangi trek sifatida yarataman, masalan: ${code} 3.2`,
  staffPhotoTooLarge: (maxMb) =>
    `❌ Rasm hajmi juda katta. Ruxsat etilgan eng katta hajm — ${maxMb} MB.`,
  staffPhotoError: "Rasmni yuklab bo'lmadi, birozdan so'ng qayta urinib ko'ring.",

  // --- §5.12 xodimni Telegramga ulash ---
  staffLinked: (name) =>
    `✅ ${name}, siz xodim sifatida ulandingiz. Endi trek kodi va vaznni yuborishingiz mumkin, masalan: SF1234567890 3.2\nQutida marka bo'lsa, uchinchi bo'lib yozing: SF1234567890 3.2 DK-1042`,
  staffLinkNotFound:
    "❓ Bunday kod topilmadi. Kodni administratoringizdan qayta so'rang.",
  staffLinkExpired:
    "⌛ Kod muddati tugagan. Administratoringizdan yangi kod so'rang.",
  staffLinkTaken:
    "⚠️ Bu Telegram akkaunt allaqachon boshqa xodimga ulangan.",

  // --- §4.2 notifications ---
  notifChinaWarehouse: (code) =>
    `📦 ${code} — yukingiz Xitoy omboriga qabul qilindi.`,
  notifInTransit: (code, eta) =>
    `🚚 ${code} — yukingiz yo'lga chiqdi.` +
    (eta ? `\n📅 Taxminiy yetib kelishi: ${eta}` : ''),
  notifTashkentWarehouse: (code) =>
    `🇺🇿 ${code} — yukingiz Toshkentga yetib keldi. Tez orada olib ketishga tayyor bo'ladi.`,
  notifReadyForPickup: ({
    code,
    kg,
    actualKg,
    som,
    pickupAddress,
    workingHours,
  }) => {
    const lines = [`✅ ${code} — yukingiz tayyor!`];
    if (kg != null) {
      lines.push(
        actualKg != null
          ? `⚖️ Hisob vazni: ${kg} kg (hajmiy) · haqiqiy ${actualKg} kg`
          : `⚖️ Og'irligi: ${kg} kg`,
      );
    }
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
