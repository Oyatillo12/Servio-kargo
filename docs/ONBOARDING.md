# ONBOARDING — yangi kargo kompaniyasini ulash

> Auditoriya: platforma egasi (super-admin). Maqsad: sotuv suhbatidan keyin
> kompaniyani **5 daqiqada** ishlaydigan holatga keltirish. Formaning o'zi
> ~2 daqiqa; qolgani — egaga topshirish.

## 0. Bir martalik talablar

Prod ishlab turgan bo'lishi kerak (qarang: [DEPLOY.md](./DEPLOY.md)) va `.env` da:

- `SUPERADMIN_TOKEN` — `/sa` sahifasini qo'riqlaydi;
- `WEBHOOK_BASE_URL` — bot serverning ommaviy manzili (`https://bot.<domen>`).
  Bo'lmasa forma «Server sozlanmagan: WEBHOOK_BASE_URL yo'q» deb to'xtaydi.

## 1. BotFather'da bot yarating (mijoz bilan birga, ~1 daqiqa)

1. Telegram'da [@BotFather](https://t.me/BotFather) → `/newbot`.
2. **Nomi** — mijozlarga ko'rinadi, kompaniya nomini yozing (masalan, `Barakat Cargo`).
3. **Username** — `_bot` bilan tugashi shart (masalan, `barakat_cargo_bot`).
4. Berilgan **tokenni nusxalang** (`123456789:AA...` ko'rinishida).
5. Tavsiya: `/setuserpic` bilan logotip, `/setdescription` bilan qisqa tavsif qo'ying —
   bot mijozlarga «o'ziniki» bo'lib ko'rinsin.

Token — bu botning kaliti: uni faqat onboarding formasiga kiriting, chatlarda
qoldirmang.

## 2. `/sa` da kompaniyani yarating (~2 daqiqa)

`https://<domen>/sa` → `SUPERADMIN_TOKEN` bilan kiring → «Yangi kompaniya» formasi:

| Maydon | Izoh |
| --- | --- |
| Kompaniya nomi | Bot salomlashuvida ko'rinadi (kamida 2 belgi) |
| Bot token | 1-bosqichdagi token; format tekshiriladi |
| Kod prefiksi | 2–4 lotin harf, masalan `BK` → mijoz kodlari `BK-1001, BK-1002…` bo'ladi. Keyin o'zgartirib bo'lmaydi — kompaniya nomiga mos tanlang |
| Valyuta | `UZS` yoki `USD`; USD bo'lsa **kurs** ham kiritiladi (1$ = ? so'm, butun son) |
| Standart tarif (kg narxi) | UZS: so'mda butun son; USD: dollarda (masalan `3.5`). «Asosiy» nomli standart tarif yaratiladi, keyin Sozlamalarda tahrirlanadi |
| Olib ketish manzili / ish vaqti / aloqa telefoni | Ixtiyoriy — bo'sh qoldirsangiz ega keyin Sozlamalardan kiritadi |
| Birinchi admin: telefon + parol | Kompaniya egasining panelga kirishi. Parol kamida 6 belgi; egasi keyin o'zi almashtirsin |

**Saqlanganda nima bo'ladi:** tizim tokenni Telegram'da tekshiradi (`getMe`) →
webhookni o'rnatadi → tenant + «Asosiy» tarif + owner-admin yaratadi. Qaysidir
bosqich xato bersa — bazaga **hech narsa yozilmaydi**, xabar formada chiqadi;
tuzatib qayta yuboriladi.

## 3. Egaga topshirish (~2 daqiqa, birga o'tiring)

1. **Kirish:** `https://<domen>/login` — 2-bosqichdagi telefon + parol.
2. **Sozlamalar** (`/settings`) — birga to'ldiring:
   - 🇨🇳 **Xitoy ombori manzili** — sotuvchiga yuboriladigan shablon;
     `{client_code}` yozilgan joyga har mijozning kodi avtomatik qo'yiladi.
   - **Ma'lumot matni** — taqiqlangan yuklar, qoidalar, FAQ (botning ℹ️ bo'limi).
   - **Haftalik avto-eslatma** — standart: Dushanba 10:00 (xohlasa o'zgartiradi).
3. **Xodimlar** (`/settings/team`): ega xodim qo'shadi → 6 belgili kod chiqadi
   (masalan `ABC-234`, 24 soat amal qiladi):
   - panelda ishlaydigan xodim `/login` → «Menda taklif kodi bor» orqali o'z
     parolini o'rnatadi;
   - ombor xodimi shu kodni **botga yozib yuboradi** — Telegram'i ulanadi va
     tarozida `KOD 3.2` yozib vazn kirita oladi (parol umuman shart emas).

## 4. 0-kun: mavjud bazani import qilish

Egada odatda Excel yoki kanal tarixi bor. `/import` — 4 bosqich: fayl/matn →
ustunlarni tekshirish (avtomatik taniladi) → ko'rik → qo'llash.

- Import **faqat bo'sh maydonlarni to'ldiradi** — omborda allaqachon tortilgan
  yoki narxlangan trek fayl bilan qayta yozilmaydi.
- Mijoz ustuni bo'lsa, treklar egalariga biriktiriladi. **Biriktirish xabar
  yubormaydi** (SPEC §7.3) — 500 ta eski trek haqida hech kimga «yukingiz
  tayyor» ketmaydi, mijozlar ularni 📦 Mening yuklarim'da ko'radi, xolos.

## 5. Mijozlarga e'lon

Ega o'z kanaliga bot havolasini tashlaydi: `https://t.me/<bot_username>`.
Tayyor matn namunasi:

> Endi yuklaringizni botdan kuzating: trek kodingizni yuboring — holati, vazni,
> narxi va qarzingiz o'sha yerda. Yuk kelganda bot o'zi xabar beradi 👉 t.me/…

## 6. Tekshirish (30 soniya)

1. Egangiz paneli: **Sozlamalar → Bot** bo'limida webhook holati ✅ bo'lishi kerak.
2. Botga `/start` yuboring: til → telefon → mijoz kodi kelsa — hammasi joyida.
3. Bitta test trek qo'shib, panelda status o'zgartiring — botga xabar kelishi kerak.

## Muammolar

| Belgi | Yechim |
| --- | --- |
| «Bot token yaroqsiz» | Token noto'g'ri nusxalangan yoki BotFather'da bekor qilingan — qaytadan oling |
| «Bu bot token allaqachon ro'yxatga olingan» | Shu token boshqa kompaniyaga ulangan — har kompaniyaga alohida bot kerak |
| «Server sozlanmagan: WEBHOOK_BASE_URL yo'q» | VPS `.env` ga `WEBHOOK_BASE_URL=https://bot.<domen>` qo'shib, qayta deploy qiling |
| Webhook holati xato / bot javob bermayapti | Sozlamalar → «Webhookni qayta o'rnatish», yoki `/sa` da o'sha kompaniya qatoridagi tugma |
| Mijoz «bot javob bermadi» deydi | `docker compose -f docker-compose.prod.yml logs bot` — xato pino logda ko'rinadi |
