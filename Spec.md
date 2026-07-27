# SPEC.md — SERVIO Kargo Functional Specification (v2)

> Bu fayl — loyihaning to'liq texnik topshirig'i. CLAUDE.md bilan birga repo
> ildizida turadi. Promptlar shu faylning bo'limlariga havola qiladi.

If anything below conflicts with CLAUDE.md, stop and ask before implementing.

---

## 1. Roles

- **Customer** — the cargo company's client. Interacts ONLY via the tenant's
  Telegram bot. Never sees the web panel.
- **Tenant admin** — a cargo company employee. One `admin_users` row per
  person, used by BOTH surfaces: the web panel (phone + password) and the bot's
  staff mode (`tg_user_id`). Three roles, named after the job, not a power
  level — the matrix lives in `packages/shared/services/permissions.ts` and is
  the single answer to "may they?" on both surfaces:
  - `owner` — everything, including tariffs, currency, employees, broadcast
    and deletion. Shown to users as **Administrator** / **Администратор**: the
    person running the panel is not necessarily the company's proprietor, and
    "Egasi" read as a claim about ownership rather than about access. The enum
    value stays `owner` — it is an identifier, not a label.
  - `manager` — the daily operation: import, assignment, weighing, payments,
    debt chasing. Cannot reprice the company, message every customer at once,
    delete history, or grant access.
  - `warehouse` — weighing, photos, statuses, customer lookup, and ONE
    customer's balance at handover. No cash, no company figures.

  Permission is enforced server-side in every Server Action, not by hiding
  controls. Employees are never deleted (their tracks and payments name them);
  they are deactivated, which also ends every session and their bot access.
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

Immediately after registration the bot also sends the `help_card` (3.12) — a
brand-new customer is looking at seven unexplained buttons and this is the
cheapest moment to say what they do.

### 3.2 Add track
Prompt the user (prompt carries an inline `❌` cancel — see 3.11), accept one
message with one or MANY codes (any separators: newlines, commas, spaces).
Normalize each candidate line, then per code: already claimed by this user →
skip silently in summary count; exists unattached → claim; belongs to another
customer → refuse politely; new → create with status CREATED and attach. Reply
with the grouped summary (4.3) plus the `➕ / 📦` follow-up row (3.11).

### 3.3 My tracks
Group user's non-deleted tracks by status in pipeline order. Each line:
`{emoji} {code_original}`; for READY_FOR_PICKUP also append
` — {weight} kg, {price} so'm` when set. Paginate 10 per page with inline
`◀️ / ▶️` buttons plus a `🔄` refresh. One tappable button per track opens its
card **in place** (3.11). Empty state text in 4.1.

### 3.4 Balance
Show debt (or advance if negative) + last 5 payments as
`{DD.MM.YYYY} — {amount} so'm ({method label})`, followed by a `📦` shortcut
back to the tracks list (3.11).

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
set, photo if exists. Otherwise → short help text plus the `📦 / 💰 / ℹ️`
shortcut row (3.11): a customer who wrote something the bot did not understand
is the least likely to go hunting through the reply keyboard.

A card reached from the tracks list is rendered as text and offers `📷` when a
photo exists, because a text message cannot be edited into a photo message and
in-place navigation (3.11) is worth more than an inline picture. A card reached
by free-text lookup is a new message and keeps the photo attached.

### 3.7 Language switch
`🌐` button toggles and persists `customers.lang`. Re-render menu. For an
already-registered customer the prompt is `lang_choose`, NOT the `welcome`
copy — being greeted as a new arrival reads as having been logged out. The
buttons are removed from the message once a language is picked.

### 3.8 Staff mode (photo + weighing)
If `from.id` matches an ACTIVE `admin_users` row of this tenant
(`admin_users.tg_user_id`), two extra behaviors on top of the normal customer
menu. Every role qualifies — an owner weighs parcels too. An employee links
their account by sending their invitation code to the bot (5.12); an owner
revokes it by deactivating them or unlinking their Telegram, and both take
effect on the next update.
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
`🧮` → `calc_step_tariff` with inline buttons of ACTIVE tariffs (name only) +
`❌` cancel → `calc_step_kg` asking for a weight (accept `3.2`, `3,2`, `3`),
also with `❌` → reply `calc_result` (4.5) + a `🧮 recalc` button.
Never writes anything to the DB. Invalid number → re-ask once with hint.

Both steps are numbered `1/2` and `2/2` and both are cancellable: the flow
hijacks the customer's next plain message, so without a visible exit a mistyped
trek code is silently read as a weight.

### 3.10 China warehouse address
`🇨🇳` → send `china_addr_header` + the tenant's `china_address_template`
rendered in a monospace block with `{client_code}` substituted, then
`china_addr_footer` reminding the client to write their code on every box.
If the template is empty → `china_addr_missing` fallback text.

### 3.11 Inline navigation
Every message that ends a flow carries an inline row saying where to go next.
The reply keyboard stays as the permanent main menu; these buttons are what
make the *result* of an action actionable.

Callback-data grammar — `action[:arg][:modifier]`:

| data | effect |
| ------------------- | ------------------------------------------------- |
| `lang:uz` \| `lang:ru` | pick a language |
| `mytracks:{page}` | render that page **in place** (also the "back" target) |
| `mytracks:{page}:refresh` | re-read it; answer `refreshed` / `refreshed_no_change` |
| `track:{id}` | open a track's card, replacing the list message |
| `track:{id}:refresh` | re-read that card |
| `photo:{id}` | send the warehouse photo as its own message |
| `calc:{tariffId}` | pick a tariff |
| `calc:restart` | run the calculator again |
| `addmore` | re-open the add-track prompt |
| `balance` \| `help` | open that card |
| `cancel` | abandon the pending prompt; strip the button, keep the text |

Rules:
- **Opening a track edits the list, it does not append to it.** Opening five
  parcels and coming back must cost one message, not eleven, and the list the
  customer returns to must be the live one.
- Every prompt that consumes the customer's next message (add-track, calculator
  weight) MUST carry `cancel`.
- A refresh always answers the callback query with a result, so a button that
  found nothing new still visibly did something.
- Callback handlers are ownership-scoped exactly like the flows they mirror: a
  `track:{id}` for someone else's parcel answers `lookup_not_found`.

### 3.12 Help
`/help`, the `help` callback and the post-registration follow-up all send
`help_card`: a numbered "how this works" (get the code → send it → the bot
notifies you) plus one line per menu section. It exists because the reply
keyboard shows seven labels and explains none of them — in particular that a
bare trek code typed into the chat is itself a query (3.6).

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
- ask_tracks — uz: `Trek kodlarini yuboring 👇\nBir nechtasini birdaniga yuborsangiz ham bo'ladi — har birini yangi qatorga yozing.`
- no_tracks — uz: `Hozircha yuklaringiz yo'q. ➕ Trek qo'shish tugmasi orqali trek kodingizni yuboring.`
- help_fallback — uz: `Tushunmadim 🤔\nTrek kodini yuboring yoki quyidagi tugmalardan birini tanlang.`
- error_generic — uz: `Xatolik yuz berdi, birozdan so'ng qayta urinib ko'ring.`
- lang_choose — uz/ru (identical, both scripts): `Tilni tanlang / Выберите язык:`
- cancelled — uz: `Bekor qilindi.`
- refreshed / refreshed_no_change — callback-answer toasts, uz:
  `Yangilandi` / `O'zgarish yo'q`
- help_card (3.12) — a numbered three-step "how this works" followed by one
  line per menu section. Held as an array joined with `\n` in the catalogues so
  the steps stay individually editable.
- nav.* — inline button labels (3.11): `backToList`, `refresh`, `myTracks`,
  `addMore`, `balance`, `cancel`, `recalc`, `photo`, `menu`.
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
- calc_step_tariff — uz: `🧮 1/2 · Tarifni tanlang`
- calc_step_kg — uz: `🧮 2/2 · Og'irlikni kiriting (kg), masalan: 3.2`
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

## 5. Admin panel screens (all tenant-scoped, uz + ru)

The panel runs next-intl **without i18n routing**: paths stay `/tracks`,
`/customers/:id`, and the locale comes from the `NEXT_LOCALE` cookie, seeded at
login from `admin_users.lang` and switchable from the account menu or Settings
(5.9). Uzbek is the default, Russian secondary — Tashkent office staff often
work in Russian while their customers read Uzbek, which is why this is the
ADMIN's language and separate from `customers.lang`.

Panel strings live in `apps/web/messages/{uz,ru}.json`. Domain vocabulary the
bot also sends to customers (status names, worklist labels, payment methods,
Excel headers) stays in `packages/shared` and is read with the panel's locale —
two copies would drift the moment one side is edited.

- **5.1 /login** — telefon + parol. One generic error for any bad pair
  (`auth.invalidCredentials`).
- **5.2 /tracks** — table: Kod, Mijoz (client_code + ism, link), Status
  (colored badge), Reys, Og'irlik, Narx, Sana. Header carries `⬇️ Excel`
  (5.11). Filters: status dropdown,
  reys dropdown + search (code / customer name / phone), plus the operational
  worklists of 5.10 as `?work=<unassigned|to_weigh|stale_pickup>`. A worklist
  replaces the status chips with a labelled banner and a `✕ Filtrsiz` exit,
  because each one already implies a status; it combines with search, reys and
  the Excel button, which exports exactly the worklist on screen (5.11). The
  search input
  works with a USB barcode scanner out of the box (scanner = keyboard input
  ending with Enter → run search). Row checkboxes → bulk bar with THREE
  actions: `Status o'zgartirish` → modal: status select + `{N} ta trek
  tanlandi, {M} ta mijozga xabar yuboriladi` → confirm; `Reysga
  biriktirish` → modal: batch select → confirm; and `Mijozga biriktirish`
  → customer picker (7.3) → confirm. The customer picker states plainly
  that no message is sent.
  An unclaimed row shows `+ Biriktirish` in the Mijoz column instead of grey
  `Biriktirilmagan` text: it opens the same picker for that one track. Attaching
  owners is the daily job behind `?work=unassigned`, and routing every single
  parcel through the bulk bar costs three taps instead of one. Roles without
  `tracks.assign` see the plain text — warehouse staff move parcels, they do
  not decide whose they are (9).
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
  (red if > 0). Header carries `⬇️ Excel` (5.11). Paged 20 per page like
  /tracks, with search and page carried together in the URL; the header count
  is the total, not the page. Track count and debt are aggregated in SQL, not
  by reading the tenant's tracks and payments into memory.
  `Yangi mijoz` button → telefon (majburiy) + ism (ixtiyoriy);
  `client_code` avtomatik, `tg_user_id` NULL until the person opens the bot
  (7.12). A phone that already belongs to a customer is refused, and that
  customer is offered instead — no silent duplicate.
  **/customers/[id]** — info, tracks, payments history (with `⬇️ Excel` for
  that customer's statement, 5.11),
  `To'lov qo'shish` (summa so'mda, usul: naqd/Click/Payme/boshqa, izoh),
  `Eslatma yuborish` button.
- **5.6 /debtors** — customers with debt > 0, sorted desc (ties broken by
  client_code so paging is stable). Header carries `⬇️ Excel` (5.11).
  Per-row `Eslatma` + top `Barchasiga eslatma yuborish` (confirm with count).
  The list is paged 20 per page, but the summary card (total debt, debtor
  count) and `Barchasiga eslatma` stay whole-tenant: the owner reads that total
  as the number for the business, and a figure that shrank because they turned
  to page 2 would be worse than no figure at all.
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
  - **Panel tili**: `O'zbekcha` / `Русский` — the signed-in admin's own UI
    language (§5 preamble). Labels are written in their own language, never
    translated: an admin who has landed in a language they cannot read has to
    be able to find their way out. Also reachable from the account menu.
  - Olib ketish manzili, ish vaqti, aloqa telefoni.
  - **🇨🇳 Xitoy ombori manzili**: textarea, hint `{client_code} — mijoz kodi
    o'rniga qo'yiladi`.
  - **Ma'lumot matni** (info_text): textarea — taqiqlangan yuklar, qoidalar.
  - **Xodimlar** — a link to 5.12. Employees used to be edited right here as
    a list of raw Telegram ids in `settings.staff_tg_ids`: no names, no roles,
    and no way to revoke panel access. That field is retired.
  - Haftalik avto-eslatma (toggle + kun + soat, default Dushanba 10:00).
  - Bot username (read-only), webhook holati indikatori + `Webhookni qayta
    o'rnatish` button.
- **5.10 /dashboard (Bosh sahifa)** — the post-login landing page. Period
  toggle: `Bugun / 7 kun / 30 kun` (Asia/Tashkent day boundaries — careful
  with the UTC offset).

  The **first** block is `Bugungi ish` — pending work, NOT period-scoped,
  because a package unweighed since last week is still today's job. Three
  counted rows, each a link to the same filter on `/tracks?work=…` (5.2):

  | Worklist | Row | Selects |
  | -------------- | ------------------ | ------------------------------------------------- |
  | `to_weigh` | ⚖️ Tortish kerak | `CHINA_WAREHOUSE` and `weight_grams IS NULL` |
  | `unassigned` | 🙋 Biriktirilmagan | `customer_id IS NULL` |
  | `stale_pickup` | ⏳ Olib ketilmagan | `READY_FOR_PICKUP` for more than 7 days |

  The worklists deliberately overlap (an unowned unweighed track is in two of
  them); each answers its own question. "For more than 7 days" is measured
  from the **latest** `READY_FOR_PICKUP` event in `track_events`, not from
  `tracks.created_at` — a track that went ready → delivered → ready again is
  judged by its current readiness; `created_at` is only the fallback when the
  audit log has no such row. It is a rolling 7×24h window, not a calendar day.
  All three counts come from one query built from the same conditions the
  `/tracks` filter uses, so a card can never send the admin to an empty list.
  When all three are zero the block collapses to a single `Navbat bo'sh` line.

  Below it, six stat cards: 📦 Xitoyda qabul qilingan
  (CHINA_WAREHOUSE events in period), 🇺🇿 Toshkentga kelgan, 🎉 Topshirilgan
  (count + jami kg + jami summa), 💰 Tushum (payments sum in period),
  👥 Yangi mijozlar, 🔴 Jami qarzdorlik (current total, not period-based)
  + qarzdorlar soni. Last: one bar chart — daily tushum for the
  last 14 days. Read-only; single tenant-scoped aggregate queries, no N+1.
  Debtor count/total are one SQL aggregate over the 7.5 rule (never a full
  debtor list) — the same aggregate backs the nav badge, which runs on every
  page load.
- **5.11 Excel eksport** — a `⬇️ Excel` button in the header of every list
  screen downloads exactly the rows **currently filtered on screen**, never the
  whole table:

  | Screen | File (uz / ru) | Contents |
  | ---------------- | ----------------------------------- | ------------------------------------------- |
  | `/tracks` | `treklar` / `treki` | search + status + reys filters applied |
  | `/customers` | `mijozlar` / `klienty` | search applied, with the qarz column |
  | `/debtors` | `qarzdorlar` / `dolzhniki` | debt > 0, largest first |
  | `/customers/[id]` | `tolovlar` / `platezhi` | that customer's payment statement |

  (each followed by `-YYYY-MM-DD.xlsx`)

  Rules:
  - Soft-deleted tracks never appear (7.8), and debt/track counts exclude them.
  - Money is written as a **number in so'm** and weight as a **number in kg**,
    with the unit in the column header — a formatted `"1 250 000"` string is
    text to Excel and `SUM()` over it returns 0. A negative qarz (avans, 7.5)
    keeps its sign so the column still totals correctly.
  - Timestamps are `DD.MM.YYYY HH:mm` text in Asia/Tashkent (7.9), not Excel
    date serials, which carry no timezone.
  - The sheet — headers, status names, payment methods — is written in the
    admin's panel language (§5 preamble). A spreadsheet leaves the building:
    an owner forwards it to an accountant, so it must read the way the person
    who exported it reads.
  - File-name stems stay ASCII (transliterated for ru): a non-ASCII plain
    `filename=` in Content-Disposition is mangled by some Windows browsers.
  - The date in the file name is the Tashkent calendar day.
  - Max 50 000 rows per file. Beyond that the file itself carries a warning
    row naming the true total — an export is never silently partial.

- **5.12 /settings/team (Xodimlar)** — owner only. One row per employee:
  name, role, phone, whether Telegram is linked, and when they last signed in.
  Per row (`⋮`): change role, issue an access code, revoke a pending code,
  unlink Telegram, sign them out of every device, deactivate / reactivate.

  **An owner never sets a colleague's password.** Knowing it would let them act
  as that person, which would quietly void `created_by` on payments and track
  events. Instead the owner enters a phone, a name and a role, and gets a
  6-character code (`ABC-234`) valid for 24 hours:
  1. the employee opens `/login` → «Menda taklif kodi bor»;
  2. enters their phone, the code, and a password they choose;
  3. a warehouse employee sends the same code to the bot, which links their
     Telegram (3.8). Panel and bot access are independent — a warehouse hand
     may only ever use the bot, and their row carries no password until invited.

  The code alphabet omits `O`/`0` and `I`/`1`: it is dictated down a phone to a
  noisy warehouse. It is stored in the clear so the owner can re-read it an
  hour later, which is safe — 6 characters of 32 symbols (~10^9), scoped to one
  phone in one tenant, expiring in 24 hours, dead on first use.

  **Guard rails:** the last active owner cannot be demoted or deactivated (a
  company with no owner has no way back in), and nobody can deactivate
  themselves. Deactivating, changing a password, redeeming an invite and «sign
  out everywhere» all bump `admin_users.session_epoch`, which invalidates every
  cookie ever issued for that person — sessions are stateless 30-day tokens, so
  without it a departing employee's phone kept working for a month. Changing a
  ROLE does not bump it: the role is read from the row on every request, so it
  applies immediately without signing a working colleague out mid-shift.

  Every employee, whatever their role, can change their own password from the
  account menu (current password required).

- **5.13 Audit trail** — `track_events.created_by`, `payments.created_by`,
  `customers.created_by` and `broadcasts.created_by` name the employee.
  The track timeline resolves them to a person, `staff:<telegram id>` included,
  and marks bot-originated actions `· bot` — same employee, and an owner
  reading the trail cares where it happened. The payment ledger and the
  payments export both carry the cashier's name; the dashboard shows the
  period's cash split by employee (owner only), which is how a cash business
  closes its day.

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
- Every bulk write — import, panel bulk status change, batch propagation,
  bulk customer assignment — runs in ONE transaction and is issued in
  fixed-size chunks, so a 2 500-track flight costs a handful of statements and
  either fully applies or not at all. Half a flight moved is worse than none:
  the admin cannot tell which half, and one warehouse shelf ends up in two
  states.
- Notifications for a bulk write are enqueued only AFTER that transaction
  commits, and in bulk. The queue writes on its own connection, so a job sent
  mid-transaction would outlive a rollback and message customers about a state
  that was never stored; and one enqueue per track would leave the admin's
  request waiting on thousands of round trips. The (track, status) dedupe of
  7.6 applies to a bulk enqueue exactly as to a single one.
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