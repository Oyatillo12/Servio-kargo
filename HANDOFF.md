# HANDOFF — 2026-08-16 (uchinchi sessiya)

Bu fayl bitta sessiyaning yakuni. Uzoq muddatli manbalar o'zgarmaydi:
**SPEC.md** — xulq shartnomasi, **tasks.md** — ish ro'yxati,
**docs/DECISIONS.md** — qarorlar. Ziddiyat bo'lsa, o'sha uchtasi ustun.

Oldingi sessiyalar yakuni git tarixida: `ae4f285` (H, I, K, L), `daff29a` (M).

---

## 1. Nima qilindi

**J epiki (SaaS boshqaruv) to'liq qurildi** — D-001 tartibi bilan:
qaror raundi (egasi) → DECISIONS → SPEC → kod → DoD.

| Commit | Nima |
|---|---|
| `5bf7aa5` | D-011 + SPEC 5.17/6/7.19 (koddan oldin) |
| `096d65e` | J1–J2: `tenants.active` + `paid_until`, qulf ekrani, banner, /sa |
| `8bdf3e8` | Ko'rib chiqishdagi uchta nomuvofiqlik tuzatildi |

Testlar: **463** (shared, +16) + **44** (bot) + **46** (web) — hammasi yashil,
typecheck va lint ham. Migratsiya **0023 additive**, toza Postgres 16 da
`0000→0023` o'tdi.

**Bu bilan F–M blokining HAMMASI tugadi** (F→G→H→I→K→L→M→J). D-002 bo'yicha
endi P1 pilot ochiq — lekin avval push + deploy kerak.

**Hech narsa push qilinmadi.** Lokalda **24 commit** va **10 migratsiya**
(0014–0023) push kutmoqda (push = avtodeploy, oynani egasi tanlaydi).

---

## 2. Egasi qabul qilgan qarorlar (D-011)

To'liq matn: `docs/DECISIONS.md`. To'rtta savol:

1. **Bot jim qolmaydi — javob beradi.** O'chirilgan tenant'ning boti har
   update'ga "vaqtincha ishlamayapti, kargo bilan bog'laning" deydi.
   Webhook o'chirilmaydi. *Rad etilgan:* `deleteWebhook`.
2. **Panel: login ishlaydi, faqat qulf ekrani.** *Rad etilgan:* faqat o'qish
   rejimi; loginni butunlay bloklash.
3. **Grace 7 kun, keyin avto-o'chirish** (soatlik sweep). *Rad etilgan:*
   qo'lda ro'yxat.
4. **Ogohlantirish — faqat panel banner** (tavsiya bot xabari edi).
   *Rad etilgan:* bot xabari; hamma xodimga yuborish.

**4-bandning halol narxi (D-011 da ochiq yozilgan):** banner + avto-o'chirish
= panelga kirmagan owner **ogohlantirishsiz** o'chib qolishi mumkin. Egasining
javobi buzilmadi (kargoga hech nima yuborilmaydi), ogohlantirish PLATFORMA
egasiga boradi: **/sa'da "Muddati tugayapti" ro'yxati**.

**Yon foyda:** banner — hisoblanadigan holat, yuborilgan hodisa emas, shuning
uchun sent-stamp ustuni ham, yangi `message_log` kind ham kerak bo'lmadi.

---

## 3. Qaysi fayllar va nega

- **`packages/shared/services/billing.ts`** (yangi) — `billingState` va
  `billingCutoffDate`: sof funksiyalar, Tashkent kalendar kuni bo'yicha
  (dashboard bilan bir manba). Holatlar `none|ok|due-soon|grace|expired`.
  16 test — J ning yagona testlanadigan yadrosi. **`paid_until = NULL` = billing
  qo'yilmagan** (mavjud tenantlar deploy'da o'chib qolmasligi uchun shart).
- **`packages/db/schema.ts` + 0023** — `tenants.active` (NOT NULL default
  true) + `paid_until` (date, nullable). Ikkalasi ham additive.
- **To'rtta choke point, sahifama-sahifa emas:**
  - `apps/web/lib/auth.ts` — `requireAdmin()` → `/locked`; `authorize()`
    esa **so'z bilan** rad etadi (Server Action — POST, qoida 9).
    `requireAdmin({allowInactive:true})` faqat qulf ekrani uchun.
  - `apps/web/lib/twa/auth.ts` — yangi `disabled` holati (plan tekshiruvidan
    OLDIN); `/api/twa/auth` yangi sessiya bermaydi.
  - `apps/bot/src/bot.ts` — til aniqlangandan KEYIN tekshiriladi, ya'ni
    javob mijozning tilida; tugma bosilsa toast (yangi xabar emas).
  - `apps/bot/src/worker.ts` — `tenantSends()` notify/reminder/broadcast/
    ticket'ning to'rttasida ham; `message_log`ka hech nima yozilmaydi
    (yuborilmagan xabar — yetkazish natijasi emas).
- **`apps/bot/src/worker.ts` sweep** — `disableExpiredTenants` eng BOSHIDA
  (o'chayotgan tenant'ga hafta eslatmalari navbatga qo'yilmasin), keyin
  `if (!tenant.active) continue`.
- **`app/(panel)/locked/page.tsx`** — owner to'lov sanasi va aloqani ko'radi,
  xodim faqat "kompaniya o'chirilgan". Yagona ishlaydigan tugma — chiqish.
- **`components/layout/billing-banner.tsx`** — **faqat owner'ga** (D-011:
  C variant aynan "ichki pul masalasi jamoaga ochiladi" uchun rad etilgan).
- **`app/(panel)/sa/*`** — `Holat` va `To'lov muddati` ustunlari,
  o'chirish/yoqish (o'chirish ikki bosqichli, nima to'xtashini aytadi),
  tepada "Muddati tugayapti" ro'yxati.

---

## 4. Hozir nima ishlamayapti / ochiq muammolar

1. **Hech narsa prod'da yo'q.** 24 commit, 10 migratsiya push kutmoqda.
2. **0016 destruktiv** — eski kod o'qiydigan `tracks.photo_path` ni DROP
   qiladi. Migratsiya bilan konteyner restarti orasida eski kod 500 beradi:
   tinch soatda deploy, restart darhol. (0019–0023 additive.)
3. **F3 switchover** — deploy'dan keyin HAR tenant'da /sa'dagi "Webhook"
   tugmasi bosilishi kerak. **F3-b** (eski token-path'ni o'chirish) ochiq.
4. **Import xabarlari ~1 daqiqa kechikadi** (M/D-010 ning ataylab narxi) —
   xato emas.
5. **Test infratuzilmasi chegarasi (ongli, o'zgarmadi):** DB-backed test ham,
   React komponent testi ham yo'q. J da ham shunday: sof qoidalar (16 test)
   testlangan, choke point'lar va UI testsiz. Sweep'ning SQL chegarasi
   (oxirgi grace kuni tegilmaydi, undan keyingisi o'chadi, `NULL` tegilmaydi,
   parametr `date` deb aniqlanadi) toza Postgres 16 da `PREPARE` bilan
   alohida tekshirildi.
6. **Qo'lda tekshirilmagan oqimlar** (qurilma kerak): QR skan va /weigh
   skaneri — real Android; TWA ekranlari — real Telegram; pg-boss
   `startAfter` (K va M uchun).
7. **Windows'da `next build` ishonchsiz** — yagona hakam Docker/CI build.
8. **J o'chirilgan tenant boti har update'ga javob beradi** — F2 limiter
   (25/min per chat) bilan cheklangan va `help_fallback` bilan bir xil xulq.
   Yangi risk emas, lekin bilib turing.

---

## 5. Keyingi qadamlar (tartib bilan)

1. **Push va deploy (egasi).** Tinch soat: push → CI yashil → deploy →
   konteyner restarti darhol → /sa'da har tenant uchun "Webhook" → 0016
   tufayli bitta trekda fotolarni ochib ko'rish.
2. **Deploy'dan keyin qo'lda tekshirish** (har epic ostida tasks.md'da
   batafsil): **H** (murojaat oqimi, ko'p foto), **I** (o'lchamli tortish),
   **K** (test yuborish, 60s ichida bekor), **L** (🪪, /card, QR),
   **M** (xato fayl → bekor qilish → muammoli qatorlar xlsx'i),
   **J** (o'chirish → bot javobi → `/locked` → qayta yoqish →
   `paid_until` 3 kun keyinga = amber banner → kechagi sana = qizil).
3. **P1 pilot** — F–M tugadi, D-002 bo'yicha pilot endi ochiq. Birinchi
   qadam: pilot kargo tanlash va onboarding (5 daqiqa da'vosini sinash).
4. **Ochiq qolganlar:** F3-b (eski webhook path'i), C-0 (onlayn to'lov
   shakli — P6 javobiga bog'liq), P blokidagi pilot vazifalari.

---

## 6. Kerakli buyruqlar

```bash
# DoD gate (har task uchun majburiy)
pnpm typecheck && pnpm lint && pnpm test

# Bitta paketni tez tekshirish
pnpm --filter @kargotrack/shared test
pnpm --filter @kargotrack/web typecheck

# Bitta test fayli
cd packages/shared && pnpm vitest run src/services/billing.test.ts

# Migratsiya yaratish (schema.ts o'zgargach) — REPO ILDIZIDAN
pnpm db:generate

# Migratsiyani TOZA bazada tekshirish (bir martalik konteyner)
docker run -d --rm --name kt-test -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=kargotrack -p 55433:5432 postgres:16-alpine
DATABASE_URL="postgres://postgres:test@localhost:55433/kargotrack" \
  pnpm --filter @kargotrack/db db:migrate
docker exec kt-test psql -U postgres -d kargotrack -c "\d tenants"
docker stop kt-test
# Eslatma (Windows/Git Bash): psql'ga fayl bersangiz yo'l buziladi —
# `docker exec -i kt-test psql … < fayl.sql` shaklida bering.
# Drizzle parametrni tipsiz yuboradi, ya'ni `PREPARE … $1` bilan sinash
# haqiqiy yo'lni takrorlaydi (`::text` cast qilsangiz — yo'q).

# Lokal ishga tushirish (web :3000, bot :8443)
pnpm dev

# Build — Windows'da ishonmang, Docker/CI hakam (yuqoridagi 7-band)
```

Push = avtodeploy: `git push` dan keyin GitHub Actions verify → GHCR image →
VPS deploy. Deploy mantig'i `deploy.sh` da, workflow YAML'da emas.
