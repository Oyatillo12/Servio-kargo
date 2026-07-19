# ONBOARDING.md — Yangi mijozni (kargo kompaniyani) ulash

Bu — men uchun ichki cheklist. Maqsad: bitta kompaniyani **5 daqiqadan kam**
vaqtda ishga tushirish. Pastda ikki qism bor:

1. **Mening cheklistim** (super-admin) — men bajaradigan qadamlar.
2. **Mijozga yuboriladigan xabar** (oddiy o'zbek tilida) — BotFather orqali bot
   yaratish yo'riqnomasi. Uni to'g'ridan-to'g'ri nusxalab mijozga tashlayman.

---

## 0. Bir martalik tayyorgarlik (server sozlamalari)

Bu ishlar faqat bir marta, platforma o'rnatilganda bajariladi:

- [ ] `SUPERADMIN_TOKEN` — uzun tasodifiy qiymat, `.env` da o'rnatilgan.
      (Generatsiya: `openssl rand -base64 32`)
- [ ] `WEBHOOK_BASE_URL` — bot serverning ochiq **HTTPS** manzili
      (masalan `https://bot.kargotrack.uz`). Telegram shu manzilga update
      yuboradi. Caddy orqali HTTPS ishlab turibdi.
- [ ] `SESSION_SECRET` va `DATABASE_URL` o'rnatilgan, migratsiyalar bajarilgan
      (`pnpm db:migrate`).
- [ ] Super-admin panel ochiladi: `https://<web-domen>/sa` → token so'raydi.

> Eslatma: bot server allaqachon ishlab turgani uchun yangi kompaniya
> qo'shilganda **serverni qayta ishga tushirish shart emas** — bot tokenni
> bazadan avtomatik topadi.

---

## 1. Mening cheklistim — bitta mijozni ulash (~5 daqiqa)

### A. Mijozdan ma'lumot olaman

- [ ] Kompaniya nomi (masalan: *Dream Kargo*)
- [ ] Mijoz kodi prefiksi — 2–4 lotin harf (masalan `DK`). Mijoz kodlari shunday
      chiqadi: `DK-1001`, `DK-1002`…
- [ ] 1 kg narxi (so'm) — masalan `55000`
- [ ] Olib ketish manzili, ish vaqti, aloqa telefoni (ixtiyoriy, keyin
      sozlamalardan ham qo'shsa bo'ladi)
- [ ] Birinchi admin uchun telefon raqami + parol (bu odam panelga kiradi)

### B. Mijozga bot yaratdiraman

- [ ] Quyidagi **"Mijozga yuboriladigan xabar"** ni nusxalab mijozga yuboraman.
- [ ] Mijoz menga **bot tokenini** qaytaradi
      (masalan `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`).

### C. Panelda kompaniyani yarataman

- [ ] `https://<web-domen>/sa` ga kiraman (`SUPERADMIN_TOKEN` bilan).
- [ ] **"Yangi kompaniya qo'shish"** formasini to'ldiraman (yuqoridagi ma'lumotlar).
- [ ] **"Kompaniyani yaratish"** bosaman. Tizim avtomatik:
  1. tokenni Telegram `getMe` orqali tekshiradi,
  2. webhookni `{WEBHOOK_BASE_URL}/webhook/{token}` ga o'rnatadi,
  3. kompaniya + birinchi admin (owner) yozuvini yaratadi.
- [ ] Yashil xabar chiqadi: *"✅ … yaratildi va webhook o'rnatildi"* + bot linki.

### D. Tekshiraman (30 soniya)

- [ ] Bot linkini (`https://t.me/<bot_username>`) ochib **/start** bosaman —
      til tanlash chiqishi kerak.
- [ ] Mijozga admin panel manzili + admin telefon/parolni beraman:
      `https://<web-domen>/login`.
- [ ] Tamom. Mijoz endi trek kodlarini import qilishi mumkin.

### Muammolar bo'lsa

- **"Bot token yaroqsiz"** → mijoz tokenni noto'g'ri nusxalagan yoki botni
  o'chirib yuborgan. Mijozdan tokenni qayta so'rayman.
- **"Webhook o'rnatilmadi"** → `WEBHOOK_BASE_URL` HTTPS ekanini va tashqaridan
  ochilishini tekshiraman.
- **"Bu bot token allaqachon ro'yxatga olingan"** → shu bot boshqa kompaniyaga
  ulangan. Har bir kompaniyaga alohida bot kerak.
- Webhookni qayta o'rnatish kerak bo'lsa: `/sa` da kompaniya qatoridagi
  **"Webhook"** tugmasini bosaman.

---

## 2. Mijozga yuboriladigan xabar (nusxalab yuboring)

> Quyidagi matnni o'zgartirmasdan mijozga tashlang. U oddiy tilda yozilgan.

---

**Assalomu alaykum! Kargo botingizni yaratish uchun quyidagi 6 qadamni bajaring.
Bu 2 daqiqa vaqt oladi. Oxirida menga bitta uzun "token" yuborasiz.**

1. Telegramda qidiruvga **@BotFather** deb yozing va uni oching. Yonida ko'k
   "tasdiqlangan" belgisi bo'lishi kerak.

2. **Start** (yoki *Ishga tushirish*) tugmasini bosing.

3. Xabar yozing: **/newbot** va yuboring.

4. BotFather **botga nom** so'raydi. Mijozlar ko'radigan nomni yozing.
   Masalan: **Dream Kargo**

5. Endi **bot username** (foydalanuvchi nomi) so'raydi. U **lotin harflar
   bilan** bo'lishi va **bot** so'zi bilan tugashi shart.
   Masalan: **dreamkargo_bot**
   - Ag'ar "already taken" (band) desa, boshqa nom o'ylab toping
     (masalan `dreamkargo_uz_bot`).

6. Tayyor! BotFather sizga xabar yuboradi, ichida shunga o'xshash **uzun kalit**
   bo'ladi:

   `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

   **Ana shu kalitni (tokenni) to'liq nusxalab menga yuboring.**

⚠️ **Muhim:** bu tokenni **hech kimga bermang**, faqat menga. U — botingizning
paroli. Men uni sozlab beraman va botingiz ishga tushadi.

---

*(Token kelgach, men qolganini o'zim sozlayman — sizga tayyor bot va admin
paneliga kirish ma'lumotlarini yuboraman.)*
