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

Main menu (reply keyboard, 2 columns, 5 rows):
- uz: `➕ Trek qo'shish` `📦 Mening yuklarim` / `🧮 Kalkulyator` `💰 Balans` /
  `🇨🇳 Ombor manzili` `ℹ️ Ma'lumot` / `🪪 Mening kartam` `✍️ Murojaat` /
  `🌐 Til / Язык`
- ru: `➕ Добавить трек` `📦 Мои посылки` / `🧮 Калькулятор` `💰 Баланс` /
  `🇨🇳 Адрес склада` `ℹ️ Информация` / `🪪 Моя карта` `✍️ Обращение` /
  `🌐 Til / Язык`

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
` — {weight} kg, {price} so'm` when set — where `{weight}` is the CHARGEABLE
weight and carries `(hajmiy)` when volume set the price (7.16). A kg figure
printed next to a so'm figure must be the kg that so'm came from; the Mini App
list follows the same rule. Paginate 10 per page with inline
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
Any plain message whose normalized form is 8–20 alphanumerics → status card.
What the card contains depends on WHO is asking (F1, 2026-08-15 — same
data rule as the public Mini App lookup, 10.2):

- **The track's owner** (registered customer whose `customer_id` matches) or
  **active staff** (3.8): full card — code, current status (emoji + label),
  last event date, batch line `🚚 Reys: {batch_name} · Taxminan:
  {eta DD.MM.YYYY}` when the track belongs to a batch that is not yet in
  TASHKENT_WAREHOUSE or later, weight/price if set, photo if exists. When
  volume set the price, the weight line names both numbers and why
  (`Hisob vazni: 8.0 kg (hajmiy) · haqiqiy 5.2 kg`, 7.16).
- **Anyone else** (another customer, an unregistered user, an unclaimed
  track): status + last event date + batch line ONLY — never weight, price,
  photo or owner. A registered customer also gets the hint that sending the
  code via `➕` claims it (3.2). Weight and price are commercial data
  between the company and that customer; a code is not a secret capability.

Otherwise → short help text plus the `📦 / 💰 / ℹ️`
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
   `/data/uploads/{tenantId}/{trackId}/{photoId}.jpg`, add to the parcel's
   photos as `intake` (7.14 — each shot is a new photo, nothing overwritten),
   confirm.
2. **Weighing**: caption or plain text of the form `CODE 3.2 [MARKA]` (weight
   in kg, dot or comma; the marka optional) → set weight_grams, compute price
   per 7.4, and link the photo when present. If the track was in CREATED →
   move it to CHINA_WAREHOUSE (event + customer notification). Unknown code →
   CREATE the track unattached (customer_id NULL) with the given weight and
   status CHINA_WAREHOUSE so the client can claim it later; tell staff it is
   new. A marka attributes the parcel exactly as on the /weigh console
   (5.14) — same shared planner, same refusal to move a parcel that already
   belongs to somebody else. A third token only counts as a marka if it
   carries a digit, so `CODE 3.2 kg` still means 3.2 kg. The typed marka is
   saved onto the track as box evidence per 7.13, whatever it resolved to.
   Replies per 4.5 staff strings.

   This is the FALLBACK channel: Telegram is blocked in China, so 5.14 is the
   primary weighing surface and this one is what still works when someone is
   away from the desk or on their own phone.

### 3.9 Calculator
`🧮` → `calc_step_tariff` with inline buttons of ACTIVE tariffs (name only) +
`❌` cancel → `calc_step_kg` asking for a weight (accept `3.2`, `3,2`, `3`),
also with `❌` → `calc_step_dims` asking for `U×K×B` in cm, with
`⏭ O'tkazib yuborish` → reply `calc_result` (4.5) + a `🧮 recalc` button.
Never writes anything to the DB. Invalid number → re-ask once with hint.

The third step is **optional and skippable** (D-007): skipping it prices pure
kg, exactly as the two-step flow always did. Dimensions are accepted as
`50x40x30`, `50 40 30` or `50*40*30` — three integers however the customer
separates them — and the answer then quotes the chargeable weight and says
volumetric when volume won (7.16). A tariff whose parcel would not be affected
never mentions volume at all.

All three steps are numbered `1/3` … `3/3` and all are cancellable: the flow
hijacks the customer's next plain message, so without a visible exit a mistyped
trek code is silently read as a weight.

### 3.14 Client card (`🪪 Mening kartam`, tasks.md L1 — D-009)
`🪪` (or `/karta`) → a QR image of the customer's `client_code`, captioned with
the code itself in monospace and one line telling them to show it at the
counter. Also reachable from the Mini App (10.2).

The QR encodes the **plain client code**, nothing else (D-009). It is not a
credential: it selects a customer at a counter where the employee then sees
their name, phone and balance before doing anything (5.14, 5.15). The code is
already written on their boxes (7.13), so a QR that reveals it reveals nothing.
The readable code under the image is the fallback for a scuffed print, a dead
camera, or a customer reading it down the phone.

Unregistered users get the same "register first" reply the ticket flow gives —
there is no code to show yet.

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
| `issue:{trackId}` | start a ticket bound to the customer's own track (3.13) |
| `tcat:{category}` | pick a ticket category (3.13) |
| `tcont` \| `tnew` | continue the closed ticket / start a fresh one (3.13) |
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

### 3.13 Support tickets (`✍️ Murojaat` — D-004, D-006, tasks.md H3)

Every problem used to be a phone call that left no trace. A ticket is the
dispute living where the work is: category, status, an assigned employee and
the full message history. The customer writes from the bot; **staff reply only
from the panel** (5.16, D-006) — the bot is the delivery channel, never the
staff surface.

Entry points:
- `✍️ Murojaat` main-menu button.
- `⚠️ Muammo bor` inline button on the customer's OWN track card (3.6) — a
  NEW ticket starts bound to that track. Never on the limited card. Both
  entry points run the SAME flow below — with an open ticket the message
  joins it (step 1, binding untouched); the track binding applies only when
  a new ticket is actually created.

Flow (registered customers only — 4.1 asks others to register first):
1. If the customer has an OPEN or IN_PROGRESS ticket: show its one-line header
   (`{category} · {status}`) and prompt for the next message (with `❌`).
   The reply is appended to that ticket as a customer message. One open
   dispute at a time keeps the history in one place.
2. Else, if their LATEST ticket is closed: inline choice —
   `🔄 Davom ettirish` (append to it; the append REOPENS it, D-006) /
   `🆕 Yangi murojaat` / `❌`.
3. Else (or after `🆕`): category picker — vazn / shikast / yo'qolgan /
   to'lov / boshqa (inline, one row of emoji buttons + `❌`) → text prompt →
   create the ticket (`open`) with that first message. Confirm with
   `ticket_created` (4.6).

A customer message landing in a ticket that is `closed` at write time flips it
back to `open` (D-006) — "the problem came back" must never be silently filed
into a closed case. Statuses and category names shown to the customer come
from the shared catalogue (rule 5) — the panel shows the same words.

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
- calc_step_tariff — uz: `🧮 1/3 · Tarifni tanlang`
- calc_step_kg — uz: `🧮 2/3 · Og'irlikni kiriting (kg), masalan: 3.2`
- calc_step_dims — uz: `🧮 3/3 · O'lchamlarni kiriting (sm): uzunlik×kenglik×balandlik, masalan: 50x40x30`
- calc_result — uz: `🧮 {tariff_name}\n{kg} kg ≈ {price} so'm{usd_part}\n\nAniq summa yuk tortilganda hisoblanadi.`
  where `{usd_part}` = ` ({usd}$)` in USD mode, else empty.
- calc_result_volumetric — uz: `🧮 {tariff_name}\nHisob vazni: {kg} kg (hajmiy) · haqiqiy {actual_kg} kg\n≈ {price} so'm{usd_part}\n\nAniq summa yuk tortilganda hisoblanadi.` — used only when volume won (7.16)
- calc_invalid — uz: `Raqam kiriting, masalan: 2.5`
- calc_dims_invalid — uz: `O'lchamlarni shunday kiriting: 50x40x30 (sm)`
- calc_dims_skip — uz: `⏭ O'tkazib yuborish`
- china_addr_header — uz: `🇨🇳 Xitoy ombori manzili — sotuvchiga (постовщик) shuni yuboring:`
- china_addr_footer — uz: `❗️ Har bir qutiga shu kodni yozdirishni unutmang: {client_code}`
- china_addr_missing — uz: `Manzil hali kiritilmagan. Administrator bilan bog'laning: {contact_phone}`
- staff_saved — uz: `✅ {code}: {kg} kg → {price} so'm`
- staff_volumetric_note — uz: `📐 Hajmiy vazn bo'yicha hisoblandi: {kg} kg` — appended to any staff weighing reply the parcel's stored volume priced (7.16), so the fallback channel says what the console shows as a tag
- staff_saved_new — uz: `🆕 {code}: yangi trek yaratildi ({kg} kg → {price} so'm). Mijoz hali biriktirilmagan.`
- staff_photo_ok — uz: `📷 {code}: rasm biriktirildi.`
- staff_not_found — uz: `❓ {code} topilmadi. Vazn bilan yuborsangiz, yangi trek sifatida yarataman, masalan: {code} 3.2`
- Broadcast messages have no wrapper — admin's text is sent as-is.
- ru variants for all of the above.

### 4.6 Ticket strings (3.13, 5.16 — D-004/D-006)
- ticket_ask_category — uz: `Muammo qaysi turga tegishli?`
- ticket_ask_text — uz: `Muammoni yozib yuboring — imkon qadar batafsil:`
- ticket_created — uz: `✅ Murojaatingiz qabul qilindi. Javobni shu botda olasiz.`
- ticket_appended — uz: `✅ Xabaringiz murojaatga qo'shildi.`
- ticket_open_header — uz: `📮 Ochiq murojaatingiz: {category} · {status}\nYangi xabar yozing:`
- ticket_closed_choice — uz: `Oxirgi murojaatingiz ({category}) yopilgan. Davom ettirasizmi yoki yangi ochasizmi?`
- ticket_reply (staff reply delivery, H4) — uz: `💬 Murojaatingizga javob ({category}):\n\n{text}\n\nJavob yozish uchun: ✍️ Murojaat`
- ticket_closed_notice (H4) — uz: `✅ Murojaatingiz ({category}) yopildi. Yana muammo bo'lsa — ✍️ Murojaat.`
- Category and status names live in `packages/shared` (rule 5): categories
  vazn/shikast/yo'qolgan/to'lov/boshqa, statuses ochiq/jarayonda/yopiq.
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
  reys dropdown + search (code / customer name / phone / marka, 7.13), plus the operational
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
  price per 7.4), an optional `U × K × B (sm)` row of three integer fields
  (7.16) with the resulting `Hajmiy: {kg} kg` and, when it wins, the
  `Hisob vazni` the price was built on, price field with `Qo'lda kiritish`
  toggle (manual override, 7.4), batch display, photo gallery (7.14: every photo with its kind badge
  and date; upload with a kind choice, per-photo delete — both behind
  `tracks.weigh`), event timeline (status, date, who),
  customer card, and a metadata card: marka, tavsif, izoh (7.13) shown when
  set and edited in place (`tracks.edit`). `O'chirish` = soft delete with
  confirm.
  The customer card is also the assignment control (7.3): unattached →
  `Biriktirish`; attached → `O'zgartirish` / `Ajratish` next to the profile
  and call shortcuts. Both open the customer picker: search by
  client_code / ism / telefon, plus `Yangi mijoz qo'shish` inline (5.5) for
  the common case that the owner is not in the system yet. The picker also
  carries the QR scan button (L2, D-009) — one component, so the handover
  counter (5.15), assignment and the track page all gained it at once; a scan
  fills the search and picks the customer outright when it matches exactly one.
  Where the camera or `BarcodeDetector` is missing there is simply no button
  (the 5.14 rule), and typing keeps working.
  Assignment events appear in the timeline as `Mijozga biriktirildi` /
  `Mijozdan ajratildi` / `Mijoz o'zgartirildi`, not as a status.
- **5.4 /import** — 4 steps:
  1. Upload `.xlsx` OR paste raw text (textarea). Text pasted WITH tabs is read
     as columns (copy out of Excel); without tabs it stays one code per line.
  2. **Ustunlar** — column mapping. A cargo Excel is a table, not a bag of
     codes: the admin binds each column to `Trek kodi` (majburiy), `Mijoz`,
     `Vazn (kg)`, `Narx (so'm)` and `Tavsif` (7.13; needs `tracks.edit`),
     with a `Birinchi qator — sarlavha` toggle
     and a 6-row sample of the file. The layout is GUESSED first (header
     keywords in uz/ru/en, and the code column verified against the data), so
     the usual file needs no touching. Only the fields the role may write are
     offered (`tracks.assign` for the owner column, `tracks.weigh` for kg and
     price — rule 9, enforced server-side too).
  3. Preview: counts + expandable lists — `Yangi: {n}`, `Yangilanadi: {n}`
     (already in DB), `Xato qator: {n}` (skipped), plus, when those columns are
     mapped, `Mijozga biriktiriladi: {n}`, `Mijoz topilmadi: {n}`,
     `Vazn kiritiladi: {n}`, `Narx kiritiladi: {n}` and the kg/price cells that
     could not be read. Every count describes what will CHANGE, not what the
     file holds (see 7.2). Status select applied to all + OPTIONAL `Reys`
     select (attach all imported tracks to a batch).
  4. Apply → result: created / updated / attached / filled /
     `{M} ta xabar navbatga qo'yildi`, plus the two things the run leaves
     behind (7.18): `↩️ Importni bekor qilish` while the undo window is open,
     and `⬇️ Muammoli qatorlar` whenever the file had any.

  The file (or the pasted text) is re-sent at every step and re-parsed
  server-side; the browser never hands back a list of rows to write. Capped at
  10 000 rows and 12 columns per run.

  The page also carries **`Oxirgi importlar`** — the last 10 runs of this
  tenant (time, who, status, the same counts), each with the same two buttons
  under the same rules. Without it the undo would live only on a result screen
  the admin has already navigated away from, which is exactly the minute they
  realize the file was wrong.
- **5.5 /customers** — search; columns: Kod, Ism, Telefon, Treklar, Qarz
  (red if > 0). A `🚫 Bloklaganlar` filter chip narrows the list to customers
  whose bot looks blocked (7.17) and carries in the URL beside the search and
  the page, so the count in the header is the count of that filter.
  Header carries `⬇️ Excel` (5.11). Paged 20 per page like
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
  broadcasts (date, first 80 chars, `{sent} / {recipients}`, and a
  `Bekor qilindi` badge on a stopped one).
  - **`📤 Menga test yubor`** (tasks.md K1, D-008) sends the typed text to the
    signed-in employee's OWN Telegram chat (`admin_users.tg_user_id`) through
    the same queue and rate limiter every other message uses. Disabled with a
    hint when that employee has not linked their Telegram in the bot — the
    honest state, rather than a button that silently does nothing. A test is
    not a broadcast: no `broadcasts` row, no `message_log` entry, no count.
  - **The hold window** (K2, D-008): confirming does NOT send. The fan-out is
    queued with a 60-second delay and the screen shows a countdown with
    `Bekor qilish`. Inside the window, cancelling means **nobody received
    anything**. After it, the same control becomes `To'xtatish`: what has gone
    out has gone, the rest is never sent. Both write the same thing — see 7.11.
  - Sending is `broadcast.send`; stopping one is the same capability (whoever
    may fire it may stop it), and `broadcasts.cancelled_by` records who did.
- **5.9 /settings** — grouped form:
  - **Tariflar**: CRUD list (nomi, narx per kg, `asosiy` radio = default,
    faol/nofaol). At least one active default tariff must always exist.
    The edit dialog also holds `Hajmiy koeffitsiyent (kg/m³)` — default 167,
    the air standard; a road tariff usually wants 200–333 (7.16). It is a
    plain required number there, with a hint saying it only applies to
    parcels whose dimensions were entered.
  - **Valyuta**: `UZS` / `USD` radio; if USD → `Kurs (1$ = ? so'm)` input.
  - **Panel tili**: `O'zbekcha` / `Русский` — the signed-in admin's own UI
    language (§5 preamble). Labels are written in their own language, never
    translated: an admin who has landed in a language they cannot read has to
    be able to find their way out. Also reachable from the account menu.
  - Olib ketish manzili, ish vaqti, aloqa telefoni.
  - **🇨🇳 Xitoy ombori manzili**: textarea, hint `{client_code} — mijoz kodi
    o'rniga qo'yiladi`.
  - **Ma'lumot matni** (info_text): textarea — taqiqlangan yuklar, qoidalar.
  - **Xodimlar** — a link to 5.12 (`settings.staff_tg_ids` is retired).
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
  + qarzdorlar soni. Beside the undelivered-messages card, 🚫 `Botni
  bloklaganlar` — a current count (not period-scoped, 7.17) linking to the
  /customers filter. Zero renders as a quiet zero, not a hidden card: "nobody
  blocked us" is worth seeing before a broadcast. Last: one bar chart — daily tushum for the
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

- **5.14 /weigh (Tarozi rejimi)** — the warehouse weighing console, for anyone
  with `tracks.weigh`. Deliberately outside the panel shell: full screen, no
  sidebar, no tab bar, one exit link. **Telegram is blocked in China**, which
  is exactly where parcels are weighed, so the bot's staff mode (3.8) needs a
  VPN at the receiving post while an ordinary web page opens; the console is
  the primary surface and the bot stays the fallback channel.

  Flow: `kod` (autofocus — a USB scanner types and presses Enter, which moves
  to the weight rather than saving an entry with no weight) → `og'irlik` →
  optional `marka` (the customer's client_code, written on the box) → Enter →
  next parcel. Signing in as `warehouse` lands here instead of /dashboard.

  **Dimensions (7.16)** hang off that flow without entering it: a
  `+ O'lcham` toggle under the form reveals three `sm` fields, and while it is
  closed the tab order and the Enter-saves rule are exactly as before — the
  overwhelming case is a box that gets weighed and moves on, and the scanner
  operator must never pay for a field they do not use. Left blank on a track
  that already has dimensions, they are kept, not cleared (7.16). The day list
  shows a `hajmiy` marker on the rows where volume set the price, so the
  operator sees the one number a customer will ask about.

  What one entry does is 3.8 plus attribution, decided by one shared planner
  the bot calls too: weight → auto price (7.4), a CREATED parcel advances to
  CHINA_WAREHOUSE with an event and an owner notification, an unknown code is
  created unattached, and a marka naming a customer attaches an **unowned**
  parcel right there — the newly attached owner gets the arrival message,
  because they are its owner at the instant the event is written. A marka
  matching nobody is not an error (the parcel is real either way), and a marka
  naming somebody else NEVER moves the parcel: weight and price are written,
  the owner is left alone, the operator is warned. A mistyped marka must not
  move a parcel, and its debt, onto the wrong person. Whatever the marka
  resolved to, the typed string itself is saved onto the track (7.13) — in a
  conflict, "the box says DK-1042" is exactly the evidence the dispute needs.

  Beside the form, today's entries (code, kg, price, owner, warnings), so a
  wrong weight is seen in a second rather than at the end of the shift. The
  list is rebuilt from the audit log on reload, which means re-weighing a
  parcel already past CHINA_WAREHOUSE (no event) shows live but not after a
  refresh. A `marka` lock keeps the field between parcels for a customer whose
  boxes arrive together; it is highlighted while held, because a forgotten
  marka is the one way this screen could mis-attribute silently.

  **Camera scan** — a button beside the code field opens a full-screen scanner
  built on the browser's own `BarcodeDetector` (Android Chrome), no library.
  One scanner reads both things the desk holds: a parcel's barcode goes to the
  code field, and a customer's QR card (3.14) goes to `marka`, decided by the
  SHAPE of what was scanned (`looksLikeClientCode` — prefix letters, a dash,
  digits) rather than by a mode the operator has to remember (L2, D-009).
  Where the API, a camera or a secure context is missing there is no button at
  all rather than one that does nothing; USB-scanner and manual entry are the
  baseline and never depend on it. Only formats the device reports supporting
  are requested — a detector built with an unsupported one throws on every
  frame — and closing the sheet stops the camera tracks.

  **Photo** — each entry in the day list carries a camera button: JPEG, max
  10 MB, stored per 7.14 as a new `intake` photo (re-shooting adds another
  shot; nothing overwrites), exactly how the bot's staff-photo flow (3.8)
  stores one. Uploaded to
  `POST /api/tracks/:id/photo` rather than a Server Action, whose request body
  is capped at 1 MB — a phone camera clears that on the first shot. The upload
  is guarded by `tracks.weigh`, and the DB write doubles as the tenant check.

### 5.15 Handover screen (`/handover`, tasks.md G, D-003)

The busiest hour of a cargo office is the pickup counter: a customer stands
there, the admin must mark parcels DELIVERED **and** take the money — until
now two separate flows on two screens. `/handover` folds them into one, with
payments staying customer-level (D-003: no per-track allocation; the balance
is the truth).

Flow, one screen, `(app)` group (nav "Topshirish", `tracks.status` to see it):

1. **Pick the customer** — the same picker sheet every flow uses (search by
   code/name/phone; QR scan joins here with L2). Lands on
   `/handover?customer={id}`.
2. **Pick the parcels** — the customer's non-deleted tracks in
   `READY_FOR_PICKUP` **or** `TASHKENT_WAREHOUSE` (both are physically in
   Tashkent; real counters hand over parcels that skipped the "ready" step),
   READY first. All are pre-selected; tapping toggles. Each row: code,
   status badge, weight, price. A track with no price shows a warning mark
   and counts as 0 — the admin can proceed (the price is fixed later on the
   track) but sees that they are doing so.
3. **Take the money** — total of the selected parcels is pre-filled as the
   amount (so'm, editable: PARTIAL payment is typing a smaller number,
   overpay/advance a larger one, and 0 skips the payment entirely) + method
   (cash default). The customer's current balance is shown next to it, and
   the balance AFTER this action previews live. The whole money block is
   rendered only for `payments.record` (a warehouse hand hands over, but
   never takes cash — their screen simply has no money half; with an amount
   > 0 the action re-checks the capability server-side).
4. **One button** — inside ONE transaction: selected tracks → DELIVERED
   (ordinary §2 rules via the shared planner: event per genuine change,
   §4.2 notification per attached customer, enqueued only after commit) +
   one `payments` row (when amount > 0, `created_by` = the admin). If any
   selected track no longer matches (someone else's, deleted, already
   DELIVERED elsewhere) the whole action refuses with a reload hint rather
   than half-applying.
5. **Aftermath** — the screen re-renders: remaining tracks, new balance, and
   a "next customer" reset. The payment lands on the customer page ledger
   exactly like any other payment; a mistake is corrected with the ordinary
   storno (A7).

### 5.16 Tickets (`/tickets`, tasks.md H3 — D-004, D-006)

The dispute desk, for `tickets.handle` (owner + manager — office work; a
warehouse hand's evidence enters as photos and events, not as correspondence).

**List** — status chips `Ochiq (default) / Jarayonda / Yopiq / Hammasi`
(default view = open + in_progress: the queue, not the archive). Each row:
category, customer (client_code + name, link), bound track code when any,
first line of the LAST message, assigned employee (or `—`), last-activity
time. Sorted by last activity, newest first, paged 20. NO SLA timers (D-004).

**Detail** (`/tickets/[id]`) — the thread as bubbles (customer left, staff
right, each with author + time), customer/track cards linking out, and three
controls:
- **Reply** — textarea; sending appends a staff `ticket_messages` row and
  queues delivery to the customer's bot chat through the notify worker
  (H4, §8 rate limits). Outcome lands in `message_log` (kind `ticket`) and is
  shown beside the message — an answer the customer never received must not
  look answered.
- **Status** — open / in_progress / closed. Closing sends
  `ticket_closed_notice` (4.6). A customer message into a closed ticket
  reopens it (D-006) and the row returns to the default view.
- **Assign** — any active employee of the tenant, or nobody. Assignment is a
  workflow aid, not a permission: any `tickets.handle` holder may reply to
  any ticket.

Dashboard (5.10) shows an open-tickets count linking here (H4).

## 6. Super-admin (`/sa`, guarded by SUPERADMIN_TOKEN env)

Tenants table: nomi, bot, treklar soni, mijozlar soni, yaratilgan sana,
holat. Actions per row: re-set webhook, plan toggle, owner password reset,
disable/enable (disable/enable ships with tasks.md J1). Create form: company
name, bot token, code prefix (2–4 latin letters), currency (UZS/USD) + kurs
if USD, default tariff (name + price per kg), pickup address, working hours,
contact phone, first admin phone + password.
On create: Telegram `getMe` validation → create tenant + default tariff +
owner → set webhook (the webhook URL carries the tenant id, so the row must
exist first, F3; on webhook failure the tenant stays and the row's "Webhook"
button is the idempotent retry).

Webhooks (F3): URL is `/webhook/t/{tenantId}`; every update carries
`X-Telegram-Bot-Api-Secret-Token` = HMAC-SHA256(SESSION_SECRET,
`telegram-webhook:{tenantId}`), verified by the bot server in constant time.
The bot token NEVER appears in a URL. The legacy `/webhook/{botToken}` path
is transitional (see tasks.md F3-b) and warns on every hit.

Owner password reset (F5): "Parol tiklash" issues a fresh invite code for the
tenant's earliest active owner via the ordinary invite flow (5.12) — the
owner redeems it on /login with their phone and sets a NEW password
themselves; the super-admin never learns it, and the old password keeps
working until the code is redeemed.

## 7. Business rules & edge cases

- **7.1 Normalization:** uppercase → keep only `[A-Z0-9]` → valid if length
  8–20. Examples: ` yt-7583 234 uz ` → `YT7583234UZ` ✅; `SF123` → ✗ (short);
  `订单775123456789` → `775123456789` ✅ (CJK stripped).
- **7.2 Import upsert:** key = (tenant_id, code_normalized). Existing → if
  status differs: update + event + notify; else no-op. New → create with the
  chosen status. Backward status moves are allowed (mistake correction) and
  logged like any change. If a batch was selected, set batch_id on ALL rows
  in the import (new and existing).
  **Mapped columns (5.4) FILL EMPTY FIELDS ONLY.** A new track takes the
  owner, kg and price the file gives it. An existing track takes only what it
  is missing: a parcel already weighed on the Tashkent scales, already priced,
  or already attached to a customer is never overwritten by a file — the
  warehouse is the source of truth for what it measured, and re-importing
  yesterday's Excel must not undo today's work. A row therefore counts as
  `Yangilanadi` when its status, its batch **or** one of those empty fields
  changes.
  - The owner cell is matched in one order: `client_code` → phone (7.12 key) →
    full name. A name several customers answer to is reported as ambiguous and
    left UNATTACHED — a parcel on the wrong Alisher is a bill to the wrong
    person. A cell nobody matches is listed in the preview; the track is
    imported without an owner and attached by hand later (5.2 `?work=`).
  - Attaching an owner during an import appends the 7.3 assignment event and
    sends NOTHING, exactly as a panel assignment does.
  - A price in the file is stored as a MANUAL price (`price_manual = true`,
    7.4): it is the sum the company agreed, not something kg × tariff can
    reproduce. Without a price column, kg × default tariff is computed as at
    weighing time, freezing `usd_rate_used` for USD tenants. A `$` amount is
    refused rather than guessed — the stored price is always so'm.
  - An unreadable kg/price cell is a WARNING, not a rejection: the parcel still
    enters the system, and one weight is fixed afterwards more easily than a
    file is re-cut. Only an unusable track code drops a row.
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
  - Everything below multiplies the **chargeable** weight, which equals
    `weight_grams` unless the parcel has dimensions — see 7.16.
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
  queue; record kept in `broadcasts` with `recipient_count` (queued) and
  `sent_count` (delivered). No segmentation in MVP.
  - **Hold + stop (tasks.md K2, D-008):** every fan-out is queued with
    `startAfter` 60 s, and `broadcasts.status` is `queued` or `cancelled`.
    The worker re-reads that status before EVERY delivery and sends nothing
    once it is `cancelled`. Cancelling inside the window therefore reaches
    nobody, and cancelling later stops the remainder mid-flight — one
    mechanism, two experiences.
  - Cancellation is a single-row UPDATE, deliberately **not** pg-boss job
    cancellation: keeping 3 000 job ids to cancel later is fragile, and
    would not stop a fan-out already in progress. The cost is one small
    SELECT per delivery, which is nothing next to a 25 msg/sec ceiling.
  - A cancelled delivery writes **no `message_log` row**. It was not dropped
    and not failed — it never happened, and counting it would inflate the
    dashboard's undelivered figure with messages nobody sent.
  - A **test send** (5.8) carries a chat id instead of a customer: no
    `broadcasts` row, no log, no count. It still goes through the queue, so
    it can never bypass the rate limiter (CLAUDE.md rule 3).
  - **Blocked customers are never auto-excluded** (K3, D-008). The block flag
    is an inference (7.17), the worker already drops an unreachable chat, and
    a customer who unblocks must come back on their own. The panel shows them
    so a human can decide; the queue keeps trying.

- **7.17 "Blocked the bot" (tasks.md A3, K3):** a customer counts as blocked
  when their LAST `message_log` row of kind `notify` is `dropped`. Only
  `notify` (a reminder or broadcast may simply predate an unblock) and only
  `dropped` (`failed` means retries ran out on a transient error, which says
  nothing about a block). It is an inference, never a stored flag — the next
  successful notification clears it by itself.
  - Shown as a badge on the customer card, a `🚫 Bloklaganlar` filter on
    /customers, and a dashboard count linking to that filter.
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

- **7.13 Track metadata (tasks.md H1):** three nullable text columns on
  `tracks`, each answering a different question in a dispute:
  - `marka` (≤ 32 chars, longer input truncated — never refused mid-shift) —
    **what is written on the box**, exactly as typed,
    NOT who owns the parcel. Ownership stays with `customer_id` and its
    attach/conflict rules (3.8, 5.14); marka is the evidence those rules were
    applied to. Weighing with a marka typed always saves it (overwriting the
    previous value — the box in hand is the latest evidence), and the typed
    string also goes into the weighing event's `meta.markaRaw`, so history
    survives the overwrite (rule: events are append-only). An empty marka
    field on a weighing never CLEARS a stored marka. On import, the owner
    cell is saved as marka when it has the shape of a client code — a name or
    phone in that cell is an owner reference, not a box marking.
  - `description` (≤ 200 chars) — what the parcel is ("qora ko'ylak, 2 quti").
    Comes from an import column (5.4) or the track page (5.3). Shown to the
    customer (a person with twelve identical codes deserves to know which is
    which) — unlike the other two fields.
  - `note` (≤ 500 chars) — internal admin note. **Panel-only: never sent to
    the bot, never rendered in the TWA, never exported to the customer's
    statement.** Marka is likewise panel-only (it is warehouse routing data,
    meaningless to the customer).
  - Import fills `marka`/`description` only when the track's field is still
    NULL — a file re-imported next week must not clobber what an admin typed
    by hand. The track page edits all three freely (`tracks.edit`).

- **7.14 Photos (tasks.md H2):** a parcel carries MANY photos, not one —
  `track_photos` (id, tenant_id, track_id, kind, path, created_by,
  created_at), append-only in spirit: uploading never overwrites, deleting
  removes one row + its file.
  - `kind` labels why the shot was taken: `intake` (qabul — the box arriving),
    `damage` (shikast — the evidence photo a dispute lives on), `handover`
    (topshirish — the state it left in). The bot staff flow and the /weigh
    console always write `intake` — speed matters there; the track page
    chooses the kind on upload.
  - Files live at `{uploadsDir}/{tenantId}/{trackId}/{photoId}.jpg`; the
    `path` column stores the actual relative path, so photos migrated from
    the single-photo era (`{tenantId}/{trackId}.jpg`) keep serving from where
    they are. JPEG, ≤ 10 MB, same as before (§8).
  - The migration copies every existing `tracks.photo_path` into
    `track_photos` as `intake` and DROPS the column — one source of truth.
  - Customer surfaces (bot card, §4.2 notification attach, TWA) show a
    parcel's photos regardless of kind — a damage photo is exactly what the
    customer must see before pickup. The notification attaches the NEWEST
    photo; the bot's 📷 sends up to the 10 newest as an album.
  - Upload/delete stays behind `tracks.weigh` on every surface (A5 rule);
    the serving routes stay session-guarded and ownership-scoped (B3, F1).

- **7.15 Tickets (tasks.md H3 — D-004, D-006):**
  - `tickets` (tenant_id, customer_id, track_id nullable, category, status,
    assigned_to nullable, last_message_at) + `ticket_messages` (ticket_id,
    author 'customer'|'staff', author_id, text). Messages are append-only;
    a ticket is one dispute, its thread is the record.
  - Statuses `open → in_progress → closed`, moved only by staff in the panel.
    A CUSTOMER message written into a `closed` ticket flips it to `open` in
    the same transaction (D-006). `last_message_at` orders every list.
  - Categories are the fixed D-004 five; category and status display names
    live in `packages/shared` (rule 5) — both surfaces read one catalogue.
  - Staff reply from the panel ONLY (D-006). Delivery to the bot goes through
    the throttled queue (§8) and records its outcome in `message_log`
    (kind `ticket`) — best-effort logging, same stance as §4.2.
  - Every read is tenant-scoped AND, on the bot side, customer-scoped: a
    customer sees only their own tickets, ever.
  - Ticket text ≤ 2000 chars per message (a Telegram message fits ~4096;
    staff replies get the same cap). Longer input is truncated on intake.

- **7.16 Volumetric pricing (tasks.md I — D-005, D-007):** a metre of pillows
  and a metre of phone cases cost the carrier the same space and cannot cost
  the customer the same money. A parcel is therefore priced by the LARGER of
  what it weighs and what it occupies.
  - **Dimensions** live on the track: `length_cm`, `width_cm`, `height_cm`,
    integers in centimetres, all three nullable and only meaningful together
    (one or two of them describes nothing). Entered on the /weigh console and
    the track page (5.3, 5.14) — never in the bot's staff line (D-007: three
    numbers typed into a Telegram message is an error waiting to happen).
  - **Coefficient** lives on the tariff: `volumetric_coef`, kg per m³, NOT
    NULL, default **167** (the 1:6000 air-freight standard). Every tariff has
    one; a road tariff usually wants 200–333 and the owner edits it there
    (5.9). D-007 chose this over an opt-in nullable column.
  - `volumetric_grams = round(length_cm × width_cm × height_cm × coef / 1000)`
    — cm³ → m³ (÷ 1 000 000) → kg (× coef) → grams (× 1000) collapses to a
    single integer division, so no float ever touches the money path
    (CLAUDE.md rule 6).
  - `chargeable = max(weight_grams, volumetric_grams)`. Ties count as
    **actual** — a volumetric label is a claim about why the price is higher,
    and it must not appear where it changed nothing. **No dimensions → the
    chargeable weight IS the actual weight**, which is why every existing
    track and every tenant that never enters a dimension prices exactly as
    before (D-005: no regression).
  - `weight_grams` keeps meaning **what the scale said**, always. Chargeable
    weight is derived, never stored in its place — the scale reading is
    evidence in a dispute (7.13's logic) and must survive the pricing rule.
  - The computed `volumetric_grams` is **frozen onto the track** when the
    price is written, exactly as `usd_rate_used` freezes the kurs (7.4):
    editing a tariff's coefficient later must never make an old track's
    displayed weight contradict the price it was charged. Neither changes any
    existing track — a re-save on the track page is what recomputes.
  - Dimensions on their own never re-price anything: price is written by the
    same three paths as before (weighing, track page, import). A weighing that
    types no dimensions **keeps the stored ones** (and prices with them) —
    an empty field never clears evidence, the 7.13 rule. The track page edits
    dimensions freely, blank included.
  - `price_manual = true` still wins over everything (7.4). Dimensions are
    still stored and shown — a manual price on a bulky parcel is exactly the
    case where somebody will later ask what the box measured.
  - **The customer sees it, with the reason** (D-007): bot card and Mini App
    show `Hisob vazni: 8.0 kg (hajmiy) · haqiqiy 5.2 kg` whenever volumetric
    won, and the plain weight otherwise. Weight and price stay owner-only
    (F1, 3.6) — this changes what an owner sees, not who sees it.

- **7.18 Import runs & undo (tasks.md M — D-010):** an import is the one act
  in this system that writes thousands of rows from a file nobody re-read.
  Every apply therefore leaves a **run** behind, and a run can be taken back.
  - **`import_runs`** — id, tenant_id, created_by, created_at, the target
    status, the batch, the source name, the counts the result screen showed,
    `items` jsonb, `rejected` jsonb, and `undone_at` / `undone_by` with the
    undo's own counts. Written **inside the same transaction** as the import:
    a rolled-back import must not leave a run claiming it happened.
  - **`items`** records, per touched track, what the run WROTE and what stood
    there BEFORE. This is not derivable from history: fill-if-empty writes
    (owner, kg, price, marka, description) append no event at all, and
    `batch_id` / `deleted_at` are overwrites. Per-track provenance still rides
    the audit log — every event this run appends carries
    `meta = {source: 'import', runId}` (7.2, 7.3).
  - **The window is 60 minutes** from `created_at`. After that the run is
    history, not a lever: a day-old import has real work layered on top of it,
    and reverting it would skip most of its own rows anyway. A run is undone
    **once** — `undone_at` is the guard, and the undo itself is never undone.
  - **What undo reverts** (D-010, the run's own writes and nothing else):
    tracks this run CREATED are soft-deleted; a status this run wrote goes
    back to the previous one; fields this run FILLED go back to empty; an
    owner this run attached is detached; the batch goes back to what the row
    carried before; a track this run REVIVED (7.2 clears `deleted_at`) is
    soft-deleted again.
  - **Anything changed since is left alone.** Undo compares every value the
    run wrote against what the track holds NOW; if a single one differs, the
    whole row is skipped and counted. A parcel handed over and paid for at the
    counter, re-weighed at the warehouse or edited by hand survives the undo
    of the import that created it — the reverting of a mistake must never
    become a second, larger mistake. The result names both numbers:
    `{N} qator qaytarildi · {M} qator o'zgargani uchun tegilmadi`.
  - **Reverting is silent and audited.** A revert appends a `track_events` row
    (rule 7 — history is never rewritten) carrying the restored status and
    `meta = {source: 'import-undo', runId}`; a created row that is soft-deleted
    gets none, exactly as every other soft-delete here (5.3). It sends the
    customer NOTHING:
    the 7.3 reasoning applies unchanged, a correction message is a second
    message about a parcel whose owner may never have read the first.
    Notifications already delivered are reported as a plain count.
  - **Import notifications are held for 60 seconds** before delivery (the same
    hold and the same number as a broadcast, 7.11) and the worker re-reads the
    run before each send: an undo inside that minute means nobody is told at
    all. Without the hold the queue drains in seconds and "the pending ones
    are stopped" would be a promise the architecture cannot keep. A held
    message the undo cancels writes nothing to `message_log` (7.11's rule,
    same reason). It is dropped only when the track no longer stands where the
    message says it does — a row the undo SKIPPED keeps the status the import
    gave it, and so does a manual change that shared the queued job's dedupe
    key (7.6); in both the state is real and the customer hears it.
  - **`rejected`** keeps the rows the run could not use in full — no longer
    the preview's 200-row sample: each carries its line number, the original
    cells and a reason (`badCode` — dropped; `weight` / `price` — cell
    unreadable, row imported without it; `customerMissing` /
    `customerAmbiguous` — owner cell unresolved, 7.12). `⬇️ Muammoli
    qatorlar` returns them as an xlsx with the original columns plus a
    `Sabab` column, which is the form the China office can fix and re-send.
    Capped at 1 000 rows per run; the sheet says so when it truncates.
  - **Capability:** `import.undo` (owner + manager, like `import.run`), and a
    run is undoable only by the tenant that owns it. `items` is pruned after
    7 days by the hourly sweep — the window is an hour, so keeping the
    evidence longer only grows the table; the run row itself stays.

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
manual override covers this for now), courier module, camera-based QR
scanning (USB scanners already work via search input), photo/media
broadcasts, SMS channel, full China-warehouse web mini-panel (bot staff
mode 3.8 covers weighing + photos for now), multi-branch tenants, English
locale.

v2 note (2026-08): three items graduated out of this list into the v2 plan
(`tasks.md`): the Telegram Mini App (now §10), online payment collection
(Click first — tasks.md C), and the regional delivery module (minimal flow —
tasks.md E). Everything else above stays out of scope.

## 10. Telegram Mini App — customer cabinet (premium plan)

One Next.js route group (`/m/{tenantId}`) serves every tenant's Mini App;
which tenant is in the URL, and EVERY screen is gated by
`planIncludes(tenant.plan, 'miniapp')` — basic tenants see a bilingual
"not enabled" screen. UI language is the CUSTOMER's `customers.lang`
(never the panel's cookie locale).

**10.1 Entry & auth.** The bot's chat menu button ("Kabinet",
`setChatMenuButton`) opens the app; it is set when a premium tenant is
onboarded and kept in sync when /sa toggles the plan (downgrade restores the
default button). On open, the client exchanges `window.Telegram.WebApp.
initData` for a session at `POST /api/twa/auth`; the server validates the
HMAC against THAT tenant's bot token (payloads older than 1 h rejected) and
issues a 7-day httpOnly cookie pinning (tenant, customer). A valid Telegram
user with no customer row is sent to the bot — registration lives ONLY in
the bot (3.1); the Mini App never asks for a phone.

**10.2 Screens.**
- Home: greeting, client code, navigation cards.
- My tracks: non-deleted tracks in pipeline order (active first), kg /
  price / batch ETA (ETA shown only while the batch is en route); the detail's
  weight line names the chargeable weight and the actual one when volume set
  the price (7.16). Detail also
  shows the `track_events` timeline and the warehouse photo via an
  ownership-gated route (`/api/twa/photo/{trackId}` — a customer only ever
  sees their own parcels).
- Finance: debt/advance from the ONE debt service (7.5) + last 20 payments
  with the same method labels the bot uses. The online "pay" button lands
  here (tasks.md C2).
- Calculator: same shared `parseKgToGrams` + `computeTrackPrice` as the bot
  and weighing — three surfaces, one price. Never writes. Dimensions are an
  optional block under the weight (7.16, D-007): closed by default, and when
  filled the result names the chargeable weight and why it rose.
- China address: tenant template with `{client_code}` substituted (3.7),
  one-tap copy.
- Client card (`/m/{tenantId}/card`): the same QR the bot sends (3.14) with the
  code under it, rendered server-side — nothing to load, nothing to fetch, and
  it opens at a counter where the phone may have no signal worth trusting.
- Public lookup (`/m/{tenantId}/lookup`): works WITHOUT registration —
  status + last-change date only, never price/owner/weight; per-IP
  fixed-window throttle (`lookup:` scope in `auth_throttle`).

**10.3 Non-functional.** No Telegram SDK dependency — the official
`telegram-web-app.js` script plus a thin typed wrapper. TWA cookies are
domain-separated from admin session cookies (same secret, disjoint HMAC
context): one token family can never verify as the other.