# HANDOFF — 2026-08-16 (ikkinchi sessiya)

Bu fayl bitta sessiyaning yakuni. Uzoq muddatli manbalar o'zgarmaydi:
**SPEC.md** — xulq shartnomasi, **tasks.md** — ish ro'yxati,
**docs/DECISIONS.md** — qarorlar. Ziddiyat bo'lsa, o'sha uchtasi ustun.

Oldingi sessiya (H, I, K, L epiklari) yakuni git tarixida: `ae4f285`.

---

## 1. Nima qilindi

**M epiki (import himoyasi) to'liq qurildi** — D-001 tartibi bilan:
qaror raundi (egasi) → DECISIONS → SPEC → kod → DoD.

| Commit | Nima |
|---|---|
| `c75bcf1` | D-010 + SPEC 5.4/7.18 (koddan oldin) |
| `32d779c` | M1–M3: `import_runs`, undo, muammoli qatorlar eksporti |
| `21435e9` | M2 tuzatishi: ushlab turilgan xabar faqat trek haqiqatan qaytgan bo'lsa tashlanadi |

Testlar: **447** (shared, +15) + **44** (bot) + **46** (web) — hammasi yashil,
typecheck va lint ham. Migratsiya **0022 additive**, toza Postgres 16 da
`0000→0022` o'tdi.

**Hech narsa push qilinmadi** — egasi o'zi push qiladi (push = avtodeploy).
Lokalda endi **19 commit** va **9 migratsiya** (0014–0022) push kutmoqda.

---

## 2. Egasi qabul qilgan qarorlar (D-010)

To'liq matn: `docs/DECISIONS.md`. To'rtala savolga tavsiya bo'yicha javob berildi:

1. **Undo — to'liq qaytarish.** Yaratilganlar soft-delete, status ortga (yangi
   teskari event), to'ldirilgan maydonlar bo'shaydi, biriktirilgan mijoz
   uziladi, reys avvalgiga, tiriltirilgan trek qayta o'chadi. **Importdan keyin
   o'zgargan qator butunlay tegilmaydi** va hisobotda sanaladi.
   *Rad etildi:* "status qoladi" (asosiy xato tuzalmasdi), "faqat
   yaratilganlarni o'chirish" (og'riqni yopmasdi).
2. **Xabarlar jim.** Undo hech kimga yozmaydi; "N mijozga xabar ketib bo'lgan
   edi" deb halol aytiladi. *Rad etildi:* tuzatish xabari, undo'ni bloklash.
3. **Oyna 60 daqiqa**, bir marta. *Rad etildi:* 24 soat, "keyingi importgacha".
4. **Eksportda rad etilgan VA ogohlantirishli qatorlar**, sabab ustuni bilan.
   *Rad etildi:* faqat tashlanganlar; butun fayl + natija ustuni.

**Men qabul qilgan texnik qaror (D-010 ichida yozilgan):** import
bildirishnomalari ham **60 soniya ushlab turiladi** (K bilan bir xil raqam).
Bu 2-band ishlashi uchun shart — navbat bir necha soniyada bo'shaydi, ya'ni
holdsiz "navbatdagilar to'xtatiladi" bo'sh va'da bo'lardi.

---

## 3. Qaysi fayllar va nega

- **`packages/shared/services/importRun.ts`** (yangi) — undo qoidalari sof
  funksiya: `planImportUndoRow` (qator darajasida solishtirish),
  `importUndoState`, oyna va hold konstantalari, `rejected` tiplari.
  15 ta test — undo mantig'ining yagona testlanadigan yadrosi.
- **`packages/db/schema.ts` + migratsiya 0022** — `import_runs`: sanoqlar,
  `items` jsonb (nima yozildi / o'rnida nima bor edi), `rejected` jsonb,
  `undone_*`. **Nega jsonb:** to'ldirish (fill-if-empty) yozuvlari
  `track_events`ga hech nima yozmaydi, `batch_id`/`deleted_at` esa ustiga
  yoziladi — tarixdan run'ni tiklab bo'lmaydi. `tracks`ga bitta ham ustun
  qo'shilmadi; per-trek iz — `track_events.meta.runId`.
- **`apps/web/lib/queries/import.ts`** — run yozuvi importning O'ZI bilan bitta
  tranzaksiyada (rollback bo'lsa "bo'ldi" deydigan qator qolmaydi); yozilgan
  qiymatlar INSERT va dalil uchun bitta joydan chiqadi.
- **`apps/web/lib/queries/import-runs.ts`** (yangi) — ro'yxat, undo, eksport
  o'qishi. Undo `SELECT … FOR UPDATE` bilan (ikki marta bosilsa bir marta
  ishlaydi); tiklashda `COALESCE` ISHLATIB BO'LMAYDI (NULL ga qaytarish —
  aynan maqsad), shuning uchun qatorlar "yozilgan shakl" bo'yicha guruhlanadi
  va har guruh bitta `UPDATE … FROM (VALUES …)` bo'ladi.
- **`apps/bot/worker.ts`** — import notify'si faqat trek haqiqatan ortga
  qaytgan bo'lsa tashlanadi (undo o'tkazib yuborgan qator va §7.6 dedupe
  bilan qo'shilib ketgan qo'lda o'zgarish — haqiqiy holat, xabar ketishi
  kerak). Soatlik sweep 7 kundan keyin `items`ni tozalaydi.
- **`features/import/*`** — natija ekranida va yangi `Oxirgi importlar`
  kartasida undo + `Muammoli qatorlar` yuklab olish (natija ekrani sahifa
  yopilishi bilan o'ladi, xato esa undan keyin payqaladi).
- **`messages/{uz,ru}.json`** — barcha yangi matnlar ikkala tilda.

---

## 4. Hozir nima ishlamayapti / ochiq muammolar

1. **Hech narsa prod'da yo'q.** 19 commit, 9 migratsiya push kutmoqda.
2. **0016 destruktiv** — eski kod o'qiydigan `tracks.photo_path` ni DROP
   qiladi. Migratsiya bilan konteyner restarti orasida eski kod 500 beradi:
   tinch soatda deploy, restart darhol. (0019–0022 additive.)
3. **F3 switchover** — deploy'dan keyin HAR tenant'da /sa'dagi "Webhook"
   tugmasi bosilishi kerak. **F3-b** (eski token-path'ni o'chirish) ochiq.
4. **Deploy'dan keyin xabarlar ~1 daqiqa kechikadi** (import qilinganlari).
   Bu **xato emas** — D-010 ning ataylab qilingan narxi; egasi "sekinlashdi"
   deb yozmasligi uchun shu yerda qayd etilgan.
5. **Test infratuzilmasi chegarasi (ongli, o'zgarmadi):** DB-backed test ham,
   React komponent testi ham yo'q. M da ham shunday — undo tranzaksiyasi va
   UI testsiz; sof qoidalar testlangan. Undo'ning xom SQL shakli
   (enum/timestamptz/uuid cast, haqiqiy NULL tiklash) toza Postgres 16 da
   psql bilan alohida tekshirildi.
6. **Qo'lda tekshirilmagan oqimlar** (qurilma kerak): QR skan va /weigh
   skaneri — real Android telefon; TWA ekranlari — real Telegram; pg-boss
   `startAfter` ning haqiqatda hurmat qilinishi (endi K uchun ham, M uchun ham).
7. **Windows'da `next build` ishonchsiz** — yagona hakam Docker/CI build.
8. **J epiki boshlanmagan** va uning DECISIONS yozuvi yo'q (D-001 bo'yicha
   qaror raundisiz boshlanmaydi). Savollari pastda.

---

## 5. Keyingi qadamlar (tartib bilan)

1. **Push va deploy (egasi).** Tinch soat: push → CI yashil → deploy →
   konteyner restarti darhol → /sa'da har tenant uchun "Webhook" → 0016
   tufayli bitta trekda fotolarni ochib ko'rish.
2. **Deploy'dan keyin qo'lda tekshirish** (har epic ostida tasks.md'da
   batafsil): **H** (murojaat oqimi, ko'p foto), **I** (o'lchamli/o'lchamsiz
   tortish, kalkulyatorning 3-qadami), **K** (test yuborish, 60s ichida
   bekor, oynadan keyin to'xtatish), **L** (🪪, /card, QR bilan mijoz
   tanlash), **M** (xato fayl → bekor qilish → oldin tortilgan/topshirilgan
   qatorga tegilmasligi → muammoli qatorlar xlsx'i).
3. **J epiki — avval qaror raundi** (D-001). Ochiq savollar:
   - **Tenant o'chirilganda mijozlar nima ko'radi?** Bot butunlay jim
     bo'ladimi, yoki "vaqtincha ishlamayapti" deb javob beradimi?
   - **Panel qulfi qanchalik qattiq?** Owner ham kira olmaydimi, yoki faqat
     to'lov ekrani ochiladimi (ma'lumotini ko'rib tursin)?
   - **Grace tugagach avto-o'chirish haqiqatan avtomatikmi**, yoki /sa'da
     "muddati o'tgan" ro'yxati bo'lib, o'chirishni odam bosadimi?
   - **Ogohlantirishni kim oladi** — faqat owner'mi yoki hamma xodimmi, va
     qaysi kanal (bot / panel banner / ikkalasi)?
4. **P1 pilot** — D-002 bo'yicha F–M tugagach (ya'ni J dan keyin).

---

## 6. Kerakli buyruqlar

```bash
# DoD gate (har task uchun majburiy)
pnpm typecheck && pnpm lint && pnpm test

# Bitta paketni tez tekshirish
pnpm --filter @kargotrack/shared test
pnpm --filter @kargotrack/web typecheck

# Bitta test fayli
cd packages/shared && pnpm vitest run src/services/importRun.test.ts

# Migratsiya yaratish (schema.ts o'zgargach)
pnpm db:generate

# Migratsiyani TOZA bazada tekshirish (bir martalik konteyner)
docker run -d --rm --name kt-test -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=kargotrack -p 55433:5432 postgres:16-alpine
DATABASE_URL="postgres://postgres:test@localhost:55433/kargotrack" \
  pnpm --filter @kargotrack/db db:migrate
docker exec kt-test psql -U postgres -d kargotrack -c "\d import_runs"
docker stop kt-test
# Eslatma (Windows/Git Bash): psql'ga fayl bersangiz yo'l buziladi —
# `docker exec -i kt-test psql … < fayl.sql` shaklida bering.

# Lokal ishga tushirish (web :3000, bot :8443)
pnpm dev

# Build — Windows'da ishonmang, Docker/CI hakam (yuqoridagi 7-band)
```

Push = avtodeploy: `git push` dan keyin GitHub Actions verify → GHCR image →
VPS deploy. Deploy mantig'i `deploy.sh` da, workflow YAML'da emas.
