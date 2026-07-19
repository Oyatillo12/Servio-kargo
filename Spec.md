# SPEC.md — KargoTrack Functional Specification

> Bu fayl — loyihaning to'liq texnik topshirig'i. CLAUDE.md bilan birga repo
> ildizida turadi. Promptlar shu faylning bo'limlariga havola qiladi.

If anything below conflicts with CLAUDE.md, stop and ask before implementing.

---

## 1. Roles

- **Customer** — the cargo company's client. Interacts ONLY via the tenant's
  Telegram bot. Never sees the web panel.
- **Tenant admin** (`owner` / `staff`) — cargo company employees. Web admin
  panel + "staff photo mode" inside the bot.
- **Super-admin** — platform owner (me). Onboards tenants via a hidden area.

## 2. Status pipeline

| KEY | uz label | ru label | emoji |
|---|---|---|---|
| CREATED | Ro'yxatga olindi | Зарегистрирован | 📝 |
| CHINA_WAREHOUSE | Xitoy omborida | На складе в Китае | 📦 |
| IN_TRANSIT | Yo'lda | В пути | 🚚 |
| TASHKENT_WAREHOUSE | Toshkent omborida | На складе в Ташкенте | 🇺🇿 |
| READY_FOR_PICKUP | Olib ketishga tayyor | Готов к выдаче | ✅ |
| DELIVERED | Topshirildi | Выдан | 🎉 |
| LOST | Yo'qolgan | Утерян | ⚠️ |
| RETURNED | Qaytarildi | Возврат | ↩️ |

Admins may set ANY status (corrections happen). Every change appends to
`track_events`. Same-status writes are no-ops: no event, no notification.

## 3. Bot flows (customer)

### 3.1 /start
1. Language choice — two inline buttons: `O'zbekcha 🇺🇿` / `Русский 🇷🇺`
2. Phone request via contact button (see 4.1 texts)
3. Create/update customer, assign `client_code` = tenant prefix + sequence
   (e.g. `DK-1042`), show confirmation + main menu.

Main menu (reply keyboard, 2 columns):
- uz: `➕ Trek qo'shish` `📦 Mening yuklarim` / `💰 Balans` `ℹ️ Ma'lumot` / `🌐 Til / Язык`
- ru: `➕ Добавить трек` `📦 Мои посылки` / `💰 Баланс` `ℹ️ Информация` / `🌐 Til / Язык`

### 3.2 Add track
Prompt the user, accept one message with one or MANY codes (any separators:
newlines, commas, spaces). Normalize each candidate line, then per code:
already claimed by this user → skip silently in summary count; exists
unattached → claim; belongs to another customer → refuse politely; new →
create with status CREATED and attach. Reply with the grouped summary (4.3).

### 3.3 My tracks
Group user's non-deleted tracks by status in pipeline order. Each line:
`{emoji} {code_original}`; for READY_FOR_PICKUP also append
` — {weight} kg, {price} so'm` when set. Paginate 10 per page with inline
`◀️ / ▶️` buttons. Empty state text in 4.1.

### 3.4 Balance
Show debt (or advance if negative) + last 5 payments as
`{DD.MM.YYYY} — {amount} so'm ({method label})`.

### 3.5 Info
Static card from tenant settings: pickup address, working hours, price per kg,
contact phone.

### 3.6 Free-text lookup
Any plain message whose normalized form is 8–20 alphanumerics → status card:
code, current status (emoji + label), last event date, weight/price if set,
photo if exists. Otherwise → short help text pointing to the menu.

### 3.7 Language switch
`🌐` button toggles and persists `customers.lang`. Re-render menu.

### 3.8 Staff photo mode
If `from.id` ∈ `tenant.settings.staff_tg_ids`: a photo with caption = track
code → download to `/data/uploads/{tenantId}/{trackId}.jpg`, link to track,
confirm. Unknown code → error listing the normalized code it tried. Staff
users still have the normal customer menu below this behavior.

## 4. Message & notification templates

Formatting rules: amounts with space thousands separators + ` so'm`
(`1 250 000 so'm`); dates `DD.MM.YYYY`; display timezone Asia/Tashkent.
`{var}` = template variables. Keep every string in
`packages/shared/i18n/{uz,ru}.ts` — the texts below are canonical.

### 4.1 Onboarding & service texts
- welcome — uz: `Assalomu alaykum! {tenant_name} botiga xush kelibsiz.\nTilni tanlang / Выберите язык:`
- ask_phone — uz: `Ro'yxatdan o'tish uchun telefon raqamingizni yuboring 👇`
  (button: `📱 Raqamni yuborish`) — ru: `Отправьте номер телефона для регистрации 👇` (button: `📱 Отправить номер`)
- registered — uz: `Tayyor! Sizning mijoz kodingiz: {client_code}\n\nEndi trek kodlaringizni yuboring — bir nechtasini birdaniga, har birini alohida qatorda yozsangiz ham bo'ladi.`
- ask_tracks — uz: `Trek kodlarini yuboring (bir nechtasini birdan yozish mumkin):`
- no_tracks — uz: `Hozircha yuklaringiz yo'q. ➕ Trek qo'shish tugmasi orqali trek kodingizni yuboring.`
- help_fallback — uz: `Tushunmadim 🤔 Trek kodini yuboring yoki quyidagi menyudan foydalaning.`
- error_generic — uz: `Xatolik yuz berdi, birozdan so'ng qayta urinib ko'ring.`
- ru variants: same meaning, natural Russian; Claude writes them.

### 4.2 Status notifications (sent on change, only if customer attached)
- CHINA_WAREHOUSE — uz: `📦 {code} — yukingiz Xitoy omboriga qabul qilindi.`
- IN_TRANSIT — uz: `🚚 {code} — yukingiz yo'lga chiqdi.`
- TASHKENT_WAREHOUSE — uz: `🇺🇿 {code} — yukingiz Toshkentga yetib keldi. Tez orada olib ketishga tayyor bo'ladi.`
- READY_FOR_PICKUP — uz:
  `✅ {code} — yukingiz tayyor!`
  `⚖️ Og'irligi: {weight} kg` (omit line if weight unset)
  `💵 To'lov: {price} so'm` (omit if price unset)
  `📍 Manzil: {pickup_address}`
  `🕘 Ish vaqti: {working_hours}`
  Attach warehouse photo if exists.
- DELIVERED — uz: `🎉 {code} — yukingiz topshirildi. Xaridingiz muborak bo'lsin!`
- LOST / RETURNED — uz: `⚠️ {code} bo'yicha holat: {status_label}. Batafsil ma'lumot uchun biz bilan bog'laning: {contact_phone}`
- ru variants for all of the above.

### 4.3 Add-track result summary (one message, only non-empty groups)
```
✅ Qo'shildi ({n}): {codes}
♻️ Sizga biriktirildi ({n}): {codes}
⛔ Boshqa mijozga tegishli ({n}): {codes}
❌ Noto'g'ri format ({n}): {lines}
```

### 4.4 Debt reminder (manual button + weekly job)
uz: `Assalomu alaykum, {name}! {tenant_name} bo'yicha qarzingiz: {debt} so'm.\nIltimos, to'lovni amalga oshiring. Savol bo'lsa shu botga yozing yoki qo'ng'iroq qiling: {contact_phone}`

## 5. Admin panel screens (all tenant-scoped, Uzbek UI)

- **5.1 /login** — telefon + parol. Xato: `Telefon yoki parol noto'g'ri`.
- **5.2 /tracks** — table: Kod, Mijoz (client_code + ism, link), Status
  (colored badge), Og'irlik, Narx, Sana. Filters: status dropdown + search
  (code / customer name / phone). Row checkboxes → bulk bar: `Status
  o'zgartirish` → modal: status select + `{N} ta trek tanlandi, {M} ta
  mijozga xabar yuboriladi` → confirm.
- **5.3 /tracks/[id]** — status select, weight input (kg, up to 2 decimals →
  stored grams, auto price per 7.4), photo preview, event timeline (status,
  date, who), customer card link. `O'chirish` = soft delete with confirm.
- **5.4 /import** — 3 steps:
  1. Upload `.xlsx` OR paste raw text (textarea).
  2. Preview: counts + expandable lists — `Yangi: {n}`, `Yangilanadi: {n}`
     (already in DB), `Xato qator: {n}` (skipped). Status select applied to all.
  3. Apply → result: created / updated / `{M} ta xabar navbatga qo'yildi`.
- **5.5 /customers** — search; columns: Kod, Ism, Telefon, Treklar, Qarz
  (red if > 0). **/customers/[id]** — info, tracks, payments history,
  `To'lov qo'shish` (summa so'mda, usul: naqd/Click/Payme/boshqa, izoh),
  `Eslatma yuborish` button.
- **5.6 /debtors** — customers with debt > 0, sorted desc.
  Per-row `Eslatma` + top `Barchasiga eslatma yuborish` (confirm with count).
- **5.7 /settings** — narx (so'm/kg), olib ketish manzili, ish vaqti, aloqa
  telefoni, staff Telegram ID lar (comma-separated), haftalik avto-eslatma
  (toggle + kun + soat, default Dushanba 10:00), bot username (read-only),
  webhook holati indikatori + `Webhookni qayta o'rnatish` button.

## 6. Super-admin (`/sa`, guarded by SUPERADMIN_TOKEN env)

Tenants table: nomi, bot, treklar soni, mijozlar soni, yaratilgan sana,
holat. Actions per row: re-set webhook, disable/enable. Create form: company
name, bot token, code prefix (2–4 latin letters), price per kg (so'm), pickup
address, working hours, contact phone, first admin phone + password.
On create: Telegram `getMe` validation → set webhook → create tenant + owner.

## 7. Business rules & edge cases

- **7.1 Normalization:** uppercase → keep only `[A-Z0-9]` → valid if length
  8–20. Examples: ` yt-7583 234 uz ` → `YT7583234UZ` ✅; `SF123` → ✗ (short);
  `订单775123456789` → `775123456789` ✅ (CJK stripped).
- **7.2 Import upsert:** key = (tenant_id, code_normalized). Existing → if
  status differs: update + event + notify; else no-op. New → create with the
  chosen status. Backward status moves are allowed (mistake correction) and
  logged like any change.
- **7.3 Claiming:** track with `customer_id IS NULL` → attach to the claiming
  customer. Attached to someone else → refuse (see 4.3). Codes are unique per
  tenant, collisions across tenants are fine.
- **7.4 Price:** `price_tiyin = round(weight_grams * price_per_kg_tiyin / 1000)`.
  Recomputed whenever weight changes. Manual price override is OUT of MVP.
- **7.5 Debt:** `sum(price_tiyin of customer tracks in READY_FOR_PICKUP or
  DELIVERED, excluding soft-deleted) − sum(payments)`. Negative → display as
  `Avans: {abs} so'm` (green), never "-".
- **7.6 Notification dedupe:** skip if an identical (track_id, status) job was
  enqueued within the last 60 seconds.
- **7.7 Weekly reminders:** pg-boss repeatable job per tenant setting;
  skip customers with debt ≤ 0; timezone Asia/Tashkent.
- **7.8 Soft delete:** add `deleted_at` (nullable) to `tracks` (extends the
  CLAUDE.md model). Soft-deleted tracks are hidden from every list, lookup,
  debt calc, and notification.
- **7.9 Storage:** store timestamps in UTC; convert to Asia/Tashkent for all
  display and templates.

## 8. Non-functional requirements

- Outbound sending ≤ 25 msg/sec global per bot, ≤ 1 msg/sec per chat;
  retry ×5 with exponential backoff; failed-after-retries jobs logged.
- Photos: JPEG, max 10 MB; reject others with a clear staff-mode error.
- Auth: argon2id; session cookie httpOnly, secure, 30 days.
- Any bot handler error → pino log + `error_generic` reply only when the
  update was a direct user interaction. The process never exits on a handler
  error.
- Nightly `pg_dump` at 03:00 Asia/Tashkent, keep last 14.

## 9. Out of scope for MVP (do NOT build yet)

Online payment collection (Click/Payme merchant), SMS channel, courier
delivery module, China-warehouse scanning app, multi-branch tenants,
analytics dashboard, English locale, manual price override.