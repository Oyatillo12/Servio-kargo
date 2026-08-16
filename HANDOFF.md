# HANDOFF — 2026-08-16 sessiyasi

Bu fayl bitta sessiyaning yakuni. Uzoq muddatli manbalar o'zgarmaydi:
**SPEC.md** — xulq shartnomasi, **tasks.md** — ish ro'yxati,
**docs/DECISIONS.md** — qarorlar. Ziddiyat bo'lsa, o'sha uchtasi ustun.

---

## 1. Nima qilindi

Uchta epic to'liq qurildi (D-001 tartibi bilan: qaror → SPEC → kod → DoD),
va oldingi sessiyada yozilgan H epiki tekshirilib commit qilindi.

| Epic | Nima | Commitlar |
|---|---|---|
| **H** (nizo va dalil) | Kodi oldingi sessiyada yozilgan edi; DoD tekshirildi (yashil) va bitta commit qilindi | `63cdb01` |
| **I** (hajmiy narxlash) | O'lchamlar + hajmiy vazn, narx yoziladigan uch yo'lda, kalkulyator 3-qadami, mijozga sababi bilan ko'rsatish | `9792ec8` `6d1092b` `a4ac035` `f2642ca` `2f40d36` |
| **K** (broadcast xavfsizligi) | 60s ushlab turish + to'xtatish, "menga test yubor", bloklaganlar ko'rinishi | `7ac09cc` `c3f5aa3` `a7f8177` |
| **L** (QR klient-karta) | Bot + Mini App kartasi, skan bilan mijoz tanlash | `2b80149` `356ce64` `7464f53` |

**Hech narsa push qilinmadi** — egasi o'zi push qiladi (push = avtodeploy).

Testlar: **432** (shared) + **44** (bot) + **46** (web) — hammasi yashil,
typecheck va lint ham. Migratsiyalar `0000→0021` toza Postgres 16 da o'tdi.

---

## 2. Qaysi fayllar o'zgardi va nima uchun

Faqat "nega" muhim bo'lgan joylar. To'liq ro'yxat: `git diff --name-status 9792ec8~1..HEAD`.

### Umumiy (packages/shared)
- **`services/volumetric.ts`** (yangi) + testlar — hajmiy vazn qoidasi bitta
  joyda: `hisob = max(haqiqiy, hajmiy)`, tenglikda "haqiqiy". Narx yozadigan
  HAR yo'l shu yerdan o'tadi, shuning uchun panel va bot kelisha oladi.
- **`services/weigh.ts`** — `planWeighEntry` o'lchamlarni oladi; `WeighPricing`
  endi faqat `tracks` ustunlaridan iborat (query qatlami uni to'g'ridan-to'g'ri
  spread qiladi), o'lcham kalitlari **ixtiyoriy** — `null` spread qilinsa
  saqlangan dalilni tozalab yuborardi.
- **`services/broadcast.ts`** — `BroadcastJob` endi union (fan-out | test);
  `testChatId` yo'q eski job'lar fan-out deb o'qiladi (deploy xavfsizligi).
  `canStopBroadcast`, `broadcastHoldRemainingMs` — sof qoidalar, testlangan.
- **`services/clientCode.ts`** — `looksLikeClientCode`: bitta skaner trek kodi
  bilan mijoz QR'ini shakli bo'yicha ajratadi.
- **`i18n/*`** — `lookupCard`/`notifReadyForPickup`/`calcResult` ga `actualKg`
  qo'shildi: uning MAVJUDLIGI "hajmiy" so'zini yoqadi, ya'ni tushuntirilmagan
  katta raqam hech qachon chiqmaydi. Yangi: `cardCaption`, `calcStepDims`,
  `staffVolumetricNote`.

### DB (packages/db)
- **`schema.ts`** — `tracks`: `length_cm/width_cm/height_cm` + `volumetric_grams`
  (narx yozilganda MUZLATILADI, `usd_rate_used` mantig'i); `tariffs`:
  `volumetric_coef` NOT NULL 167; `broadcasts`: `recipient_count`, `status`,
  `cancelled_at/by`; `message_log`: blok skani uchun indeks.
- **`queue.ts`** — fan-out `startAfter` bilan (butun jo'natishga BITTA
  timestamp), `enqueueBroadcastTest`.
- **Migratsiyalar 0019, 0020, 0021** — hammasi additive. 0020 ichida backfill:
  eski `broadcasts` qatorlari `recipient_count = sent_count` bo'ladi, aks holda
  tarixda "12 / 0" ko'rinardi va tugagan xabarnoma to'xtatiladigandek turardi.

### Bot (apps/bot)
- **`handlers/calculator.ts`** — 3 qadam (tarif → vazn → o'lcham), 3-qadam
  ixtiyoriy va `⏭` bilan; format o'qilmasa bir marta qayta so'raydi, keyin
  baribir narx aytadi (mijoz narx so'ragan edi).
- **`handlers/card.ts`** (yangi) — QR PNG + izohda kod.
- **`worker.ts`** — broadcast job'ida: test bo'lsa alohida yo'l; aks holda
  **har xabardan oldin** `isBroadcastLive` tekshiriladi. Bekor qilingan
  yetkazish `message_log`ga hech nima yozmaydi.
- **`queries/weighing.ts`** — bot staff-rejimi o'lcham qabul qilmaydi, lekin
  trekda saqlangan o'lchamni ishlatadi (ikki surfeys narxda ajralmasin).

### Panel + Mini App (apps/web)
- **`lib/queries/track-pricing.ts` / `weighing.ts` / `import.ts`** — uchala
  narx yozish yo'li hajmiy vaznni hisobga oladi.
- **`lib/queries/broadcasts.ts`** — `cancelBroadcast` (bitta UPDATE),
  `sendBroadcastTest`. Bekor qilish sharti: `status='queued'` **va**
  `sent_count < recipient_count`.
- **`lib/queries/customers.ts`** — `blocked` CTE (oxirgi `notify` `dropped`),
  `onlyBlocked` filtri, `countBlockedCustomers`.
- **`components/shared/barcode.ts` + `scan-sheet.tsx`** — `features/weigh` dan
  KO'CHIRILDI: skan endi mijoz picker'ida ham ishlaydi (cross-feature).
- **`features/customers/components/customer-picker.tsx`** — QR skan tugmasi;
  aniq bitta mijozga tushsa o'zi tanlanadi. Bu bitta o'zgarish peshtaxta,
  biriktirish va trek detaliga birdan tegdi.
- **`messages/{uz,ru}.json`** — barcha yangi matnlar ikkala tilda
  (parity/ICU testi bilan qo'riqlanadi).

---

## 3. Qabul qilingan qarorlar (va rad etilganlari)

To'liq matn: `docs/DECISIONS.md`. Qisqasi:

### D-007 · Hajmiy narxlash xulq-atvori
- **Koeffitsiyent HAR tarifda**, NOT NULL default 167.
  *Rad etildi:* nullable ustun ("tarifga qarab yoqiladi") — egasi D-005 ni
  harfma-harf tanladi. Avto tarifda 167 past hisoblaydi, egasi tuzatadi.
- **Kalkulyatorda ixtiyoriy 3-qadam.** *Rad etildi:* bitta qatorda
  `3.2 50x40x30` — ko'rinmas imkoniyat bo'lib qolardi.
- **Mijoz hajmiy vaznni SABABI bilan ko'radi.** *Rad etildi:* faqat panelda —
  tushuntirilmagan raqam ertangi murojaat.

### D-008 · Broadcast xavfsizligi
- **60s oyna + oynadan keyin ham to'xtatish.** *Rad etildi:* faqat 60s oyna
  (61-soniyada payqagan odamga hech nima qolmaydi); kechiktirmasdan kuchli
  tasdiq (tasdiq xato matnni to'xtatmaydi).
- **Texnik shakl:** `broadcasts.status` + har xabardan oldin o'qish.
  *Rad etildi:* pg-boss job id'larini saqlab keyin cancel qilish — 3000 id
  mo'rt va yarim yo'ldagi jo'natishni to'xtata olmasdi.
- **Test — kirgan xodimning o'z Telegramiga.** *Rad etildi:* mijozga sinov
  yuborish. Test navbat orqali ketadi (qoida 3), tarixga yozilmaydi.
- **Bloklaganlar ko'rsatiladi, avtomatik chetlashtirilmaydi.** *Rad etildi:*
  avto-chetlashtirish — belgi taxmin, blokdan chiqqan mijoz qaytolmay qolardi.

### D-009 · QR klient-karta
- **QR ichida oddiy `client_code`.** *Rad etildi:* imzolangan token — QR faqat
  mijozni TANLAYDI, xodim ism/telefon/qarzni ko'rib tasdiqlaydi; kod baribir
  qutida yozilgan. Token uchta yangi nosozlik yo'li qo'shardi.
- **`qrcode` kutubxonasi qo'shildi** (siyosat bo'yicha alohida so'ralgan).
  *Rad etildi:* rasmsiz matn kartasi (L2 ni ma'nosiz qilardi), faqat Mini App.

---

## 4. Hozir nima ishlamayapti / ochiq muammolar

1. **Hech narsa prod'da yo'q.** Lokalda **16 ta commit** (A, F, G, H, I, K, L)
   va **8 ta migratsiya** (0014–0021) push kutmoqda.
2. **0016 destruktiv** — eski kod o'qiydigan `tracks.photo_path` ni DROP
   qiladi. Migratsiya bilan konteyner restarti orasida eski kod 500 beradi:
   tinch soatda deploy, restart darhol.
3. **F3 switchover** — deploy'dan keyin HAR tenant'da /sa'dagi "Webhook"
   tugmasi bosilishi kerak. Bosilmasa bot eski (token-li) yo'lda qoladi.
   **F3-b** (eski yo'lni o'chirish) hamon ochiq: eski loglardan token olgan
   hujumchi hali ham update yubora oladi.
4. **Qo'lda tekshirilmagan oqimlar** (test infra yo'qligi sababli — pastda):
   - QR skan va kamera oqimi — **real Android telefon kerak** (Windows
     Chrome'da `BarcodeDetector` yo'q). Bu yerda faqat "tugma chizilmaydi"
     yo'li va shakl-ajratish qoidasi tekshirildi.
   - pg-boss `insert()` `startAfter` ni haqiqatda hurmat qilishi (60s oyna).
   - /weigh skaner oqimi real skaner bilan, TWA ekranlari real Telegramda.
5. **Test infratuzilmasi chegarasi (ongli):** repoda DB-backed test ham,
   React komponent testi ham yo'q. Shuning uchun tranzaksiyalar (handover,
   ticket, broadcast cancel) va UI komponentlari testsiz; sof qoidalar
   testlangan. Har epicda bu tasks.md'da "Halol chegara" deb yozilgan.
6. **Windows'da `next build` ishonchsiz** — env sabablari bilan yiqiladi va
   haqiqiy Linux xatolarini YASHIRADI. Yagona hakam — Docker/CI build.
7. **M epiki boshlanmagan** va uning DECISIONS yozuvi yo'q (D-001 bo'yicha
   qaror raundisiz boshlanmaydi).

---

## 5. Keyingi qadamlar (tartib bilan)

1. **Push va deploy (egasi).** Tinch soatni tanlang. Ketma-ketlik:
   push → CI yashil → deploy → konteyner restarti darhol → /sa'da har
   tenant uchun "Webhook" tugmasi → 0016 tufayli trek fotolarini bitta
   trekda ochib ko'ring.
2. **Deploy'dan keyin qo'lda tekshirish** (tasks.md'da har epic ostida
   batafsil):
   - **H:** murojaat ochish → panelda javob → botda olish → yopish →
     yopiqga yozib qayta ochilishi; ko'p foto + har fotoga o'chirish.
   - **I:** /weigh'da `+ O'lcham` bilan va busiz tortish (skaner oqimi
     buzilmaganini), tarif koeffitsiyentini o'zgartirish ESKI treklarga
     tegmasligi, botda 3-qadamli kalkulyator, mijoz kartasida hajmiy qator.
   - **K:** test yuborish (Telegram ulangan/ulanmagan), 60s ichida bekor
     (hech kim olmasligi), oynadan keyin to'xtatish, bloklaganlar kartasi.
   - **L:** botda 🪪, Mini App /card, peshtaxtada QR skanerlab mijoz
     avto-tanlanishi, /weigh'da mijoz QR'i marka maydoniga tushishi.
3. **M epiki — avval qaror raundi** (D-001). Ochiq savollar:
   undo aynan nimani qaytaradi (faqat shu run YOZGAN maydonlarmi, status
   ham qaytadimi), oyna 60 daqiqami, va allaqachon ketgan bildirishnomalar
   bilan nima qilinadi. Keyin SPEC → M1 (`import_runs`) → M2 (undo) →
   M3 (rad etilgan qatorlar xlsx).
4. **J epiki** (tenant disable + billing-lite) — F–M ning oxirgisi.
5. **P1 pilot** — D-002 bo'yicha F–M tugagach boshlanadi.

---

## 6. Kerakli buyruqlar

```bash
# DoD gate (har task uchun majburiy)
pnpm typecheck && pnpm lint && pnpm test

# Bitta paketni tez tekshirish
pnpm --filter @kargotrack/shared test
pnpm --filter @kargotrack/web typecheck

# Bitta test fayli
cd packages/shared && pnpm vitest run src/services/volumetric.test.ts

# Migratsiya yaratish (schema.ts o'zgargach)
pnpm db:generate

# Migratsiyani TOZA bazada tekshirish (bir martalik konteyner)
docker run -d --rm --name kt-test -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=kargotrack -p 55433:5432 postgres:16-alpine
DATABASE_URL="postgres://postgres:test@localhost:55433/kargotrack" \
  pnpm --filter @kargotrack/db db:migrate
docker exec kt-test psql -U postgres -d kargotrack -c "\d broadcasts"
docker stop kt-test

# Lokal ishga tushirish (web :3000, bot :8443)
pnpm dev

# Build — Windows'da ishonmang, Docker/CI hakam (yuqoridagi 6-band)
```

Push = avtodeploy: `git push` dan keyin GitHub Actions verify → GHCR image →
VPS deploy. Deploy mantig'i `deploy.sh` da, workflow YAML'da emas.
