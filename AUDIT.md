# AUDIT.md — SERVIO Kargo: holat tahlili va ish rejasi

> Sana: 2026-07-26 · Tahlil asosi: `main` @ `5ba1f97` (17 commit, 19–21 iyul 2026)
> Bu fayl — **ishchi hujjat**. Har task bajarilganda `[ ]` → `[x]` qiling.
> Vazifa IDlari (T1, T2…) barqaror — commit xabarlarida havola qiling.

---

## 1. Yakuniy hukm

| Ssenariy | Tayyorlik | Nima to'sqinlik qiladi |
| ---------------------------------- | --------- | ----------------------------------- |
| Tanish kargoga demo ko'rsatish | **95 %** | Bugun ishlaydi |
| 1 ta haqiqiy pilot (14 kun, tekin) | **100 %** | **P0 bloklari yopildi** |
| 3–5 pullik mijoz, 6 oy | **55 %** | T6–T12 |

**Asosiy xulosa:** kod bazasi sifatli va Spec.md'ga to'liq javob beradi — lekin
Spec.md'ning o'zida ikkita hayotiy teshik bor edi (admin trekni mijozga biriktira
olmaydi, eksport yo'q). Bu **spec bo'shligi, kod bo'shligi emas**. Xavf: mahsulot
tayyor deb demo qilinadi, ega "boshlaymiz" deydi, 0-kunda 500 ta egasiz trek
qoladi va pilot "ishlamadi" deb yopiladi.

**Holat (2026-07-27):** ikkala teshik ham **yopildi** — T1 biriktirish oqimi
va T2 Excel eksporti. T3 (o'tkazuvchanlik) ham yopildi va yo'l-yo'lakay
**uchinchi**, ro'yxatda bo'lmagan xatoni ochdi: per-chat kechikish global
jadvalni surib yuborardi va tezlikni 25 msg/s o'rniga ~2.4 msg/s da ushlab
turardi (T3 ga qarang). **P0 (T1–T5) to'liq yopildi.**

**Tavsiya: pilotni boshlash mumkin.** Sotuvdan oldin bitta ish qoldi —
panelni brauzerda bir marta qo'lda bosib chiqish (T1 va T2 dagi
«halol cheklov» izohlariga qarang).

---

## 2. Tasdiqlangan kuchli tomonlar (buzmang)

Bular haqiqatan tekshirildi, shunchaki da'vo emas:

| Tekshiruv | Natija |
| ------------------ | ---------------------------------------------------------------- |
| `pnpm typecheck` | ✅ 4/4 workspace toza |
| `pnpm lint` | ✅ 0 warning |
| `pnpm test` | ✅ 252 test / 24 fayl (T19 dan keyin; boshlang'ich holat 166/18) |
| Multi-tenancy | ✅ Har query `tenant_id` bilan chegaralangan — chin, bezak emas |
| Pul hisobi | ✅ Integer tiyin, float yo'q, USD kursi trekda muzlatilgan |
| Xavfsizlik asoslari | ✅ argon2id, HMAC sessiya, path-traversal himoyasi, rasm validatsiyasi |
| `parse_mode` | ✅ Faqat `china.ts`da, HTML escape bilan — injection yo'q |
| Import yo'li | ✅ Chunked + tranzaksiya + `ON CONFLICT DO NOTHING` (namuna kod) |

**Test qoplami nomutanosib:** testlar deyarli faqat `packages/shared`da.
T3 bilan `apps/bot` ga vitest qo'shildi (13 test, `rateLimiter`), lekin
`apps/web` (9 227 satr) hamon **0 test** — T24 ga qarang.

---

## 3. Topilmalar xaritasi

| # | Topilma | Jiddiylik | Task |
| --- | -------------------------------------------------------- | --------- | ------- |
| ~~F1~~ | ~~Admin trekni mijozga biriktira olmaydi, mijoz yaratolmaydi~~ | ✅ Yopildi | T1 |
| ~~F2~~ | ~~Eksport yo'q — sotuv skriptida 2 marta va'da qilingan~~ | ✅ Yopildi | T2 |
| ~~F3~~ | ~~Xabar o'tkazuvchanligi ~5× past (`batchSize: 1`)~~ — aslida **14×** | ✅ Yopildi | T3 |
| ~~F4~~ | ~~Rate limiter hamma tenantga umumiy → multi-tenant adolatsizligi~~ | ✅ Yopildi | T3 |
| ~~F3b~~ | ~~Per-chat kechikish global jadvalni surardi (T3 da topildi)~~ | ✅ Yopildi | T3 |
| ~~F5~~ | ~~Xatolik kuzatuvi va web healthcheck yo'q~~ | ✅ Yopildi | T5 |
| ~~F6~~ | ~~Layoutda `listDebtors` — har sahifada to'liq jadval skani~~ | ✅ Yopildi | T6 |
| ~~F7~~ | ~~Kritik indekslar yo'q (`track_events.track_id` va boshq.)~~ | ✅ Yopildi | T4 |
| F8 | Bulk operatsiyalar tranzaksiyasiz, per-row tsikl | 🟠 Yuqori | T7 |
| F9 | `role` majburlanmaydi; admin qo'shish/parol UI yo'q | 🟠 Yuqori | T8 |
| F10 | Loginda rate limit yo'q (brute force + argon2 DoS) | 🟡 O'rta | T9 |
| F11 | "Barchasini tanlash" faqat ko'rinadigan 20 qatorni oladi | 🟡 O'rta | T10 |
| F12 | Biriktirilmagan treklar uchun alohida ko'rinish yo'q | 🟡 O'rta | T11 |
| F13 | `/customers`, `/debtors` pagination yo'q | 🟡 O'rta | T12 |
| F14 | Xabar yetkazish jurnali yo'q (bloklagan mijoz ko'rinmaydi) | 🟡 O'rta | T13 |
| F15 | Undo / savat yo'q — 300 ta xato xabar qaytarilmaydi | 🟡 O'rta | T14 |
| F16 | Bulk operatsiyada progress yo'q, qidiruv Enter + reload | 🟡 O'rta | T15 |
| F17 | Bot sessiyasi xotirada — deploy flowni uzadi, >1 replika yo'q | 🟢 Past | T16 |
| F18 | Panel faqat o'zbekcha | 🟢 Past | T17 |
| F19 | Paneldan rasm yuklash yo'q | 🟢 Past | T18 |
| ~~F20~~ | ~~Dashboard operatsion emas (daromad grafigi = vanity metrika)~~ | ✅ Yopildi | T19 |
| F21 | 7 ta hujjat, 17 commit — chirishga tayyor takror | 🟢 Past | T22 |

---

## 4. TASK RO'YXATI

### Har task uchun majburiy DoD (CLAUDE.md)

```
[ ] pnpm typecheck && pnpm lint && pnpm test — hammasi o'tadi
[ ] Migratsiya toza bazada ishlaydi
[ ] Happy path qo'lda tekshirilgan (qadamlar commit izohida)
[ ] Yangi user-facing string HAM uz, HAM ru da mavjud
[ ] Xatti-harakat o'zgargan bo'lsa — Spec.md yangilangan (u kontrakt)
```

---

## P0 — PILOTDAN OLDIN (majburiy, ~4 kun)

### ☑ T1 · Trekni mijozga biriktirish + paneldan mijoz yaratish — **BAJARILDI** (2026-07-26)

**Vazifalar:**
- [x] `packages/shared/src/services/assignCustomer.ts` — `planAssignCustomer`
      planner (`attach` / `detach` / `reassign` / `noop`) + 8 test
- [x] `apps/web/.../tracks/[id]/actions.ts` — `attachCustomerAction`,
      `detachCustomerAction` (tenant-scoped, `track_events` ga meta bilan yozish)
- [x] Trek detalida mijoz tanlash (`components/customer-picker.tsx` —
      client_code / ism / telefon bo'yicha debounced qidiruv, ichida
      «Yangi mijoz qo'shish» ham bor)
- [x] `apps/web/lib/customer-actions.ts` — `createCustomerAction`: telefon + ism
      → `client_code` avtomatik (`nextClientCode`), `tg_user_id = NULL`;
      `/customers` da «Yangi mijoz» tugmasi
- [x] Mijoz botga /start bosganda mavjud (tg_user_id NULL) yozuvni telefon
      bo'yicha topib **ulash** — dublikat yaratmaslik
- [x] Bulk: tanlangan treklarni bitta mijozga biriktirish (`/tracks` bulk barida
      uchinchi tugma)
- [x] Testlar: biriktirish, ajratish, qayta biriktirish, telefon normalizatsiyasi
      (**192 test**, 177 → +15)
- [x] Spec.md § 5.2 / § 5.3 / § 5.5 / § 7.3 yangilandi + yangi **§ 7.12**
      (telefon moslashtirish va mijozni ulash qoidasi)

**Ikkita ataylab qilingan qaror:**

1. **Biriktirish xabar yubormaydi.** §4.2 xabarlari *status* o'zgarishiga
   tegishli. 0-kunda 500 ta tarixiy trekni egalariga biriktirish 500 ta
   «yukingiz tayyor» xabarini yuborardi — allaqachon olib ketilgan yuklar
   haqida. Mijoz ularni 📦 Mening yuklarim da darhol ko'radi, maqsad ham shu.
   Sabab bilan Spec § 7.3 ga yozib qo'yildi.
2. **`phone_normalized` unique EMAS.** Ustun prod ma'lumotidan keyin qo'shildi
   va bir kargoda bitta raqamga ikkita yozuv qolgan bo'lishi mumkin. Dublikat
   ilova darajasida rad etiladi (`createCustomer`), chunki u yerda xatoni
   ko'rsatish mumkin — unique indeks esa bot ro'yxatdan o'tishini flow
   o'rtasida uzib qo'yardi.

**Sxema o'zgarishi:** `0006_magenta_marvel_boy.sql` — `customers.phone_normalized`
+ `customers_tenant_phone_idx (tenant_id, phone_normalized)` + backfill.
Backfill SQL (`NULLIF(right(regexp_replace(phone,'\D','','g'), 9), '')`)
**ataylab** JS `normalizePhone` bilan aynan bir xil; 12 ta holatda
yonma-yon solishtirildi, hammasi mos keldi. Sabab: bitta raqam uch xil yoziladi —
Telegram `998901234567`, admin `+998 90 123-45-67`, import `901234567`.

**Qo'lda tekshirilgan qadamlar** (toza `postgres:16`, 55432-port):

1. Toza konteyner → `drizzle-kit migrate` → **7 ta migratsiya toza o'tdi**,
   ustun va indeks joyida.
2. Backfill SQL ni 12 ta xom telefonda ishga tushirib, `phone.test.ts` dagi
   kutilgan natijalar bilan solishtirildi — **12/12 mos**.
3. `db:seed` → haqiqiy `apps/web/lib/queries.ts` va `apps/bot/src/queries.ts`
   funksiyalarini to'g'ridan-to'g'ri chaqiruvchi harness bilan **42 ta tekshiruv**:

   | Tekshirilgan | Natija |
   | --------------------------------------------------------- | ------ |
   | Mijoz yaratish: `client_code` avtomatik, `tg_user_id` NULL | ✅ |
   | Bir xil telefon boshqa formatda → rad, mavjud mijoz qaytadi | ✅ |
   | Qidiruv: kod / ism / telefon (uchinchi formatda) | ✅ |
   | Biriktirish → `meta.action=attach`, **status o'zgarmaydi** | ✅ |
   | Qayta biriktirish → no-op, ortiqcha audit yozuvi yo'q | ✅ |
   | Reassign / detach → to'g'ri meta, `fromCustomerId` saqlanadi | ✅ |
   | Boshqa tenant mijozi → `NO_CUSTOMER`; qidiruv sizmaydi | ✅ |
   | Bir xil telefon **boshqa** tenantda ruxsat etiladi | ✅ |
   | Soft-deleted treklar biriktirilmaydi (§7.8) | ✅ |
   | 10 trekni bulk biriktirish, bitta tranzaksiya | ✅ |
   | **Bot /start: qo'lda kiritilgan yozuvni telefon bo'yicha uladi** | ✅ |
   | → dublikat mijoz **yaratilmadi**, `client_code` saqlandi | ✅ |
   | → biriktirilgan 10 ta trek mijoz bilan birga qoldi | ✅ |
   | Notanish telefon → oddiy yangi ro'yxatdan o'tish | ✅ |
   | Takroriy /start → o'sha yozuv qaytadi | ✅ |

**DoD:** ✅ typecheck · ✅ lint (0 warning) · ✅ **192 test** (177 → +15) ·
✅ toza bazada 7 ta migratsiya + backfill · ✅ yuqoridagi 3 qadam ·
✅ Spec.md yangilandi · yangi bot stringi yo'q (ulanish mavjud `registered`
matnini qayta ishlatadi, shuning uchun uz/ru ikkalasi ham qamrab olingan).

**⚠️ Halol cheklov.** Yuqoridagi tekshiruv **ma'lumot qatlamini** to'liq
qamraydi (haqiqiy query funksiyalari, haqiqiy baza). Brauzerda **UI bo'ylab
qo'lda bosib chiqish qilinmadi** — panelga kirish parol kiritishni talab
qiladi. UI yupqa qatlam (server action'larni chaqiruvchi client komponentlar)
va typecheck/lint toza, lekin pilotdan oldin bir marta qo'lda bosib chiqing:
`/tracks` bulk «Mijozga biriktirish» → trek detali mijoz kartasi →
`/customers` «Yangi mijoz».

<details>
<summary>Asl vazifa tavsifi (arxiv)</summary>

**Nega bloker.** Kodda tasdiqlandi:
- `insert(customers)` faqat 3 joyda: `apps/bot/src/queries.ts:127` (bot
  self-registration), `seed.ts`, `demo-import.ts`. Panelda mijoz yaratish **yo'q**.
- `apps/web/app/(app)/tracks/[id]/actions.ts` — faqat `setWeightAction`.
  `customerId`ni o'zgartiradigan action **umuman yo'q**.

Natijada 0-kunda kanal tarixi import qilinsa → 500 trek `customer_id = NULL` →
hech kimga xabar ketmaydi, hech kimning qarzi hisoblanmaydi, hech kimning
"Mening yuklarim"ida ko'rinmaydi. Demoning "VAU momenti" egasi uchun 0 beradi.
Qo'shimcha: mijoz xato kod da'vo qilsa (`addTrack.ts:44` birinchi da'vogarga
biriktiradi) — admin tuzata olmaydi.

**Ish hajmi:** ~1 kun

**Diqqat:** `customers.tg_user_id` nullable, unique index `(tenant_id, tg_user_id)` —
Postgresda NULLlar farqli hisoblanadi, shuning uchun ko'p qo'lda kiritilgan mijoz
muammo tug'dirmaydi. Lekin telefon bo'yicha dublikat nazoratini qo'shish kerak.

</details>

**Yo'l-yo'lakay topilgan nosozlik (T2 dan oldin ko'ring):** `apps/web/.next` da
eski **production build** qolib ketgan bo'lsa, `next dev` har sahifaga 404
qaytaradi (static chunk'lar ham). `.next` ni o'chirgach darhol tuzaldi. Bu
PROJECT.md § 8 dagi `next build` nosozligining sababi bo'lishi mumkin —
toza `.next` bilan bir marta `next build` ni sinab ko'rishga arziydi.

---

### ☑ T2 · Excel eksport — **BAJARILDI** (2026-07-26)

**Vazifalar:**
- [x] `apps/web/lib/xlsx.ts` ga `writeXlsx(sheets)` — ustun kengliklari +
      sarlavhada filtr tugmalari (`!autofilter`)
- [x] `app/api/export/tracks` — joriy filtrlar bilan (status, reys, qidiruv)
- [x] `app/api/export/customers` — qarz ustuni bilan (`?debtors=1` → qarzdorlar)
- [x] `app/api/export/payments` (`?customer=<id>` → bitta mijoz hisoboti)
- [x] "⬇️ Excel" tugmasi: `/tracks`, `/customers`, `/debtors` sarlavhasida va
      mijoz kartasidagi «To'lovlar tarixi» bo'limida
- [x] Sana Asia/Tashkent, `deleted_at` chiqmaydi, tenant bo'yicha chegaralangan
- [x] `packages/shared/src/services/export.ts` — sof qatorshakllantirish +
      **24 test**; tenant-scoping esa jonli bazada tekshirildi (pastda)

**Ikkita ataylab qilingan chetlanish (asl vazifadan):**

1. **Pul `formatSom` bilan EMAS, son sifatida yoziladi.** Vazifada `formatSom`
   deyilgan edi, lekin u `"1 250 000"` qatorini beradi — Excel uni **matn**
   deb saqlaydi va `SUM()` 0 qaytaradi. Eksportning butun ma'nosi ega faylni
   ochib ishlay olishi: qarz ustunini yig'ish, narx bo'yicha saralash. Shuning
   uchun pul **butun so'mda son**, og'irlik **kg da son**, o'lchov birligi esa
   ustun nomida. Avans (manfiy qarz) ishorasini saqlaydi — aks holda ustun
   yig'indisi kassa bilan mos kelmaydi.
2. **Sana Excel «date serial» emas, matn.** `DD.MM.YYYY HH:mm` Asia/Tashkent.
   Date serial vaqt mintaqasini olib yurmaydi, ya'ni Toshkentda bo'lmagan
   kompyuterda o'sha katak boshqa vaqtni ko'rsatardi (§7.9).

**Qo'shimcha qarorlar:**

- **50 000 qator cheklovi.** Undan oshsa fayl **ichida** ogohlantirish qatori
  chiqadi va haqiqiy sonni aytadi — jim qirqish "hammasi shu" degan
  taassurot qoldirardi.
- **Sarlavhalar uz va ru da.** Panel hozircha faqat o'zbekcha (T17), lekin
  jadval binodan chiqib ketadi — ega uni buxgalterga yuboradi. `EXPORT_LABELS`
  ikkala tilni saqlaydi, panel `uz` so'raydi. T17 uchun tayyor.
- **Filtr bir joyda.** `tracksFilter()` ni `listTracks` va
  `listTracksForExport` birga ishlatadi — "⬇️ Excel" hech qachon ekrandagidan
  boshqa qatorlarni bera olmaydi. 6 xil filtrda ikkalasi solishtirildi.
- **Formula injeksiyasi yo'q.** `aoa_to_sheet` har matnni `t:'s'` (matn) deb
  yozadi, formula deb emas — CSV dan farqli o'laroq `=cmd|...` ko'rinishidagi
  import qilingan trek kodi zararsiz va **buzilmasdan** chiqadi.

**Qo'lda tekshirilgan qadamlar** (toza `kargotrack_verify` bazasi, lokal
Postgres 18):

1. Toza baza → `drizzle-kit migrate` → **7 migratsiya toza o'tdi**,
   9 jadval + 23 indeks joyida.
2. Loyihaning `db:seed` i ishladi (1 tenant, 5 mijoz, 30 trek, 106 event).
3. Verifikatsiya harness'i (bir martalik, repoda saqlanmagan) — **haqiqiy**
   `lib/queries.ts` funksiyalarini, haqiqiy sheet builder'larni va `writeXlsx` ni
   chaqiradi, keyin yozilgan `.xlsx` ni **qayta o'qib** kataklarni tekshiradi.
   Ikki tenant ataylab **bir xil** ma'lumot bilan yaratildi: bir xil mijoz
   ismi, bir xil telefon, bir xil trek kodi. **72/72 tekshiruv o'tdi:**

   | Tekshirilgan | Natija |
   | ----------------------------------------------------------- | ------ |
   | Tenant B ning treki / to'lovi / mijozi A faylida yo'q (6 marker) | ✅ |
   | Bir xil kod ikki tenantda → A faylida **bitta** qator | ✅ |
   | Soft-deleted trek va uning narxi chiqmaydi (§7.8) | ✅ |
   | Qarz va trek soni ham soft-deleted'ni hisoblamaydi | ✅ |
   | Og'irlik/narx katagi **son** tipida, Excel yig'a oladi | ✅ |
   | Avans manfiy son bo'lib qoladi | ✅ |
   | `15:30Z` → `20:30`, `23:00Z` → **ertasi kun** `04:00` (Toshkent) | ✅ |
   | Biriktirilmagan trek: mijoz ustunlari bo'sh, «—» emas | ✅ |
   | 6 xil filtrda eksport == ekran (status, qidiruv ×3, reys) | ✅ |
   | Boshqa tenant mijozining id si bilan to'lov so'rash → bo'sh | ✅ |
   | Cheklov ogohlantirishi faylga tushadi va haqiqiy sonni aytadi | ✅ |
   | Fayl nomi ASCII va Toshkent kalendar kuni bilan | ✅ |

**DoD:** ✅ typecheck (4/4) · ✅ lint (0 warning) · ✅ testlar (pastga qarang) ·
✅ toza bazada 7 migratsiya + seed · ✅ yuqoridagi 3 qadam ·
✅ Spec.md § 5.2 / § 5.5 / § 5.6 yangilandi + yangi **§ 5.11** ·
✅ yangi stringlar uz va ru da (`EXPORT_LABELS`).

**⚠️ Halol cheklov.** Tekshiruv **ma'lumot va fayl qatlamini** to'liq qamraydi
(haqiqiy query'lar, haqiqiy baza, yozilgan fayl qayta o'qildi). Brauzerda
tugmani **qo'lda bosib** ko'rilmadi — panelga kirish parol talab qiladi.
Tugma — `<a href download>`, marshrut esa `requireAdmin()` bilan qo'riqlangan
va typecheck/lint toza; lekin pilotdan oldin bir marta bosib chiqing.

---

### ☑ T3 · Xabar o'tkazuvchanligi + tenantlar orasida adolat — **BAJARILDI** (2026-07-27)

**Vazifalar:**
- [x] `TelegramRateLimiter` — bot tokeni bo'yicha alohida byudjet
      (`Map<token, Bucket>`); per-chat oynasi ham (bot, chat) juftligi bo'yicha
- [x] `batchSize: 20` + batch ichida `Promise.allSettled` bilan parallel
- [x] Notify job ichidagi 4 ta ketma-ket query → **bitta join**
      (`getNotifyContext`); reminder va broadcast ham 2 → **1** (`getSendContext`)
- [x] `apps/bot/src/rateLimiter.test.ts` — **13 test** (apps/bot ga vitest
      qo'shildi; T24 uchun ham poydevor)
- [x] Broadcast fan-out `boss.insert` bilan 1000 lik bo'laklarda
      (`enqueueBroadcasts`) — endi har oluvchi uchun alohida round trip yo'q
- [x] O'lchandi: oldin/keyin (pastda)

**Uchinchi xato — o'lchamasa topilmasdi.** Vazifada ikkitasi yozilgan edi,
lekin aslida uchtasi bor edi va **eng kattasi ro'yxatda yo'q edi**:

> **Per-chat kechikish global jadvalni ham surib yuborardi.** Eski limiter
> bitta `globalNext` markerini saqlardi va uni har safar `grantedAt + 40ms` ga
> surardi. Mijozning ikkinchi yuki uchun xabar chat oynasi tufayli 1 soniya
> kechiksa, marker ham 1 soniya oldinga sakrardi — ya'ni **o'sha soniyada
> yuborilishi mumkin bo'lgan 24 ta boshqa mijoz** ham orqaga suriladi.
> O'zbek kargosida mijozda odatda bir nechta yuk bo'ladi, ya'ni har ommaviy
> status o'zgarishi shunday takrorlarga to'la.

Sof jadval simulyatsiyasi (500 xabar, 300 mijoz, 100 tasida 3 tadan yuk):
eski algoritm **212 s** da tugatadi — **2.4 msg/s**, 25 msg/s shift o'rniga.
Ya'ni `batchSize` tuzatilgan bo'lsa ham tezlik shu yerda qolib ketardi.
Yechim: jadval bitta harakatlanuvchi marker emas, **band qilingan 40 ms
slotlar to'plami** — kechiktirilgan xabar uzoqdagi slotni oladi, yaqindagilar
boshqa chatlarga qoladi.

**Yana bitta nozik joy — batch xatolikni izolyatsiya qilish.** pg-boss batch
callback'ini «hammasi yoki hech biri» deb qaraydi: callback throw qilsa,
`manager.watch` batchdagi **hamma** job'ni fail qiladi. Ya'ni bitta bloklagan
chat tufayli qolgan 19 mijozga xabar **qayta yuborilardi**. Shuning uchun
`runBatch` throw qilmaydi — yiqilgan job'larni `boss.fail(queue, id)` bilan
alohida belgilaydi (retry/backoff aynan o'sha), keyin normal qaytadi.
pg-boss ning `complete` SQL i `state = 'active'` bilan cheklangan, `fail` esa
qatorni o'sha holatdan chiqarib yuborgan — shuning uchun yiqilganlar
«muvaffaqiyat» deb belgilanmaydi. `boss.fail` ning o'zi yiqilsa ham callback
throw qilmaydi (aks holda 19 ta takroriy xabar) — logga yoziladi.

**O'lchov** (toza baza, Telegram `Api.prototype` darajasida 40 ms bilan
stub qilingan, 150 xabar: 60 mijozda 1 tadan yuk, 30 mijozda 3 tadan —
takroriy chatlar aynan shu uchun):

| | Vaqt | Tezlik | Yetkazildi |
| ---------------------------- | -------- | ------------ | ---------- |
| **Oldin** (batchSize 1, ketma-ket, eski limiter, 3 query) | 150.2 s | **1.0 msg/s** | 150/150 |
| **Keyin** (batchSize 20, parallel, yangi limiter, 1 query) | 10.5 s | **14.2 msg/s** | 150/150 |
| Tezlanish | | **14.3×** | |
| Telegram shifti (25/s) | 6.0 s | 25 msg/s | — |

Qolgan farq (10.5 s vs 6.0 s) — 90 ta takroriy chatning haqiqiy 1 msg/s
oynasi va pg-boss ning 1 soniyalik polling'i. Bu Telegram qoidasi, xato emas.

**Qo'lda tekshirilgan qadamlar:**

1. Toza baza → `drizzle-kit migrate` (7 migratsiya) → `db:seed`.
2. Ikkala variant **bitta jarayonda, ketma-ket**, bir xil baza, bir xil
   qatorlar, bir xil stub kechikishi bilan ishlatildi. «Oldin» varianti —
   T3 dan avvalgi kodning aynan qayta tiklangan nusxasi.
3. Har ikkalasida: **150/150 handler chaqirildi, 150/150 yuborildi,
   0 xato, navbatda 0 qoldi** — ya'ni tezlik xabarni yo'qotish hisobiga emas.
4. **Broadcast fan-out:** `enqueueBroadcasts` bilan 300 job → navbatda
   **300** ✅ (`BROADCAST_QUEUE` policy `standard`, singleton kalit e'tiborga
   olinmaydi — bo'sh kalit bilan bulk insert `short` navbatda job'larni bitta
   qilib yuborardi; shu tekshiruv aynan buni ushlab turadi).
5. pg-boss ning o'zi alohida sinaldi: `batchSize: 20` da 150 job → callback
   **150 tasini** ko'radi (8 batch), ya'ni yo'qotish yo'q.

**DoD:** ✅ typecheck (4/4) · ✅ lint (0 warning) · ✅ **229 test**
(216 shared + 13 bot; T2 dan oldin 192) · ✅ toza bazada migratsiya ·
✅ yuqoridagi 5 qadam · ✅ Spec.md § 8 yangilandi ·
yangi user-facing string yo'q (sof infratuzilma).

**⚠️ Ops eslatmasi.** `pnpm test` endi `--parallel` EMAS: ikkinchi vitest
workspace qo'shilgach, ikkita worker pool bir vaqtda ishga tushib mashina
xotirasini tugatardi (`Fatal process out of memory`). `lint`/`typecheck` —
har biri bitta jarayon — parallel qolgan.

**⚠️ Halol cheklov.** O'lchov haqiqiy Telegram bilan emas, `Api.prototype`
darajasidagi stub bilan qilingan — ya'ni tarmoq jitter'i va Telegram ning
o'z 429 javoblari qamralmagan. Nisbat (14×) ishonchli, mutlaq son esa
haqiqiy tarmoqda past bo'ladi. Shuningdek, `postgres` pool default `max: 10`;
3 ta worker × 20 batch = 60 gacha parallel handler bo'lishi mumkin, lekin har
biri endi **bitta** query qiladi va keyin limiter'da kutadi — o'lchovda
muammo ko'rinmadi, lekin haqiqiy yukda kuzatib borish kerak.

---

### ☑ T4 · Yo'q indekslarni qo'shish — **BAJARILDI** (2026-07-26)

**Natija:** `0005_chubby_master_mold.sql` — 7 ta indeks.
Toza `postgres:16` da o'lchandi: 80 000 trek, 160 000 event, 24 000 to'lov,
6 000 mijoz, 2 tenant. Har query 3 marta (issiq), `EXPLAIN ANALYZE`.

| Query | Oldin | Keyin | Tezlanish |
| ------------------------------- | -------- | -------- | --------- |
| Treklar ro'yxati (1-sahifa) | 58.2 ms | **0.56 ms** | **104×** |
| Trek tarixi (detal sahifasi) | 16.2 ms | **0.14 ms** | **115×** |
| Status filtri (count) | 16.2 ms | **3.9 ms** | 4.2× |
| Dashboard tushum (sum) | 5.29 ms | **3.00 ms** | 1.8× |
| Dashboard event count | 41.0 ms | **24.1 ms** | 1.7× |
| Login (telefon bo'yicha) | 0.161 ms | **0.106 ms** | 1.5× |
| Qarz: to'lovlar skani | 3.59 ms | 3.63 ms | — ¹ |

¹ Bu query tenantning **yarim** jadvalini o'qiydi — Seq Scan to'g'ri tanlov.
Uni indeks emas, **T6** hal qiladi (aggregate'ga o'tkazish).

**Yo'l-yo'lakay topilgan 2 ta nozik xato** (o'lchamasa sezilmasdi):

1. **Partial index shart.** `WHERE deleted_at IS NULL` predikati indeksda
   bo'lmasa, planner tenantning barcha 40 000 qatorini bitmap-scan qilib,
   keyin top-N sort qiladi. Predikat mos kelganda esa indeks tartibi bo'yicha
   yurib LIMIT 20 da to'xtaydi. **56 ms → 0.75 ms.** Gap indeks hajmida emas
   (soft-delete qilinganlar kam), predikat **mosligida**.
2. **`.desc()` yetarli emas — `.nullsFirst()` kerak.** SQL'da
   `ORDER BY x DESC` = `DESC NULLS FIRST`, Drizzle'ning yalang'och `.desc()`
   esa `DESC NULLS LAST` chiqaradi. Mos kelmagani uchun planner indeksni
   **tartib uchun ishlatmaydi** va jimgina to'liq sortga tushadi:

   | Indeks varianti | Vaqt | Ordered scan |
   | ------------------- | -------- | ------------ |
   | `DESC NULLS LAST` | 47.9 ms | ❌ |
   | `DESC NULLS FIRST` | 0.60 ms | ✅ |
   | plain `ASC` (teskari) | 0.56 ms | ✅ |

   Ikkalasi ham `schema.ts` izohlarida yozib qo'yilgan — keyingi indeks
   qo'shganda takrorlanmasin.

**DoD:** ✅ typecheck · ✅ lint (0 warning) · ✅ 166 test · ✅ toza bazada 6 ta
migratsiya o'tdi · ✅ loyihaning haqiqiy `db:seed` i ishladi · yangi
user-facing string yo'q (sof DB o'zgarishi).

**⚠️ Prod eslatmasi:** `CREATE INDEX` (CONCURRENTLY emas) yozuvni qulflaydi.
Hozirgi hajmda bu millisekundlar — muammo yo'q. Jadvallar millionga chiqqanda
kelajakdagi indekslarni `CONCURRENTLY` bilan, migratsiyadan **tashqarida**
qo'llash kerak (drizzle-kit migratsiyani tranzaksiyaga o'raydi, `CONCURRENTLY`
esa tranzaksiya ichida ishlamaydi).

**Keyingi qadam (T4 dan o'sib chiqdi):** dashboard event count faqat 1.7×
tezlashdi, chunki `track_events` da `tenant_id` yo'q — indeks tenantlar bo'yicha
ajratilmaydi. Hajm oshsa `tenant_id` ni denormalizatsiya qilish kerak.
Bu `schema.ts` da izoh sifatida belgilangan.

<details>
<summary>Asl vazifa tavsifi (arxiv)</summary>

**Nega.** Butun bazada **5 ta** indeks bor (`0000`, `0002` migratsiyalari):
`customers_tenant_client_code_uq`, `customers_tenant_tg_user_uq`,
`tracks_tenant_code_uq`, `tracks_customer_idx`, `tracks_batch_idx`.

Eng muhimi yo'q: **`track_events.track_id`** — bu eng tez o'sadigan jadval
(har status o'zgarishi qator qo'shadi), Postgres FK'ni avtomatik indekslamaydi.
Dashboard va trek tarixi seq scan qiladi.

**Ish hajmi:** ~15 daqiqa. **Eng yuqori ROI.**

**Vazifalar:**
- [ ] `track_events(track_id, created_at DESC)`
- [ ] `payments(customer_id)`
- [ ] `payments(tenant_id, created_at)`
- [ ] `tracks(tenant_id, created_at DESC)` — ro'yxat sortirovkasi
- [ ] `tracks(tenant_id, current_status)` — status filtri
- [ ] `admin_users(phone)` — login lookup
- [ ] `packages/db/src/schema.ts` ga ham qo'shish (schema = yagona haqiqat)
- [ ] `pnpm db:generate` + toza bazada `db:migrate` tekshirish

</details>

---

### ☑ T5 · Kuzatuv: Sentry + healthcheck — **BAJARILDI** (2026-07-26)

**Tanlov:** Sentry (bepul tier) + PII filtri. DSN **ixtiyoriy** — `SENTRY_DSN`
bo'sh bo'lsa ikkala ilova ham avvalgidek, hisobotsiz ishlaydi.

**Nima qo'shildi:**

| Fayl | Vazifa |
| ------------------------------------------------ | ---------------------------------------------- |
| `packages/shared/src/observability/scrub.ts` | PII tozalash — sof, testlangan, ikkalasi uchun umumiy |
| `packages/shared/src/observability/scrub.test.ts` | 11 test |
| `apps/bot/src/sentry.ts` | Bot uchun init + `captureError` + `flushSentry` |
| `apps/web/lib/observability.ts` | Panel uchun init + `captureError` |
| `apps/web/lib/report-error.ts` | Error boundary'dan hisobot yuboruvchi server action |
| `apps/web/app/error.tsx` | Route error boundary — **o'zbekcha UI** + hisobot |
| `apps/web/app/global-error.tsx` | Root boundary (layout ham qulasa) |

Ulangan nuqtalar: `bot.catch` (har handler xatosi, tenantId + updateId bilan),
`uncaughtException` / `unhandledRejection`, startup xatosi, 3 ta worker
ishga tushmasligi, va **3 ta navbatning retry tugagandagi xatosi** — ya'ni
yetkazilmagan xabar endi jimgina yo'qolmaydi.

**Yo'l-yo'lakay tuzatilgan 2 ta nuqson:**

1. **Panelda error boundary umuman yo'q edi.** Server component yoki action
   xato bersa, admin Next'ning inglizcha default ekranini ko'rardi va hech
   nima yozib olinmasdi. Endi o'zbekcha sahifa + "Qayta urinish" + `digest`
   kodi, va xato hisobotga tushadi.
2. **`@sentry/node` drizzle'ni ikkiga bo'lib yubordi.** Sentry
   `@opentelemetry/api` ni olib keladi, u esa drizzle'ning **ixtiyoriy peer**'i —
   natijada pnpm ikkinchi drizzle nusxasini yaratdi va `apps/bot` bilan
   `packages/db` bir-biriga mos kelmaydigan tiplarni ko'ra boshladi
   (typecheck qulab tushdi). Yechim: `@opentelemetry/api` ni `packages/db`,
   `apps/web`, `apps/bot` ga aniq dependency qilib qo'shish — uchalasi bitta
   nusxaga ulandi.

**Xavfsizlik qarorlari (ataylab):**

- `includeLocalVariables: false` — stack frame'dagi lokal o'zgaruvchilar
  **jonli mijoz qatorini** (customer obyekti, trek qatori) hisobotga olib
  chiqadigan yagona kanal. SDK defaulti ham shu, lekin aniq yozib qo'yildi.
- Sentry'ning `OnUncaughtException` / `OnUnhandledRejection` integratsiyalari
  **olib tashlandi** — ular jarayonni to'xtatishi mumkin, bu esa CLAUDE.md
  8-qoidasini buzardi. O'rniga botning o'z traplari hisobot beradi va davom etadi.
- `tracesSampleRate: 0` — tracing bepul tier kvotasini yeydi, kerak emas.
- `contextLines` **qoldirildi**: u faqat bizning manba kod satrlarimizni
  yuboradi (mijoz ma'lumoti manba kodda hech qachon bo'lmaydi) va hisobotni
  o'qish mumkin qiladi.

**Ops qismi:** `docker-compose.prod.yml` da `web` va `bot` uchun healthcheck
(image debian-slim, curl/wget yo'q → Node 20 ning global `fetch` i ishlatildi;
web `/login`, bot `/health`), va **4 ta servisga ham log cheklovi**
(`max-size 10m × 5`) — Docker'ning default json-file drayveri cheksiz o'sib,
oxir-oqibat VPS diskini to'ldirib Postgres'ni ham o'ldirardi.

**Qo'lda tekshirilgan qadamlar:**

1. Toza `postgres:16` → migratsiya → `db:seed`.
2. Bot `SENTRY_DSN` **siz** ishga tushdi → `"SENTRY_DSN not set — error
   reporting disabled"`, 3 ta worker start, polling ulandi.
3. Bot `SENTRY_DSN` **bilan** → `"error reporting enabled"`, xatti-harakat aynan bir xil.
4. **PII sizishi E2E tekshiruvi:** DSN lokal soxta ingest serveriga qaratildi,
   ma'lumot ish vaqtida (env orqali) berildi — manba kodda emas, ya'ni prod
   sharoiti. Yuborilgan payload tekshirildi:

   | Tekshirilgan | Natija |
   | --------------------------- | ---------- |
   | Trek kodi (xabar ichida) | tozalandi ✓ |
   | Trek kodi (kontekst ichida) | tozalandi ✓ |
   | Telefon `+998901234567` | tozalandi ✓ |
   | Telefon, probelli shakl | tozalandi ✓ |
   | Baza paroli | tozalandi ✓ |
   | Bot tokeni | tozalandi ✓ |
   | Mijoz ismi | tozalandi ✓ |
   | `tenantId` (PII emas) | **saqlandi** ✓ |

5. `uncaughtException` sun'iy chiqarildi → jarayon **omon qoldi** (8-qoida).
6. `docker compose config` — 3 healthcheck + 4 servisda log cheklovi tasdiqlandi.

**DoD:** ✅ typecheck · ✅ lint (0 warning) · ✅ **177 test** (166 → +11) ·
✅ toza bazada migratsiya · ✅ yuqoridagi 6 qadam.

**⚠️ Halol cheklov.** `@sentry/node` Next.js 14 da server action / server
component xatolarini **avtomatik ushlamaydi** — Next ularni error boundary'ga
aylantiradi, jarayon darajasiga chiqarmaydi. Shuning uchun ular
`app/error.tsx` orqali xabar qilinadi: admin **ko'rgan** har bir xato yoziladi,
lekin marshrut + `digest` bilan, to'liq stack trace esa server logida qoladi.
To'liq avtomatik ushlash `@sentry/nextjs` ni talab qiladi — u build-time webpack
plugin qo'shadi va bu repoda `next build` ning ma'lum nosozligi bor
(PROJECT.md §8), ya'ni pilotdan oldin **tekshirib bo'lmasdi**. T13 bilan birga
qilinadi.

<details>
<summary>Asl vazifa tavsifi (arxiv)</summary>

**Nega.** Sentry yo'q, alert yo'q, metrika yo'q. `web` konteynerida healthcheck
yo'q (faqat `postgres`da bor) — Next.js osilib qolsa Docker qayta ishga
tushirmaydi. Status xabarlari uchun panelda "yetkazildi/yetmadi" ko'rsatkichi
yo'q. Siz **ishonchlilik sotmoqchisiz, lekin uni o'lchamaysiz.**

**Ish hajmi:** ~1 soat

**Vazifalar:**
- [ ] `@sentry/node` (bot) + `@sentry/nextjs` (web), DSN `.env` dan (ixtiyoriy —
      bo'sh bo'lsa jim o'tadi)
- [ ] `bot.catch` va `uncaughtException` traplarini Sentry'ga ulash
- [ ] Job retry tugagandagi `logger.error`larni Sentry'ga (worker.ts:145, 219, 305)
- [ ] `docker-compose.prod.yml` — `web` uchun healthcheck (`GET /login` 200)
- [ ] `bot` uchun healthcheck (`GET /health` allaqachon bor)
- [ ] Docker log rotation: `logging.options.max-size` / `max-file` (disk to'lmasin)
- [ ] `.env.example` yangilash

</details>

---

## P1 — PILOT DAVOMIDA (~1–2 hafta)

### ☑ T6 · Layoutdan `listDebtors`ni olib tashlash — **BAJARILDI** (2026-07-27)

**Vazifalar:**
- [x] `getDebtTotals` — qarzdorlar soni **va** umumiy qarz bitta SQL aggregate
      bilan (`lib/queries/customers.ts`); `countDebtors` — nishon uchun o'ram
- [x] `layout.tsx` endi `countDebtors` chaqiradi
- [x] `getDashboardStats` ichidagi `listDebtors` ham `getDebtTotals` ga o'tdi
- [x] `computeDebtTiyin` qoidasi bitta joyda: `DEBT_OWED_STATUSES` eksport
      qilindi, SQL `IN (…)` shu massivdan quriladi
- [x] Test: har status uchun `computeDebtTiyin` va `DEBT_OWED_STATUSES` mos
      kelishi (`debt.test.ts`, 8 ta yangi tekshiruv)

**Suspense qilinmadi.** Ro'yxatdagi muqobil variant edi, lekin u sekin
query'ni yashiradi, tezlashtirmaydi: baza ishi o'sha-o'sha qoladi, faqat
nishon kechroq chiqadi. Aggregate ishning o'zini olib tashlaydi — 50 000
trekda **0.1 MB** heap (29 MB o'rniga), ya'ni yashiradigan narsa qolmadi.

**Qoida takrorlanmadi, ko'chirildi.** SQL `computeDebtTiyin` ning so'zma-so'z
tarjimasi: soft-deleted chiqmaydi (§7.8), NULL narx 0, to'lovlar ayiriladi,
`> 0` filtri esa **avansni boshqa mijozning qarziga qo'shib yubormaydi**.
`customers` jadvali umuman skanerlanmaydi — faqat qarzli treki yoki to'lovi
bor mijozda net nolga teng bo'lmasligi mumkin, shuning uchun ikkita
guruhlangan tomon `FULL JOIN` qilinadi.

**O'lchov** (toza `postgres:16`, 50 000 trek / 6 000 mijoz / 20 000 to'lov,
har biri 3 marta issiq; harness bir martalik, repoda saqlanmadi):

| Nishon (har sahifa yuklanishida) | Vaqt | Node heap |
| ---------------------------------- | --------- | --------- |
| **Oldin** — `listDebtors(...).length` | 655 ms | +29.0 MB |
| **Keyin** — `countDebtors` (aggregate) | **41 ms** | **+0.1 MB** |
| Tezlanish | **16×** | **290×** |

**DoD:** ✅ typecheck (4/4) · ✅ lint (0 warning) · ✅ **252 test**
(239 shared + 13 bot; T3 dan keyin 229) · ✅ toza bazada 7 migratsiya + seed ·
✅ jonli bazada 38/38 tekshiruv (T19 bilan birga, pastda) · ✅ Spec.md § 5.10
yangilandi · yangi user-facing string yo'q.

---

### ☐ T7 · Bulk operatsiyalarni tranzaksiya + chunkga o'tkazish

`queries.ts:379–412` (`setTrackStatuses`) va `queries.ts:1056–1080`
(`changeBatchStatus`) — har trek uchun alohida `UPDATE` + `INSERT`, tsiklda,
**tranzaksiyasiz**. 500 trek = 1000+ round trip; yarmida uzilsa yarim
qo'llanilgan holat qoladi va yarim xabar ketadi.

To'g'ri namuna kodda bor: `applyImport` (`queries.ts:1155`) — chunked + tranzaksiya
+ notify'ni commitdan **keyin** enqueue qilish. Shu naqshni ko'chirish.

- [ ] `setTrackStatuses` — bitta tranzaksiya, status bo'yicha guruhlab bulk UPDATE
- [ ] `changeBatchStatus` — xuddi shunday
- [ ] Notify enqueue faqat commitdan keyin (import'da qilinganidek)
- [ ] `IMPORT_CHUNK` (1000) ni umumiy konstantaga chiqarish
- [ ] Test: 2 500 trekda status o'zgarishi, parametr limiti oshmasligi

### ☐ T8 · Rollarni majburlash + admin boshqaruvi

`role` ustuni bor, lekin **faqat bitta joyda** ishlatiladi —
`layout.tsx:16` da "Egasi"/"Xodim" yozuvi. Boshqa hech qayerda tekshirilmaydi.
Ya'ni `staff` login: valyutani o'zgartiradi, tariflarni tahrirlaydi,
3 000 mijozga broadcast yuboradi, xodim Telegram IDlarini almashtiradi.

Bundan tashqari **admin qo'shish / parol o'zgartirish UI umuman yo'q** — bitta
kargoda 4 xodim bitta parolni bo'lishadi; parol ketsa siz DBga qo'l bilan kirasiz.

- [ ] `requireOwner()` guard — `lib/auth.ts`
- [ ] Faqat owner: `/settings` (valyuta, tariflar, staff IDlar), `/broadcast`,
      trekni o'chirish, admin boshqaruvi
- [ ] `/settings/admins` — admin qo'shish/o'chirish, rol tanlash
- [ ] Parolni o'zgartirish (joriy parolni so'rab)
- [ ] Sessiya bekor qilish: `admin_users` ga `session_epoch` (int) — parol
      o'zgarsa oshiriladi, `verifySessionToken` tekshiradi (hozir 30 kunlik
      token bekor qilinmaydi — `lib/session.ts`)
- [ ] Server action darajasida tekshirish (faqat UI yashirish yetarli emas)

### ☐ T9 · Login rate limit

`apps/web/app/login/actions.ts` — hech qanday chegara yo'q. Yana: telefon
global unique emas, shuning uchun har urinishda mos qatorlar soniga teng
argon2 chaqiriladi (qimmat) → arzon DoS vektori.

- [ ] IP + telefon bo'yicha oyna (masalan 10 urinish / 15 daqiqa)
- [ ] Postgresda saqlash (`login_attempts` jadvali) — konteyner qayta ishga
      tushsa ham saqlanadi
- [ ] Bir xil `LOGIN_ERROR` matni saqlanib qolsin (user enumeration bo'lmasin)
- [ ] `/sa/login` uchun ham xuddi shunday

### ☐ T10 · "Filtrga mos hammasini tanlash"

`tracks-table.tsx:75` — `toggleAll` faqat `rows` (20 qator) ustida ishlaydi.
500 trekni IN_TRANSIT qilish = 25 sahifa × qo'lda tanlash.

- [ ] Bulk barda "Filtrga mos {N} tani tanlash" varianti
- [ ] Action `trackIds` emas, **filtr** qabul qiladi (server tanlaydi) —
      katta ro'yxatni client'dan yubormaslik
- [ ] Tasdiq modalida aniq son: "{N} ta trek, {M} ta mijozga xabar"

### ☐ T11 · "Biriktirilmagan treklar" ekrani

Bu adminning **asosiy kunlik vazifasi**, lekin alohida ko'rinishi yo'q — faqat
ro'yxatda "Biriktirilmagan" yozuvi. T1 dan keyin bu ekran biriktirish oqimining
kirish nuqtasi bo'ladi.

- [ ] `/tracks?unassigned=1` filtri (yoki alohida `/unassigned` sahifasi)
- [ ] Navigatsiyada son bilan nishon
- [ ] Har qatorda tez biriktirish (mijoz qidiruvi bilan)
- [ ] Bulk biriktirish

### ☐ T12 · Pagination: mijozlar va qarzdorlar

`customers/page.tsx` va `debtors/page.tsx` barcha qatorni render qiladi —
3 000 mijoz = 3 000 DOM qatori + og'ir HTML.

- [ ] `TRACKS_PAGE_SIZE` naqshini mijozlarga ham qo'llash
- [ ] Qarz bo'yicha SQL sortirovka (hozir xotirada — `queries.ts:797`)
- [ ] Qidiruv + pagination birga ishlashi

---

## P2 — BIRINCHI PULLIK MIJOZDAN KEYIN

### ☐ T13 · Xabar yetkazish jurnali

Hozir status xabari yuborilganini panelda ko'rish imkoni yo'q. Mijoz botni
bloklagan bo'lsa (`worker.ts:136` — `isPermanentSendError` → jim tashlab
ketiladi) admin bilmaydi. Bu sizning **asosiy qiymat da'vongizni isbotlaydi**.

- [ ] `notifications` jadvali: track_id, customer_id, status, sent_at, error
- [ ] Worker natijani yozadi (muvaffaqiyat ham, `permanent error` ham)
- [ ] Trek detalida "Xabarlar" bo'limi
- [ ] Mijoz kartasida "🚫 Botni bloklagan" belgisi
- [ ] Dashboardda "Yetmagan xabarlar: N"

### ☐ T14 · Undo va savat

300 trekka xato "Topshirildi" bosilsa → 300 xato xabar bir zumda ketadi,
orqaga yo'l yo'q. Soft-deleted treklar uchun ko'rinish ham yo'q.

- [ ] Bulk operatsiyani "operation" sifatida yozish (`bulk_operations` jadvali)
- [ ] 60 soniya ichida "Bekor qilish" — statuslarni qaytarish
- [ ] Xabarlarni kechiktirib yuborish (`startAfter: 60s`) — bekor qilinsa
      navbatdan o'chirish. pg-boss `cancel` qo'llab-quvvatlaydi
- [ ] `/tracks?deleted=1` savat ko'rinishi + tiklash

### ☐ T15 · UX: progress va instant qidiruv

- [ ] Bulk operatsiyada progress ("240 / 500") yoki hech bo'lmasa aniq holat
- [ ] Qidiruvda debounce + instant natija (skaner uchun Enter ishlashi saqlanadi)
- [ ] Optimistic UI: status o'zgarishi darhol ko'rinsin
- [ ] `loading.tsx` faqat `/tracks`da bor — boshqa ekranlarga ham qo'shish

### ☐ T16 · Bot sessiyasini Postgresga o'tkazish

`apps/bot/src/bot.ts:20` — `session({ initial: ... })`, xotirada. Har deploy
flow o'rtasidagi foydalanuvchilar holatini yo'qotadi va >1 replikani bloklaydi.

- [ ] `@grammyjs/storage-*` yoki oddiy `bot_sessions` jadvali
- [ ] TTL (masalan 1 soat) — eski yozuvlar tozalanadi

---

## P3 — O'SISH VA RAQOBAT

### ☐ T17 · Panelni ruscha qilish
Toshkent kargolarida ofis xodimlari ko'pincha ruscha ishlaydi. Bot ikki tilli,
panel emas — sotuvda e'tiroz bo'ladi.
- [ ] Panel stringlarini `packages/shared/src/i18n/` ga ko'chirish
- [ ] Admin tili `admin_users.lang` da saqlanadi

### ☐ T18 · Paneldan rasm yuklash
Hozir faqat bot staff mode. Ofisdan tuzatish imkoni yo'q.
- [ ] Trek detalida rasm yuklash/o'chirish (JPEG, 10 MB — bot bilan bir xil qoida)

### ☑ T19 · Dashboardni operatsion qilish — **BAJARILDI** (2026-07-27)

**Vazifalar:**
- [x] `packages/shared/src/services/worklist.ts` — 3 ta worklist kaliti,
      uz+ru yorliqlar, 7 kunlik chegara, `stalePickupCutoff` + **14 test**
- [x] "⚖️ Tortish kerak" (CHINA_WAREHOUSE, og'irliksiz)
- [x] "🙋 Biriktirilmagan" (T11 ga kirish nuqtasi — `?work=unassigned`)
- [x] "⏳ Olib ketilmagan" (7 kundan beri READY_FOR_PICKUP)
- [x] `getWorklistCounts` — uchalasi **bitta** skanda, `FILTER` bilan
- [x] `/tracks?work=…` — dashboard kartasi bosilganda aynan o'sha qatorlar
- [x] "⬇️ Excel" ham `work` ni oladi — fayl ekrandan farq qilmaydi (T2 qoidasi)
- [x] Daromad grafigi **pastga surildi**: operatsion blok endi eng tepada

**Bir shart, ikki joyda emas — bitta joyda.** Har worklist yagona
`trackWorklistCondition()` da yashaydi; dashboard uni `count(*) FILTER
(WHERE …)` ichida, `/tracks` esa `WHERE` da ishlatadi. Shuning uchun
karta hech qachon bo'sh ekranga olib borolmaydi. Bu T2 dagi `tracksFilter`
naqshining o'zi.

**"7 kun" qayerdan olinadi — muhim qaror.** `tracks` da status vaqti yo'q.
`created_at` bo'yicha hisoblash noto'g'ri bo'lardi: u kod **import qilingan**
kun, va qayta import qilingan kodda oylar farq qiladi. Shuning uchun
`track_events` dagi **oxirgi** (`MAX`, `EXISTS` emas) `READY_FOR_PICKUP`
yozuvi olinadi — READY → DELIVERED → yana READY bo'lgan trek yangi
tayyorligi bo'yicha baholanadi. Audit yozuvi umuman bo'lmasa `created_at`
zaxira sifatida ishlaydi (jonli bazada ikkala holat ham tekshirildi).
Oyna — sof 7×24 soat, kalendar kuni emas: "bir haftadan beri turibdi" —
davomiylik, unga vaqt mintaqasi kerak emas (§7.9 kun bucketlariga tegishli).

**Worklistlar ataylab kesishadi.** Mijozsiz va tortilmagan trek ikkalasida
ham ko'rinadi — har biri o'z savoliga javob beradi, "bo'linish" emas.
Tekshiruvda buni birinchi urinishda o'tkazib yubordim (kutilgan 3, chiqdi 4);
xato kodda emas, kutilgan sonda edi.

**UI (mobil/desktop):** telefonda uchta baland qator (58 px, barmoq uchun),
`sm` dan boshlab uch ustun — blok ekranning yarmini egallamaydi. Ish bo'lsa
qatorlar sarg'ish (`#fffbf3`), soni to'q sariq; ish bo'lmasa oq va oqargan
nol. Uchalasi nol bo'lsa blok bitta yashil `Navbat bo'sh` qatoriga yig'iladi.
`/tracks` da worklist faolligida status chiplari **yashiriladi** va o'rniga
banner + `✕ Filtrsiz` chiqadi: worklist allaqachon statusni belgilab
qo'ygan, ustiga chip bosilsa ikkinchi filtr kabi ko'rinib bo'sh natija
berardi.

**Qo'lda tekshirilgan qadamlar** (toza `postgres:16`, 55433-port):

1. Toza konteyner → `drizzle-kit migrate` (**7 migratsiya toza**) → `db:seed`.
2. Verifikatsiya harness'i — **haqiqiy** `lib/queries/*` funksiyalarini
   chaqiradi, ikkita tenantga **bir xil** ma'lumot quyadi.
   **38/38 tekshiruv o'tdi:**

   | Tekshirilgan | Natija |
   | ------------------------------------------------------------- | ------ |
   | T6: aggregate == `listDebtors` (soni va tiyini) — 2 tenantda | ✅ |
   | T6: avans / faqat-to'lov / nol-net qarzdor hisoblanmaydi | ✅ |
   | T6: soft-delete tiklandi/qaytarildi → ikkala yo'l bir xil ko'chdi | ✅ |
   | T19: dashboard soni == `/tracks?work=` qatorlari (3 worklist × 2 tenant) | ✅ |
   | T19: dashboard soni == Excel eksport qatorlari | ✅ |
   | 7 kun **aniq chegara**: 8 kun ✅, 7 kun ✗, 6 kun ✗ | ✅ |
   | READY → DELIVERED → READY (kecha) → stale **emas** (`MAX`) | ✅ |
   | Audit yozuvsiz eski trek → `created_at` zaxirasi ishladi | ✅ |
   | Topshirilgan trek eski READY yozuvi bilan → chiqmaydi | ✅ |
   | Soft-deleted trek hech qaysi worklistda yo'q (§7.8) | ✅ |
   | `now` surilganda chegara ham suriladi (+2 kun → +2 trek) | ✅ |
   | worklist + qidiruv birga ishlaydi | ✅ |
   | Boshqa tenant kodlari natijaga sizmaydi | ✅ |

3. «Bugungi ish» bloki `renderToStaticMarkup` bilan haqiqiy HTML ga render
   qilindi — **16/16**: uchala havola (`/tracks?work=…`), sonlar, nol
   qatorning so'lg'inligi, bo'sh holat (havolasiz), `sm:grid-cols-3` va
   `min-h-[58px]`.
4. 50 000 trekda o'lchov (T6 jadvali yuqorida). Yangi blokning narxi:
   **77 ms**, bitta skanda
   (`unassigned` 10 ms + `to_weigh` 13 ms + `stale_pickup` 42 ms alohida
   o'lchanganda). Dashboard barcha query'ni `Promise.all` bilan parallel
   qiladi, ya'ni bu wall-clock ga qo'shilmaydi.

**Yo'l-yo'lakay topilgan nozik joy.** Xom `sql` shablon ichida drizzle
qiymatga ustun mapper'ini qo'llamaydi, postgres.js esa yalang'och `Date` ni
serializatsiya qila olmaydi (`ERR_INVALID_ARG_TYPE`, faqat ishga tushirganda
chiqadi — typecheck ushlamaydi). Chegara `::timestamptz` bilan aniq ISO
matn sifatida beriladi.

**DoD:** ✅ typecheck (4/4) · ✅ lint (0 warning) · ✅ **252 test** ·
✅ toza bazada migratsiya + seed · ✅ yuqoridagi 4 qadam ·
✅ Spec.md § 5.2 / § 5.10 yangilandi · ✅ yangi stringlar uz **va** ru da
(`WORKLIST_META` — panel hozircha `uz` so'raydi, T17 uchun tayyor).

**⚠️ Halol cheklov.** Tekshiruv **ma'lumot qatlamini** (haqiqiy query'lar,
haqiqiy baza, ikki tenant) va «Bugungi ish» blokining **render natijasini**
qamraydi, lekin brauzerda **qo'lda bosib chiqilmadi** — panelga kirish parol
kiritishni talab qiladi. `/tracks` dagi worklist banneri render testiga
kirmagan (u async sahifa ichida inline JSX). Pilotdan oldin bir marta bosib
chiqing: Bosh sahifa → uchala karta → `✕ Filtrsiz` → «⬇️ Excel».

Yuqoridagi uchala harness **bir martalik** edi va repoda saqlanmadi —
`apps/web` da hamon doimiy test yo'q, ya'ni bu tekshiruvlar regressiyani
ushlab tura olmaydi. Doimiy qoplama — **T24**.

**T21 hali ochiq.** Grafik olib tashlanmadi, faqat pastga surildi —
o'chirish T21 ning qarori.

### ☐ T20 · Telegram Mini App (raqobat uchun)
Cargou'da bor, sizda yo'q. Bot yetadi, lekin demo taqqoslashda yutqazasiz.
- [ ] Mini App: mijoz kabineti — treklar jadvali, qarz, to'lov tarixi, rasmlar
- [ ] Bot reply keyboard saqlanadi (hamma Mini App'ni ochmaydi)

---

## ☐ OLIB TASHLASH / SODDALASHTIRISH

### ☐ T21 · Dashboard daromad grafigi
`tushum-chart.tsx` — hech kim unga qarab qaror qilmaydi. O'rniga T19 dagi
operatsion navbat. (Agar egalar so'rasa — qaytarish oson.)

### ☐ T22 · Hujjatlarni 7 dan 2 ga qisqartirish
`CLAUDE.md`, `Spec.md`, `PROJECT.md`, `README.md`, `ONBOARDING.md`, `DEPLOY.md`,
`BRANDING.md` — 17 commitli loyihaga juda ko'p, chirishga tayyor.
`PROJECT.md` ~90 % `Spec.md` takrori.
- [ ] Saqlash: `CLAUDE.md` (qoidalar) + `Spec.md` (kontrakt)
- [ ] `README.md` — qisqa quick start
- [ ] Qolganini `docs/` ga yoki `Spec.md` ilovasiga birlashtirish

### ☐ T23 · Bot kalkulyatorini qayta ko'rib chiqish
Spec § 3.9. Narx bahsini chaqiradi ("kalkulyator 40 ming dedi"), egalar odatda
qo'lda kotirovka beradi. Flow/session holati saqlaydi.
- [ ] Pilotda o'lchash: nechta mijoz ishlatdi
- [ ] Kam ishlatilsa — olib tashlash

### ⚠️ USD rejimi — hozir tegmang
`currency` + `usd_rate_tiyin` + `price_usd_cents` + `usd_rate_used` + muzlatish
+ `price_manual` — eng katta test yuki va murakkablik manbasi. **Olib tashlamang**
(ko'p kargo $/kg da narx qo'yadi), lekin birinchi 3 mijoz UZSda bo'lsa — bu
o'z-o'zini oqlamagan murakkablik ekanini yozib qo'ying.

---

## ☐ T24 · Test qoplamini muvozanatlash (fon vazifasi)

11 700 satr `apps/*` kodi test bilan qoplanmagan. Hammasini emas, **eng
xatarli yo'llarni**:
- [ ] `lib/session.ts` — token imzo/muddat (xavfsizlik)
- [ ] `lib/superadmin.ts` — constant-time solishtirish
- [ ] `login/actions.ts` — noto'g'ri parol, buzilgan hash, rate limit
- [ ] `queries.ts` tenant-scoping: har funksiya boshqa tenant ma'lumotini
      **qaytarmasligi** (bitta parametrlashtirilgan test)
- [ ] `apps/bot/src/handlers/text.ts` — router ustuvorligi (menyu > flow > lookup)

---

## 5. Raqobat manzarasi (rostini aytganda)

### Eng jiddiy: Cargou — [cargou.lovable.app](https://cargou.lovable.app/features)
Aynan shu bozor, aynan shu mijoz. Ba'zi joyda **sizdan oldinda**:

| Cargouda bor | Sizda |
| ---------------------------------------------- | ----------------------- |
| 1688 parser + AI (mahsulot kartasini o'qish) | ❌ |
| Xarid/закупка boardi (to'lov, postavshik, Xitoy treki) | ❌ |
| **Telegram Mini App** — to'liq mijoz kabineti | Reply keyboard bot (T20) |
| Rol boshqaruvi: ega/admin/menejer/ombor — majburlangan | Bezak `role` (T8) |
| QO kod (ombor identifikatsiyasi) | Ataylab olib tashlangan |

**Sizning ustunligingiz (buni sotuvda old planga qo'ying):**
- **Haqiqiy multi-tenancy — har kargo O'ZINING brendli boti bilan.** Cargou
  bitta umumiy mini-app ko'rinadi. Bu eng katta differensiator.
- **Qarz hisobi** — ular ro'yxatida yo'q, o'zbek kargosining № 2 og'rig'i.
- 5 daqiqada onboarding (`/sa` + `getMe` + `setWebhook`).

### Prospektlaringiz allaqachon bot qurgan
[Abu Sahiy](https://abusahiylogistics.uz/) (@AS_cargo_bot),
[Premium Cargo](https://t.me/s/PremiumCargo) (@Premiumcargobot),
[BTB Cargo](https://uz.tgstat.com/en/channel/@BTBCargo),
[Transit Pro](https://transitpro.uz/) — hammasida bot bor.
[iPost](https://ipost.uz/uz) esa 790 punkt + real-time tracking bilan mijoz
kutilmasini belgilab qo'ygan.

➡️ **Eng katta kargolar sizning mijozingiz emas** — ular qurgan.
Sizning bozori: **o'rta qatlam** — kanalida 2 000–20 000 obunachi, hali Excelda.

### 💥 Narx ankeri muammosi
[Kwork'da](https://kwork.ru/script-programming/34461407/telegram-bot-dlya-kargo)
"kargo uchun Telegram bot" — **19 000 rubl (~$200), bir marta.**
Siz: 1,2 mln so'm/oy ≈ **$95/oy = $1 140/yil.**

Ega albatta shu solishtiruvni qiladi. Javobingiz "bot" bo'lishi mumkin emas —
bot arzon commodity. Sotadigan narsangiz: **panel + qarz hisobi + kafolatlangan
yetkazish + support.** Ammo hozir "kafolatlangan yetkazish"ni tizim
**o'lcholmaydi** (T5, T13) — ya'ni asosiy qiymat da'vosi isbotlanmagan.
Shuning uchun T5 va T13 — marketing vazifasi, texnik vazifa emas.

---

## 6. Tavsiya etilgan tartib

```
1-kun   T4 ✅ (indekslar) → T5 ✅ (Sentry+healthcheck)
2-kun   T1 ✅ (biriktirish) — eng katta va eng muhim
3-kun   T2 ✅ (eksport)
4-kun   T3 ✅ (throughput+adolat)

P0 YOPILDI. Qoldi: panelni brauzerda qo'lda bosib chiqish → demo yozib olish.

Pilot boshlanadi. Pilot davomida: T6 ✅ → T7 → T8 → T11 → T10 → T9 → T12
Birinchi to'lovdan keyin: T13 → T14 → T15 → T16
Keyin: T17–T18, T20 (T19 ✅), va T21–T23 tozalash.
```

**Keyingi:** `T7` (bulk operatsiyalarni tranzaksiya + chunkga o'tkazish) —
500 trekda yarim qo'llanilgan holat xavfi eng katta ochiq nuqson.
Undan keyin T8 (rollar) va T11 (biriktirilmagan ekrani — T19 dagi
`?work=unassigned` allaqachon uning kirish nuqtasini berdi).
