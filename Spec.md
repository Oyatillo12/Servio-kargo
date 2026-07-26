# SPEC.md — SERVIO Kargo Functional Specification (v2)

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
Batches (section 7.10) may only hold CHINA_WAREHOUSE, IN_TRANSIT or
TASHKENT_WAREHOUSE as their own status.

## 3. Bot flows (customer)

### 3.1 /start
1. Language choice — two inline buttons: `O'zbekcha 🇺🇿` / `Русский 🇷🇺`
2. Phone request via contact button (see 4.1 texts)
3. Create/update customer, assign `client_code` = tenant prefix + sequence
   (e.g. `DK-1042`), show confirmation + main menu.

Main menu (reply keyboard, 2 columns, 4 rows):
- uz: `➕ Trek qo'shish` `📦 Mening yuklarim` / `🧮 Kalkulyator` `💰 Balans` /
  `🇨🇳 Ombor manzili` `ℹ️ Ma'lumot` / `🌐 Til / Язык`
- ru: `➕ Добавить трек` `📦 Мои посылки` / `🧮 Калькулятор` `💰 Баланс` /
  `🇨🇳 Адрес склада` `ℹ️ Информация` / `🌐 Til / Язык`

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
Card assembled from tenant settings, in this order:
1. Active tariffs list: `{name} — {price}` per line (price formatted per 7.4;
   in USD mode show both: `3.5$ / 44 300 so'm`)
2. If currency = USD: `Kurs: 1$ = {usd_rate} so'm`
3. Pickup address, working hours, contact phone
4. `info_text` free text (prohibited goods, rules, FAQ — whatever the tenant
   wrote in settings). Omit any block whose source field is empty.

### 3.6 Free-text lookup
Any plain message whose normalized form is 8–20 alphanumerics → status card:
code, current status (emoji + label), last event date, batch line
`🚚 Reys: {batch_name} · Taxminan: {eta DD.MM.YYYY}` when the track belongs
to a batch that is not yet in TASHKENT_WAREHOUSE or later, weight/price if
set, photo if exists. Otherwise → short help text pointing to the menu.

### 3.7 Language switch
`🌐` button toggles and persists `customers.lang`. Re-render menu.

### 3.8 Staff mode (photo + weighing)
If `from.id` ∈ `tenant.settings.staff_tg_ids`, two extra behaviors on top of
the normal customer menu:
1. **Photo**: a photo with caption = track code → download to
   `/data/uploads/{tenantId}/{trackId}.jpg`, link to track, confirm.
2. **Weighing**: caption or plain text of the form `CODE 3.2` (weight in kg,
   dot or comma) → set weight_grams, compute price per 7.4, and link the
   photo when present. If the track was in CREATED → move it to
   CHINA_WAREHOUSE (event + customer notification). Unknown code → CREATE
   the track unattached (customer_id NULL) with the given weight and status
   CHINA_WAREHOUSE so the client can claim it later; tell staff it is new.
   Replies per 4.5 staff strings.

### 3.9 Calculator
`🧮` → inline buttons of ACTIVE tariffs (name only) → ask weight
(`calc_ask_kg`, accept `3.2`, `3,2`, `3`) → reply `calc_result` (4.5).
Never writes anything to the DB. Invalid number → re-ask once with hint.

### 3.10 China warehouse address
`🇨🇳` → send `china_addr_header` + the tenant's `china_address_template`
rendered in a monospace block with `{client_code}` substituted, then
`china_addr_footer` reminding the client to write their code on every box.
If the template is empty → `china_addr_missing` fallback text.

## 4. Message & notification templates

Formatting rules: amounts with space thousands separators + ` so'm`
(`1 250 000 so'm`); USD with `$` and one decimal when needed (`3.5$`);
dates `DD.MM.YYYY`; display timezone Asia/Tashkent. `{var}` = template
variables. Keep every string in `packages/shared/i18n/{uz,ru}.ts` — the
texts below are canonical.

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
- IN_TRANSIT — uz: `🚚 {code} — yukingiz yo'lga chiqdi.{eta_line}` where
  `{eta_line}` = `\n📅 Taxminiy yetib kelishi: {eta}` when the track's batch
  has an eta_date, else empty.
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

### 4.5 Calculator, address & broadcast strings
- calc_choose_tariff — uz: `Tarifni tanlang:`
- calc_ask_kg — uz: `Og'irlikni kiriting (kg), masalan: 3.2`
- calc_result — uz: `🧮 {tariff_name}\n{kg} kg ≈ {price} so'm{usd_part}\n\nAniq summa yuk tortilganda hisoblanadi.`
  where `{usd_part}` = ` ({usd}$)` in USD mode, else empty.
- calc_invalid — uz: `Raqam kiriting, masalan: 2.5`
- china_addr_header — uz: `🇨🇳 Xitoy ombori manzili — sotuvchiga (постовщик) shuni yuboring:`
- china_addr_footer — uz: `❗️ Har bir qutiga shu kodni yozdirishni unutmang: {client_code}`
- china_addr_missing — uz: `Manzil hali kiritilmagan. Administrator bilan bog'laning: {contact_phone}`
- staff_saved — uz: `✅ {code}: {kg} kg → {price} so'm`
- staff_saved_new — uz: `🆕 {code}: yangi trek yaratildi ({kg} kg → {price} so'm). Mijoz hali biriktirilmagan.`
- staff_photo_ok — uz: `📷 {code}: rasm biriktirildi.`
- staff_not_found — uz: `❓ {code} topilmadi. Vazn bilan yuborsangiz, yangi trek sifatida yarataman, masalan: {code} 3.2`
- Broadcast messages have no wrapper — admin's text is sent as-is.
- ru variants for all of the above.

## 5. Admin panel screens (all tenant-scoped, Uzbek UI)

- **5.1 /login** — telefon + parol. Xato: `Telefon yoki parol noto'g'ri`.
- **5.2 /tracks** — table: Kod, Mijoz (client_code + ism, link), Status
  (colored badge), Reys, Og'irlik, Narx, Sana. Header carries `⬇️ Excel`
  (5.11). Filters: status dropdown,
  reys dropdown + search (code / customer name / phone). The search input
  works with a USB barcode scanner out of the box (scanner = keyboard input
  ending with Enter → run search). Row checkboxes → bulk bar with THREE
  actions: `Status o'zgartirish` → modal: status select + `{N} ta trek
  tanlandi, {M} ta mijozga xabar yuboriladi` → confirm; `Reysga
  biriktirish` → modal: batch select → confirm; and `Mijozga biriktirish`
  → customer picker (7.3) → confirm. The customer picker states plainly
  that no message is sent.
- **5.3 /tracks/[id]** — status select, tariff select (defaults to tenant's
  default tariff), weight input (kg, up to 2 decimals → stored grams, auto
  price per 7.4), price field with `Qo'lda kiritish` toggle (manual override,
  7.4), batch display, photo preview, event timeline (status, date, who),
  customer card. `O'chirish` = soft delete with confirm.
  The customer card is also the assignment control (7.3): unattached →
  `Biriktirish`; attached → `O'zgartirish` / `Ajratish` next to the profile
  and call shortcuts. Both open the customer picker: search by
  client_code / ism / telefon, plus `Yangi mijoz qo'shish` inline (5.5) for
  the common case that the owner is not in the system yet.
  Assignment events appear in the timeline as `Mijozga biriktirildi` /
  `Mijozdan ajratildi` / `Mijoz o'zgartirildi`, not as a status.
- **5.4 /import** — 3 steps:
  1. Upload `.xlsx` OR paste raw text (textarea).
  2. Preview: counts + expandable lists — `Yangi: {n}`, `Yangilanadi: {n}`
     (already in DB), `Xato qator: {n}` (skipped). Status select applied to
     all + OPTIONAL `Reys` select (attach all imported tracks to a batch).
  3. Apply → result: created / updated / `{M} ta xabar navbatga qo'yildi`.
- **5.5 /customers** — search; columns: Kod, Ism, Telefon, Treklar, Qarz
  (red if > 0). Header carries `⬇️ Excel` (5.11).
  `Yangi mijoz` button → telefon (majburiy) + ism (ixtiyoriy);
  `client_code` avtomatik, `tg_user_id` NULL until the person opens the bot
  (7.12). A phone that already belongs to a customer is refused, and that
  customer is offered instead — no silent duplicate.
  **/customers/[id]** — info, tracks, payments history (with `⬇️ Excel` for
  that customer's statement, 5.11),
  `To'lov qo'shish` (summa so'mda, usul: naqd/Click/Payme/boshqa, izoh),
  `Eslatma yuborish` button.
- **5.6 /debtors** — customers with debt > 0, sorted desc. Header carries
  `⬇️ Excel` (5.11).
  Per-row `Eslatma` + top `Barchasiga eslatma yuborish` (confirm with count).
- **5.7 /batches (Reyslar)** — list: Nomi, Transport (Avia/Avto/Poyezd),
  ETA, Status, Treklar soni. `Yangi reys` form: nomi (e.g. `AVIA-21.07`),
  transport, ETA sanasi. Detail: editable ETA, status select → confirm modal
  `{N} ta trekka qo'llanadi, {M} ta mijozga xabar ketadi` → bulk apply per
  7.10, member tracks list.
- **5.8 /broadcast (Xabarnoma)** — textarea (max 3500 chars) → preview +
  `{N} ta mijozga yuboriladi` → confirm → queue. Below: history of past
  broadcasts (date, first 80 chars, sent count).
- **5.9 /settings** — grouped form:
  - **Tariflar**: CRUD list (nomi, narx per kg, `asosiy` radio = default,
    faol/nofaol). At least one active default tariff must always exist.
  - **Valyuta**: `UZS` / `USD` radio; if USD → `Kurs (1$ = ? so'm)` input.
  - Olib ketish manzili, ish vaqti, aloqa telefoni.
  - **🇨🇳 Xitoy ombori manzili**: textarea, hint `{client_code} — mijoz kodi
    o'rniga qo'yiladi`.
  - **Ma'lumot matni** (info_text): textarea — taqiqlangan yuklar, qoidalar.
  - Xodim Telegram IDlari (comma-separated).
  - Haftalik avto-eslatma (toggle + kun + soat, default Dushanba 10:00).
  - Bot username (read-only), webhook holati indikatori + `Webhookni qayta
    o'rnatish` button.
- **5.10 /dashboard (Bosh sahifa)** — the post-login landing page. Period
  toggle: `Bugun / 7 kun / 30 kun` (Asia/Tashkent day boundaries — careful
  with the UTC offset). Six stat cards: 📦 Xitoyda qabul qilingan
  (CHINA_WAREHOUSE events in period), 🇺🇿 Toshkentga kelgan, 🎉 Topshirilgan
  (count + jami kg + jami summa), 💰 Tushum (payments sum in period),
  👥 Yangi mijozlar, 🔴 Jami qarzdorlik (current total, not period-based)
  + qarzdorlar soni. Below the cards: one bar chart — daily tushum for the
  last 14 days. Read-only; single tenant-scoped aggregate queries, no N+1.
- **5.11 Excel eksport** — a `⬇️ Excel` button in the header of every list
  screen downloads exactly the rows **currently filtered on screen**, never the
  whole table:

  | Screen | File | Contents |
  | ---------------- | -------------------------- | ------------------------------------------- |
  | `/tracks` | `treklar-YYYY-MM-DD.xlsx` | search + status + reys filters applied |
  | `/customers` | `mijozlar-YYYY-MM-DD.xlsx` | search applied, with the qarz column |
  | `/debtors` | `qarzdorlar-YYYY-MM-DD.xlsx` | debt > 0, largest first |
  | `/customers/[id]` | `tolovlar-YYYY-MM-DD.xlsx` | that customer's payment statement |

  Rules:
  - Soft-deleted tracks never appear (7.8), and debt/track counts exclude them.
  - Money is written as a **number in so'm** and weight as a **number in kg**,
    with the unit in the column header — a formatted `"1 250 000"` string is
    text to Excel and `SUM()` over it returns 0. A negative qarz (avans, 7.5)
    keeps its sign so the column still totals correctly.
  - Timestamps are `DD.MM.YYYY HH:mm` text in Asia/Tashkent (7.9), not Excel
    date serials, which carry no timezone.
  - Column headers exist in uz and ru; the panel requests uz.
  - The date in the file name is the Tashkent calendar day.
  - Max 50 000 rows per file. Beyond that the file itself carries a warning
    row naming the true total — an export is never silently partial.

## 6. Super-admin (`/sa`, guarded by SUPERADMIN_TOKEN env)

Tenants table: nomi, bot, treklar soni, mijozlar soni, yaratilgan sana,
holat. Actions per row: re-set webhook, disable/enable. Create form: company
name, bot token, code prefix (2–4 latin letters), currency (UZS/USD) + kurs
if USD, default tariff (name + price per kg), pickup address, working hours,
contact phone, first admin phone + password.
On create: Telegram `getMe` validation → set webhook → create tenant +
default tariff + owner.

## 7. Business rules & edge cases

- **7.1 Normalization:** uppercase → keep only `[A-Z0-9]` → valid if length
  8–20. Examples: ` yt-7583 234 uz ` → `YT7583234UZ` ✅; `SF123` → ✗ (short);
  `订单775123456789` → `775123456789` ✅ (CJK stripped).
- **7.2 Import upsert:** key = (tenant_id, code_normalized). Existing → if
  status differs: update + event + notify; else no-op. New → create with the
  chosen status. Backward status moves are allowed (mistake correction) and
  logged like any change. If a batch was selected, set batch_id on ALL rows
  in the import (new and existing).
- **7.3 Claiming & admin assignment:** track with `customer_id IS NULL` →
  attach to the claiming customer. Attached to someone else → refuse (see
  4.3). Codes are unique per tenant, collisions across tenants are fine.
  The admin overrides all of this from the panel (5.2 bulk / 5.3 single):
  attach, detach, or reassign to a different customer — the correction path
  for a code claimed by the wrong person. Rules:
  - Same owner as before → no-op: no write, no audit row.
  - Any real change appends a `track_events` row carrying the track's
    **unchanged** current status plus
    `meta = {action: attach|detach|reassign, fromCustomerId, toCustomerId}`.
    History is appended, never overwritten (CLAUDE.md rule 7).
  - **No notification is sent.** 4.2 messages belong to *status* changes. A
    day-0 import that attaches 500 historical tracks to their owners must not
    blast 500 "yukingiz tayyor" messages about parcels already collected. The
    customer sees the tracks in 📦 Mening yuklarim immediately, which is the
    point. Soft-deleted tracks are never assigned (7.8).
- **7.4 Pricing:**
  - Each track has a `tariff_id` (set to the tenant's default tariff when
    weight is first entered, changeable on track detail).
  - UZS mode: `price_tiyin = round(weight_grams × tariff.price_per_kg_tiyin / 1000)`.
  - USD mode: `price_usd_cents = round(weight_grams × tariff.price_per_kg_cents / 1000)`;
    `price_tiyin = round(price_usd_cents × usd_rate_tiyin / 100)`.
    Store `usd_rate_used` on the track — the som price is FROZEN at weighing
    time; later kurs changes never alter existing tracks.
  - Changing weight or tariff recomputes the price — UNLESS
    `price_manual = true` (admin toggled `Qo'lda kiritish` and typed a price;
    used for bulky/volumetric or negotiated cargo). Toggling manual off
    recomputes from weight × tariff.
  - Bot always shows the som price; in USD mode also the `$` amount.
- **7.5 Debt:** `sum(price_tiyin of customer tracks in READY_FOR_PICKUP or
  DELIVERED, excluding soft-deleted) − sum(payments)`. Negative → display as
  `Avans: {abs} so'm` (green), never "-". Debt is ALWAYS in som.
- **7.6 Notification dedupe:** skip if an identical (track_id, status) job was
  enqueued within the last 60 seconds.
- **7.7 Weekly reminders:** pg-boss repeatable job per tenant setting;
  skip customers with debt ≤ 0; timezone Asia/Tashkent.
- **7.8 Soft delete:** `tracks.deleted_at` (nullable). Soft-deleted tracks
  are hidden from every list, lookup, debt calc, and notification.
- **7.9 Storage:** store timestamps in UTC; convert to Asia/Tashkent for all
  display and templates.
- **7.10 Batches:** a batch belongs to a tenant; tracks optionally reference
  it. Changing the batch status applies that status to every member track
  that is NOT in a terminal state (DELIVERED, LOST, RETURNED) and not
  soft-deleted — each gets an event + queued notification, reusing the bulk
  machinery. Batch's own status is limited to CHINA_WAREHOUSE, IN_TRANSIT,
  TASHKENT_WAREHOUSE. Individual tracks may still be moved independently
  afterwards.
- **7.11 Broadcast:** goes to all tenant customers through the same throttled
  queue; record kept in `broadcasts` with final sent count. No segmentation
  in MVP.
- **7.12 Phone matching & customer linking:** the same number arrives spelled
  three ways — Telegram's `998901234567`, an admin's `+998 90 123-45-67`, an
  import's `901234567`. Store `customers.phone_normalized` = digits only, then
  the LAST 9 (the UZ national number length; shorter inputs kept whole, no
  digits → NULL). Always written together with `phone`.
  - Panel customer creation refuses a phone whose key already exists in the
    tenant (5.5), so an admin cannot fork a customer in two.
  - On `/start`, before creating anything, the bot looks for a customer in
    this tenant with the same phone key **and `tg_user_id IS NULL`** — a
    record the admin entered by hand — and links that one (sets `tg_user_id`,
    keeps the office spelling of the name if there is one). Without this the
    person gets a second, empty profile and their imported tracks, debt and
    payments all stay on the first one.
  - The lookup is scoped to `tg_user_id IS NULL` so a row already bound to
    another Telegram account is never stolen, and the UPDATE re-asserts that
    condition so two racing `/start`s cannot both claim it.
  - `phone_normalized` is deliberately **not** uniquely indexed: production
    data predates the column and a company may hold two records for one
    number until an admin merges them. Duplicates are refused in the
    application, where a clash can be reported instead of aborting a bot
    registration mid-flow.

## 8. Non-functional requirements

- Outbound sending ≤ 25 msg/sec global per bot, ≤ 1 msg/sec per chat;
  retry ×5 with exponential backoff; failed-after-retries jobs logged.
  **Per bot** is literal: the budget is keyed by bot token, so one tenant's
  broadcast cannot consume another tenant's allowance, and the 1 msg/sec
  window is per (bot, chat) pair. A send deferred by the per-chat window must
  not push unrelated chats back — the schedule is a set of booked slots, not a
  single moving mark.
- The queue workers take jobs in batches and handle a batch concurrently, so
  throughput is bounded by the send limits above rather than by per-message
  latency. A job that fails is retried on its own; the rest of its batch must
  still complete, or a retry would re-send messages that already arrived.
- Photos: JPEG, max 10 MB; reject others with a clear staff-mode error.
- Auth: argon2id; session cookie httpOnly, secure, 30 days.
- Any bot handler error → pino log + `error_generic` reply only when the
  update was a direct user interaction. The process never exits on a handler
  error.
- Nightly `pg_dump` at 03:00 Asia/Tashkent, keep last 14.

## 9. Out of scope for MVP (do NOT build yet)

Auto volumetric pricing from dimensions (L×W×H input and per-m³ tariffs —
manual override covers this for now), regional delivery module (BTS/pochta
to viloyatlar), courier module, camera-based QR scanning (USB scanners
already work via search input), photo/media broadcasts, online payment
collection (Click/Payme merchant), SMS channel, full China-warehouse web
mini-panel (bot staff mode 3.8 covers weighing + photos for now),
multi-branch tenants, English locale.