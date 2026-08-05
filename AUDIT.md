# AUDIT.md — SERVIO Kargo: ochiq ishlar ro'yxati

> Asl tahlil: 2026-07-26, `main` @ `5ba1f97`. Oxirgi verifikatsiya: 2026-07-29.
> Bu fayl — **ishchi hujjat**. Task IDlari (T1, T2…) barqaror: commit
> xabarlarida havola qiling. Bajarilgan tasklar § 2 da bitta qatorga
> yig'ilgan; batafsil bayoni git tarixida qoldi.
>
> ⚠️ 2026-07-29 dan keyingi commitlar (marketing, CI/CD, XLSX import) bu
> audit doirasida **tekshirilmagan**.

---

## 1. Holat

| Ssenariy | Tayyorlik | To'sqinlik |
| ---------------------------------- | --------- | ---------- |
| Tanish kargoga demo ko'rsatish | **95 %** | Bugun ishlaydi |
| 1 ta haqiqiy pilot (14 kun, tekin) | **100 %** | P0 yopildi |
| 3–5 pullik mijoz, 6 oy | **55 %** | T9–T14, T20 |

Asl auditning ikkita hayotiy teshigi (admin trekni mijozga biriktira olmasligi,
eksport yo'qligi) **spec bo'shligi** edi, kod bo'shligi emas — ikkalasi ham
yopildi. **P0 (T1–T5) to'liq yopildi, pilotni boshlash mumkin** — § 4 dagi
pilotdan oldingi ro'yxatni bajarib.

**Tasdiqlangan asoslar** (da'vo emas, tekshirilgan): `typecheck` 4/4 toza,
`lint` 0 warning, **351 test** (304 shared + 30 bot + 17 web), har query
`tenant_id` bilan chegaralangan, pul integer tiyinda, argon2id + HMAC sessiya +
path-traversal himoyasi, `parse_mode` faqat HTML escape bilan.

**Test qoplami hamon nomutanosib:** `apps/web` da 17 test (i18n kataloglari +
`messages.test.ts`), 11 700 satr `apps/*` kodi esa qoplanmagan — **T24**.

---

## 2. Bajarilgan ishlar (arxiv)

Batafsil o'lchovlar, verifikatsiya jadvallari va qarorlar git tarixida.

| # | Task | Sana | Natija |
| --- | ---------------------------- | ---------- | ------------------------------------------------------------- |
| T1 | Trekni mijozga biriktirish | 2026-07-26 | `planAssignCustomer` + panel picker + bulk; bot /start telefon bo'yicha mavjud yozuvni ulaydi (migr. `0006`) |
| T2 | Excel eksport | 2026-07-26 | tracks / customers / payments; ekran va fayl bitta filtrdan (`tracksFilter`) |
| T3 | Xabar o'tkazuvchanligi | 2026-07-27 | 1.0 → **14.2 msg/s** (14×); slot-based limiter (**F3**: per-chat kechikish global jadvalni surardi), per-bot byudjet (**F4**: adolat), batch xato izolyatsiyasi |
| T4 | Yo'q indekslar | 2026-07-26 | `0005` — 7 indeks; treklar ro'yxati 58 ms → **0.56 ms** (104×) |
| T5 | Sentry + healthcheck | 2026-07-26 | PII scrub (umumiy), error boundary'lar, docker healthcheck + log rotation |
| T6 | Layoutdan `listDebtors` | 2026-07-27 | SQL aggregate: 655 ms → **41 ms**, heap 29 MB → 0.1 MB |
| T7 | Bulk = tranzaksiya + chunk | 2026-07-27 | 2×N statement → 2 UPDATE + 2 INSERT; notify commitdan keyin, 1 `boss.insert` |
| T8 | Rollar + xodimlar boshqaruvi | 2026-07-27 | `permissions.ts` (3 rol × 17 qobiliyat), `admin_invites`, `session_epoch`, `staff_tg_ids` → `admin_users` (migr. `0009`) |
| T11 | Biriktirilmagan treklar | 2026-07-27 | `?work=unassigned` + qator ichida tez biriktirish |
| T12 | Pagination: mijoz/qarzdor | 2026-07-27 | butun jadvalni Node'ga tortish → bitta CTE query |
| T15 | UX: progress + instant qidiruv | 2026-07-27 | debounce 300 ms (skanerga Enter), optimistic status, 11 ta `loading.tsx` |
| T17 | Panel ruscha | 2026-07-27 | next-intl, i18n routing**siz** (cookie); `admin_users.lang` (migr. `0007`) |
| T19 | Dashboard operatsion | 2026-07-27 | 3 worklist bitta skanda (77 ms), karta → `/tracks?work=…` |
| T21 | Daromad grafigi | 2026-07-29 | **Qaror: QOLADI** — T19 dan keyin xalaqit bermaydi, demoda foydali |
| T22 | Hujjatlarni qisqartirish | 2026-07-29 | `PROJECT.md` o'chirildi, `DEPLOY.md` → `docs/`, `docs/ONBOARDING.md` yozildi, nomlar kanonik (`CLAUDE.md`/`SPEC.md`) |
| T25 | Bot UX — inline navigatsiya | 2026-07-27 | karta ro'yxat o'rniga (`editMessageText`), `❌ Bekor qilish`, `/help`, 17 keyboard test |

---

## 3. Ochiq tasklar

Har task uchun majburiy DoD (CLAUDE.md):

```
[ ] pnpm typecheck && pnpm lint && pnpm test — hammasi o'tadi
[ ] Migratsiya toza bazada ishlaydi
[ ] Happy path qo'lda tekshirilgan (qadamlar commit izohida)
[ ] Yangi user-facing string HAM uz, HAM ru da mavjud
[ ] Xatti-harakat o'zgargan bo'lsa — SPEC.md yangilangan (u kontrakt)
```

### ☐ T9 · Login rate limit 🟡

`apps/web/app/login/actions.ts` — hech qanday chegara yo'q. Telefon global
unique emas, shuning uchun har urinishda mos qatorlar soniga teng argon2
chaqiriladi (qimmat) → arzon DoS vektori. T8 dan keyin xodimlar ko'paydi,
login yuzasi ham kengaydi.

- [ ] IP + telefon bo'yicha oyna (masalan 10 urinish / 15 daqiqa)
- [ ] Postgresda saqlash (`login_attempts`) — konteyner restartdan omon qolsin
- [ ] Bir xil `LOGIN_ERROR` matni (user enumeration bo'lmasin)
- [ ] `/sa/login` uchun ham

### ☐ T10 · "Filtrga mos hammasini tanlash" 🟡

`tracks-table.tsx:75` — `toggleAll` faqat ko'rinadigan 20 qator ustida.
500 trekni IN_TRANSIT qilish = 25 sahifa × qo'lda tanlash.

- [ ] Bulk barda "Filtrga mos {N} tani tanlash"
- [ ] Action `trackIds` emas, **filtr** qabul qiladi (server tanlaydi)
- [ ] Tasdiq modalida aniq son: "{N} ta trek, {M} ta mijozga xabar"

### ☐ T13 · Xabar yetkazish jurnali 🟡

Xabar yuborilganini panelda ko'rish imkoni yo'q. Mijoz botni bloklagan bo'lsa
(`worker.ts:136` — `isPermanentSendError` → jim tashlab ketiladi) admin
bilmaydi. Bu **asosiy qiymat da'vongizni isbotlaydi** (§ 6 ga qarang).

- [ ] `notifications` jadvali: track_id, customer_id, status, sent_at, error
- [ ] Worker natijani yozadi (muvaffaqiyat ham, permanent error ham)
- [ ] Trek detalida "Xabarlar" bo'limi
- [ ] Mijoz kartasida "🚫 Botni bloklagan" belgisi
- [ ] Dashboardda "Yetmagan xabarlar: N"
- [ ] Shu bilan birga: `@sentry/nextjs` (T5 ning ochiq quyrug'i, § 4)

### ☐ T14 · Undo va savat 🟡

300 trekka xato "Topshirildi" bosilsa → 300 xato xabar bir zumda ketadi,
orqaga yo'l yo'q. Soft-deleted treklar uchun ko'rinish ham yo'q.

- [ ] Bulk operatsiyani yozish (`bulk_operations` jadvali)
- [ ] 60 soniya ichida "Bekor qilish" — statuslarni qaytarish
- [ ] Xabarlarni `startAfter: 60s` bilan kechiktirish, bekor qilinsa
      navbatdan o'chirish (pg-boss `cancel`)
- [ ] `/tracks?deleted=1` savat ko'rinishi + tiklash

### ☐ T16 · Bot sessiyasini Postgresga o'tkazish 🟢

`apps/bot/src/bot.ts:20` — `session({ initial: ... })`, xotirada. Har deploy
flow o'rtasidagi foydalanuvchi holatini yo'qotadi va >1 replikani bloklaydi.

- [ ] `@grammyjs/storage-*` yoki oddiy `bot_sessions` jadvali
- [ ] TTL (masalan 1 soat) — eski yozuvlar tozalanadi

### ☐ T18 · Paneldan rasm yuklash 🟢

Hozir faqat bot staff mode; ofisdan tuzatish imkoni yo'q.

- [ ] Trek detalida rasm yuklash/o'chirish (JPEG, 10 MB — bot bilan bir xil qoida)

### ☐ T20 · Telegram Mini App (raqobat uchun)

Cargou'da bor, sizda yo'q. Bot yetadi, lekin demo taqqoslashda yutqazasiz.

- [ ] Mini App: mijoz kabineti — treklar jadvali, qarz, to'lov tarixi, rasmlar
- [ ] Bot reply keyboard saqlanadi (hamma Mini App'ni ochmaydi)

### ☐ T23 · Bot kalkulyatorini qayta ko'rib chiqish

SPEC § 3.9. Narx bahsini chaqiradi ("kalkulyator 40 ming dedi"), egalar odatda
qo'lda kotirovka beradi. Flow/session holati saqlaydi.

- [ ] Pilotda o'lchash: nechta mijoz ishlatdi
- [ ] Kam ishlatilsa — olib tashlash

### ☐ T24 · Test qoplamini muvozanatlash (fon vazifasi)

Hammasini emas, **eng xatarli yo'llarni**:

- [ ] `lib/session.ts` — token imzo/muddat (xavfsizlik)
- [ ] `lib/superadmin.ts` — constant-time solishtirish
- [ ] `login/actions.ts` — noto'g'ri parol, buzilgan hash, rate limit (T9)
- [ ] `queries.ts` tenant-scoping: har funksiya boshqa tenant ma'lumotini
      **qaytarmasligi** (bitta parametrlashtirilgan test)
- [ ] `apps/bot/src/handlers/text.ts` — router ustuvorligi (menyu > flow > lookup)

Eslatma: T1/T2/T3/T6/T12/T19 dagi verifikatsiya harness'lari **bir martalik**
edi va repoda saqlanmadi — ya'ni ular regressiyani ushlab tura olmaydi.

---

## 4. Pilotdan oldingi ochiq quyruqlar

Bajarilgan tasklardan qolgan, hali yopilmagan mayda ishlar:

- [ ] **Bot tokenini BotFather'da revoke qiling** — seed'dagi jonli token
      soxtasiga almashtirildi (T22), lekin **git tarixida qolgan**.
- [ ] **Panelni brauzerda bir marta qo'lda bosib chiqish.** T1/T2/T19 ning
      tekshiruvi ma'lumot qatlamini to'liq qamraydi, lekin UI bo'ylab qo'lda
      yurilmadi (kirish parol talab qiladi). Marshrut:
      `/tracks` bulk «Mijozga biriktirish» → trek detali mijoz kartasi →
      `/customers` «Yangi mijoz» → Bosh sahifa uchala worklist kartasi →
      `✕ Filtrsiz` → «⬇️ Excel».
- [ ] **T7 ni jonli bazada tasdiqlash:** bitta reysni panelda qo'lda
      o'zgartirib, `track_events` va navbatdagi job sonini solishtiring.
      T7 tekshiruvi sof birlik testlari darajasida qolgan.
- [ ] **`pnpm test` ni CI'ga qo'shish.** `ci.yml` hozir faqat typecheck + lint
      (T22 halollik tuzatishi). Tavsiya etiladi.
- [ ] **`@sentry/nextjs`** — Next 14 da server action / server component
      xatolari jarayon darajasiga chiqmaydi, hozir ular `app/error.tsx` orqali
      marshrut + `digest` bilan xabar qilinadi (to'liq stack server logida).
      To'liq ushlash build-time webpack plugin talab qiladi → T13 bilan birga.

**Prod eslatmalari** (hozir muammo emas, hajm oshganda):

- `CREATE INDEX` (CONCURRENTLY emas) yozuvni qulflaydi. Jadvallar millionga
  chiqqanda kelajakdagi indekslarni migratsiyadan **tashqarida** qo'llang —
  drizzle-kit migratsiyani tranzaksiyaga o'raydi, `CONCURRENTLY` esa
  tranzaksiya ichida ishlamaydi.
- `track_events` da `tenant_id` yo'q → dashboard event count indeks bilan
  faqat 1.7× tezlashdi. Hajm oshsa denormalizatsiya qiling (`schema.ts` da
  izoh bor).
- `postgres` pool default `max: 10`; 3 worker × 20 batch = 60 gacha parallel
  handler bo'lishi mumkin. Har biri endi bitta query qiladi va limiter'da
  kutadi — o'lchovda muammo ko'rinmadi, lekin haqiqiy yukda kuzating.
- T3 o'lchovi haqiqiy Telegram bilan emas, `Api.prototype` stubi bilan
  qilingan: nisbat (14×) ishonchli, mutlaq son haqiqiy tarmoqda pastroq.

---

## 5. Saqlanadigan qarorlar

Takrorlanmasligi uchun yozib qo'yilgan (ko'pi kod izohlarida ham bor):

1. **Biriktirish xabar yubormaydi** (SPEC § 7.3). 0-kunda 500 ta tarixiy
   trekni biriktirish 500 ta «yukingiz tayyor» xabarini yuborardi.
2. **Eksportda pul — son, sana — matn.** `formatSom` qatori Excel'da matn
   bo'lib qoladi va `SUM()` 0 beradi; date serial esa vaqt mintaqasini olib
   yurmaydi (SPEC § 7.9).
3. **Ekran va fayl bitta filtrdan.** `tracksFilter()` / `trackWorklistCondition()`
   ni ro'yxat ham, eksport ham, dashboard kartasi ham ishlatadi — karta hech
   qachon bo'sh ekranga olib borolmaydi.
4. **Qarz qoidasi bitta joyda:** `DEBT_OWED_STATUSES` eksport qilinadi, SQL
   `IN (…)` shu massivdan quriladi, test har status uchun `computeDebtTiyin`
   bilan mosligini tekshiradi.
5. **Drizzle `.desc()` = `DESC NULLS LAST`, SQL default esa `NULLS FIRST`.**
   Mos kelmasa planner indeksni tartib uchun ishlatmaydi va jimgina to'liq
   sortga tushadi (47.9 ms → 0.60 ms). Partial index predikati ham
   query'dagi `WHERE deleted_at IS NULL` bilan **aynan** mos bo'lishi kerak.
6. **Enum'ni `ALTER TYPE … ADD VALUE` bilan o'zgartirmang.** Drizzle barcha
   kutilayotgan migratsiyalarni bitta tranzaksiyada bajaradi → `55P04`.
   `RENAME → CREATE → cast → DROP` ishlaydi.
7. **pg-boss batch callback throw qilmasligi kerak** — aks holda batchdagi
   **hamma** job fail bo'ladi va 19 ta mijozga xabar qayta yuboriladi.
   Yiqilganlar `boss.fail(queue, id)` bilan alohida belgilanadi.
8. **Rol o'zgarishi sessiyani bekor qilmaydi** (rol har so'rovda o'qiladi);
   parol o'zgarishi va o'chirib qo'yish esa `session_epoch` bilan bekor qiladi.
9. **`pnpm test` `--parallel` EMAS** — ikkita vitest workspace bir vaqtda
   ishga tushib xotirani tugatadi (`Fatal process out of memory`).
10. **Sentry: `includeLocalVariables: false`**, `OnUncaughtException`
    integratsiyasi olib tashlangan (CLAUDE.md 8-qoidasini buzardi),
    `tracesSampleRate: 0`.
11. **`customers.phone_normalized` unique EMAS** — dublikat ilova darajasida
    rad etiladi, chunki unique indeks bot ro'yxatdan o'tishini flow o'rtasida
    uzib qo'yardi.
12. **`.next` da eski production build qolsa `next dev` har sahifaga 404
    qaytaradi.** O'chirish yetadi (README § Known quirks bilan bog'liq).

### ⚠️ USD rejimi — hozir tegmang

`currency` + `usd_rate_tiyin` + `price_usd_cents` + `usd_rate_used` + muzlatish
+ `price_manual` — eng katta test yuki va murakkablik manbasi. **Olib
tashlamang** (ko'p kargo $/kg da narx qo'yadi), lekin birinchi 3 mijoz UZSda
bo'lsa — bu o'z-o'zini oqlamagan murakkablik ekanini yozib qo'ying.

---

## 6. Raqobat manzarasi

### Eng jiddiy: Cargou — [cargou.lovable.app](https://cargou.lovable.app/features)

| Cargouda bor | Sizda |
| ------------------------------------------------------ | -------------------------- |
| 1688 parser + AI (mahsulot kartasini o'qish) | ❌ |
| Xarid/закупка boardi (to'lov, postavshik, Xitoy treki) | ❌ |
| **Telegram Mini App** — to'liq mijoz kabineti | Reply keyboard bot (T20) |
| Rol boshqaruvi, majburlangan | ✅ 3 rol (T8) |
| QO kod (ombor identifikatsiyasi) | Ataylab olib tashlangan |

**Sizning ustunligingiz (sotuvda old planga qo'ying):**

- **Haqiqiy multi-tenancy — har kargo O'ZINING brendli boti bilan.** Cargou
  bitta umumiy mini-app ko'rinadi. Eng katta differensiator.
- **Qarz hisobi** — ularda yo'q, o'zbek kargosining № 2 og'rig'i.
- 5 daqiqada onboarding (`/sa` + `getMe` + `setWebhook`) — `docs/ONBOARDING.md`.

### Prospektlaringiz allaqachon bot qurgan

[Abu Sahiy](https://abusahiylogistics.uz/) (@AS_cargo_bot),
[Premium Cargo](https://t.me/s/PremiumCargo) (@Premiumcargobot),
[BTB Cargo](https://uz.tgstat.com/en/channel/@BTBCargo),
[Transit Pro](https://transitpro.uz/) — hammasida bot bor.
[iPost](https://ipost.uz/uz) 790 punkt + real-time tracking bilan mijoz
kutilmasini belgilab qo'ygan.

➡️ **Eng katta kargolar sizning mijozingiz emas** — ular qurgan. Sizning
bozoringiz: **o'rta qatlam** — kanalida 2 000–20 000 obunachi, hali Excelda.

### 💥 Narx ankeri muammosi

[Kwork'da](https://kwork.ru/script-programming/34461407/telegram-bot-dlya-kargo)
"kargo uchun Telegram bot" — **19 000 rubl (~$200), bir marta.**
Siz: 1,2 mln so'm/oy ≈ **$95/oy = $1 140/yil.**

Ega albatta shu solishtiruvni qiladi. Javobingiz "bot" bo'lishi mumkin emas —
bot arzon commodity. Sotadigan narsangiz: **panel + qarz hisobi + kafolatlangan
yetkazish + support.** Ammo hozir "kafolatlangan yetkazish"ni tizim
**o'lcholmaydi** (T13) — ya'ni asosiy qiymat da'vosi isbotlanmagan. Shuning
uchun T13 — marketing vazifasi, texnik vazifa emas.

---

## 7. Keyingi tartib

```
Pilotdan oldin  § 4 ro'yxati (token revoke → qo'lda bosib chiqish → demo yozish)
Pilot davomida  T10 → T9 → T14
Birinchi to'lovdan keyin  T13 → T16
Keyin  T18, T20, T23; fon: T24
```

**Keyingi:** `T10` (filtrga mos hammasini tanlash) — 500 trekli reysda bulk
operatsiya hozir 25 sahifa qo'lda tanlashni talab qiladi, ya'ni pilot
egasining kunlik ishida eng ko'p uchraydigan to'siq. Undan keyin T9 (login
rate limit — T8 dan keyin login yuzasi kengaydi) va T14 (undo — T10 bulk
operatsiyani osonlashtirgani sari xato narxi ham oshadi).
