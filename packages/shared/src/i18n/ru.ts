/**
 * Russian strings — secondary locale. Natural Russian translations of the
 * canonical SPEC §4 texts (money keeps the ` so'm` suffix per the spec's
 * formatting rules).
 */

import type { Strings } from './index';

export const ru: Strings = {
  // --- §4.1 ---
  welcome: (tenantName) =>
    `Здравствуйте! Добро пожаловать в бот ${tenantName}.\nTilni tanlang / Выберите язык:`,
  askPhone: 'Отправьте номер телефона для регистрации 👇',
  askPhoneButton: '📱 Отправить номер',
  registered: (clientCode) =>
    `Готово! Ваш код клиента: ${clientCode}\n\nТеперь отправьте трек-коды — можно несколько сразу, каждый с новой строки.`,
  askTracks:
    'Отправьте трек-коды 👇\nМожно несколько сразу — каждый с новой строки.',
  noTracks:
    'У вас пока нет посылок. Нажмите ➕ Добавить трек и отправьте свой трек-код.',
  helpFallback:
    'Не понял 🤔\nОтправьте трек-код или выберите одну из кнопок ниже.',
  errorGeneric: 'Произошла ошибка, попробуйте ещё раз чуть позже.',

  // --- §3.1 menu labels ---
  menuAddTrack: '➕ Добавить трек',
  menuMyTracks: '📦 Мои посылки',
  menuCalculator: '🧮 Калькулятор',
  menuBalance: '💰 Баланс',
  menuChinaAddress: '🇨🇳 Адрес склада',
  menuInfo: 'ℹ️ Информация',
  menuLang: '🌐 Til / Язык',

  // --- Telegram command-menu descriptions (setMyCommands) ---
  commands: {
    start: 'Начать / Регистрация',
    mytracks: 'Мои посылки',
    balance: 'Баланс и долг',
    calc: 'Калькулятор цены',
    info: 'Информация',
    manzil: 'Адрес склада в Китае',
    help: 'Как работает бот',
  },

  // --- §3.11 inline navigation ---
  nav: {
    backToList: '⬅️ К списку',
    refresh: '🔄 Обновить',
    myTracks: '📦 Мои посылки',
    addMore: '➕ Добавить ещё',
    balance: '💰 Баланс',
    cancel: '❌ Отмена',
    recalc: '🧮 Пересчитать',
    photo: '📷 Фото',
    menu: '🏠 Меню',
  },
  cancelled: 'Отменено.',
  refreshedNoChange: 'Без изменений',
  refreshed: 'Обновлено',

  langChoose: 'Tilni tanlang / Выберите язык:',

  helpCard: [
    'ℹ️ Как работает бот',
    '',
    '1️⃣ Возьмите трек-код у продавца в Китае.',
    '2️⃣ Нажмите ➕ Добавить трек и отправьте код — можно несколько сразу.',
    '3️⃣ Когда статус посылки изменится, бот сам вам напишет.',
    '',
    '🔍 В любой момент просто отправьте трек-код — покажу его статус.',
    '📦 Мои посылки — список всех ваших посылок.',
    '💰 Баланс — долг и последние платежи.',
    '🧮 Калькулятор — примерный расчёт стоимости.',
    '🇨🇳 Адрес склада — адрес для отправки продавцу.',
  ].join('\n'),

  // --- §4.3 add-track summary ---
  summaryAdded: (n, codes) => `✅ Добавлено (${n}): ${codes}`,
  summaryClaimed: (n, codes) => `♻️ Закреплено за вами (${n}): ${codes}`,
  summaryOtherOwner: (n, codes) =>
    `⛔ Принадлежит другому клиенту (${n}): ${codes}`,
  summaryBadFormat: (n, lines) => `❌ Неверный формат (${n}): ${lines}`,
  addNothingNew: 'Новых треков не добавлено.',

  // --- §3.3 my tracks ---
  myTracksHeader: '📦 Мои посылки:',
  myTracksTapHint: '👆 Нажмите на трек, чтобы открыть подробности.',
  readyDetail: ({ kg, som }) => ` — ${kg} кг, ${som} so'm`,
  pageIndicator: (page, pages) => `Страница ${page}/${pages}`,

  // --- §3.4 balance ---
  balanceDebt: (som) => `💰 Ваш долг: ${som} so'm`,
  balanceAdvance: (som) => `💰 Аванс: ${som} so'm`,
  balanceZero: '💰 Задолженности нет. ✅',
  paymentsHeader: 'Последние платежи:',
  noPayments: 'История платежей пока пуста.',
  paymentLine: (date, som, method) => `${date} — ${som} so'm (${method})`,
  paymentMethod: {
    cash: 'наличные',
    click: 'Click',
    payme: 'Payme',
    other: 'другое',
  },

  // --- §3.5 info ---
  infoCard: ({ tariffLines, usdRateSom, address, hours, phone, infoText }) => {
    const lines = ['ℹ️ Информация'];
    if (tariffLines.length > 0) {
      lines.push('', '💵 Тарифы:');
      for (const line of tariffLines) lines.push(line);
    }
    if (usdRateSom) lines.push('', `Курс: 1$ = ${usdRateSom} so'm`);
    if (address || hours || phone) {
      lines.push('');
      if (address) lines.push(`📍 Адрес: ${address}`);
      if (hours) lines.push(`🕘 Часы работы: ${hours}`);
      if (phone) lines.push(`📞 Контакт: ${phone}`);
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
      `Статус: ${statusEmoji} ${statusLabel}`,
      `Дата: ${date}`,
    ];
    if (batchName) {
      lines.push(
        batchEta
          ? `🚚 Рейс: ${batchName} · Ожидается: ${batchEta}`
          : `🚚 Рейс: ${batchName}`,
      );
    }
    if (kg != null) lines.push(`⚖️ Вес: ${kg} кг`);
    if (som != null) lines.push(`💵 К оплате: ${som} so'm`);
    return lines.join('\n');
  },
  lookupNotFound: (code) => `🔍 ${code} — трек не найден.`,

  // --- §3.9 calculator (§4.5) ---
  calcChooseTariff: 'Выберите тариф:',
  calcStepTariff: '🧮 1/2 · Выберите тариф',
  calcStepKg: '🧮 2/2 · Введите вес (кг), например: 3.2',
  calcAskKg: 'Введите вес (кг), например: 3.2',
  calcResult: ({ tariffName, kg, som, usd }) =>
    `🧮 ${tariffName}\n${kg} кг ≈ ${som} so'm${usd ? ` (${usd})` : ''}\n\nТочная сумма рассчитывается при взвешивании.`,
  calcInvalid: 'Введите число, например: 2.5',
  calcNoTariffs:
    'Пока нет доступных тарифов. Пожалуйста, свяжитесь с администратором.',
  calcNoRate:
    'Курс валюты ещё не задан. Пожалуйста, свяжитесь с администратором.',

  // --- §3.10 China warehouse address (§4.5) ---
  chinaAddrHeader:
    '🇨🇳 Адрес склада в Китае — отправьте это продавцу (поставщику):',
  chinaAddrFooter: (clientCode) =>
    `❗️ Не забудьте попросить написать этот код на каждой коробке: ${clientCode}`,
  chinaAddrMissing: (contactPhone) =>
    `Адрес пока не указан. Свяжитесь с администратором: ${contactPhone}`,

  // --- §3.7 ---
  langSwitched: 'Язык изменён ✅',

  // --- §3.8 staff mode (weighing + photo) / §4.5 staff strings ---
  staffPhotoNoCaption:
    'Отправьте фото, указав трек-код в подписи (caption).',
  staffSaved: (code, kg, som) => `✅ ${code}: ${kg} кг → ${som} сум`,
  staffSavedNew: (code, kg, som) =>
    `🆕 ${code}: создан новый трек (${kg} кг → ${som} сум). Клиент пока не привязан.`,
  staffPhotoOk: (code) => `📷 ${code}: фото прикреплено.`,
  staffNotFound: (code) =>
    `❓ ${code} не найден. Отправьте вместе с весом — создам новый трек, например: ${code} 3.2`,
  staffPhotoTooLarge: (maxMb) =>
    `❌ Файл слишком большой. Максимальный размер — ${maxMb} МБ.`,
  staffPhotoError: 'Не удалось загрузить фото, попробуйте ещё раз чуть позже.',

  // --- §4.2 notifications ---
  notifChinaWarehouse: (code) =>
    `📦 ${code} — ваша посылка принята на складе в Китае.`,
  notifInTransit: (code, eta) =>
    `🚚 ${code} — ваша посылка в пути.` +
    (eta ? `\n📅 Ожидаемое прибытие: ${eta}` : ''),
  notifTashkentWarehouse: (code) =>
    `🇺🇿 ${code} — ваша посылка прибыла в Ташкент. Скоро будет готова к выдаче.`,
  notifReadyForPickup: ({ code, kg, som, pickupAddress, workingHours }) => {
    const lines = [`✅ ${code} — ваша посылка готова!`];
    if (kg != null) lines.push(`⚖️ Вес: ${kg} кг`);
    if (som != null) lines.push(`💵 К оплате: ${som} so'm`);
    lines.push(`📍 Адрес: ${pickupAddress}`);
    lines.push(`🕘 Часы работы: ${workingHours}`);
    return lines.join('\n');
  },
  notifDelivered: (code) =>
    `🎉 ${code} — ваша посылка выдана. Поздравляем с покупкой!`,
  notifSideState: (code, statusLabel, contactPhone) =>
    `⚠️ ${code} — статус: ${statusLabel}. За подробностями свяжитесь с нами: ${contactPhone}`,

  // --- §4.4 ---
  debtReminder: (name, tenantName, debtSom, contactPhone) =>
    `Здравствуйте, ${name}! Ваш долг по ${tenantName}: ${debtSom} so'm.\nПожалуйста, произведите оплату. По вопросам пишите в этот бот или звоните: ${contactPhone}`,
};
