# TASKS — SERVIO Kargo v2 ish rejasi

Yagona ish ro'yxati. Har task CLAUDE.md'dagi Definition of Done'ga bo'ysunadi
(typecheck + lint + test yashil; migratsiyalar toza bazada o'tadi; happy path
qo'lda tekshirilgan; barcha matnlar uz + ru). AUDIT.md — tarixiy audit hujjati;
yangi ish FAQAT shu faylda rejalashtiriladi, AUDIT'ga faqat yakun belgilanadi.

Statuslar: `[ ]` ochiq · `[~]` jarayonda · `[x]` tayyor.

Qabul qilingan yo'nalish (2026-08, egasi bilan kelishilgan):
SaaS asos + **premium tier** (`tenants.plan`, gating faqat `planIncludes` —
`packages/shared/src/services/plans.ts`). Tartib: Mini App → Click to'lovi →
bonus/referral → viloyat yetkazish. Taobao buyout — rejadan tashqarida.
Jonli sinov: VPS'dagi test tenant orqali (push oldidan egasi bilan kelishiladi
— **push = avtodeploy!**).

---

## 0-bosqich — Poydevor ✅ (2026-08-10, commitlar 1b0d490…032700d)

- [x] CI'da `pnpm test` gate
- [x] docker-compose: web `PORT=3000` pin (bot 8443 bilan to'qnashuv)
- [x] Login/invite//sa throttle — `auth_throttle` + `shared/services/throttle.ts` (T9)
- [x] Bot sessiyalari Postgresda — `bot_sessions` + 30 kun TTL sweep (T16)
- [x] `message_log` — worker yakuniy natijani yozadi; mijoz sahifasida bo'lim (T13 yadrosi)
- [x] `tenants.plan` + `planIncludes` + /sa boshqaruvi

---

## A — Texnik qarz va qoldiqlar

1-bosqich bilan parallel yoki orasida bajariladi; hech biri Mini App'ni
bloklamaydi, lekin A1–A3 pilotgacha yopilishi shart.

- [ ] **A1 · Uploads zaxira** — S3'gacha vaqtinchalik: `deploy.sh`/docs'ga
      `/data/uploads` uchun kunlik rsync/tar cron + tiklash protsedurasi
      hujjati. (To'liq yechim: B8 storage abstraksiyasi.)
- [ ] **A2 · Owner parolini tiklash yo'li** — /sa'da tenant owner'iga yangi
      invite-kod berish tugmasi (mavjud invite oqimini qayta ishlatadi,
      yangi mexanizm yozilmaydi).
- [ ] **A3 · T13 qoldig'i** — trek detalida "Xabarlar" bo'limi; mijoz
      kartasida "🚫 botni bloklagan" belgisi (oxirgi notify dropped bo'lsa);
      dashboardda "yetmagan xabarlar: N".
- [ ] **A4 · T10** — "filtrga mos {N} tani tanlash": bulk action `trackIds`
      emas filtr qabul qiladi, tasdiq modalida aniq son.
- [ ] **A5 · T18** — trek detalidan foto yuklash/o'chirish (bot bilan bir xil
      qoida: JPEG, 10 MB). B8'dan keyin qilinsa arzonroq.
- [ ] **A6 · Mijozni tahrirlash UI** — ism/telefon; `phone_normalized` qayta
      hisoblanadi.
- [ ] **A7 · To'lovni bekor qilish** — storno yozuv (append-only, o'chirish
      emas), sabab bilan; audit izi saqlanadi.
- [ ] **A8 · T14** — bulk undo (60 s ichida) + `/tracks?deleted=1` savat.
      Katta ish, alohida rejalashtiriladi.

---

## B — 1-bosqich: Telegram Mini App kabinet (premium)

### Arxitektura qarorlari (kod yozishdan oldin o'qilsin)

- **Joylashuv:** yangi app YO'Q — `apps/web` ichida `app/(miniapp)/m/[tenantId]/`
  route-guruhi. `lib/queries/*` tenant-scoped qatlami qayta ishlatiladi;
  Mini App uchun alohida query fayllar `lib/queries/twa-*.ts` (mijoz-sessiya
  scoped: har so'rov tenant_id + customer_id bilan).
- **Autentifikatsiya:** Telegram `initData` HMAC-SHA256 tekshiruvi
  (`apps/web/lib/twa-auth.ts`, ~50 qator, tashqi kutubxonasiz — Node crypto).
  Tenant path'dan olinadi, imzo O'SHA tenant'ning `bot_token`i bilan
  tekshiriladi (`auth_date` eskirishi ≤ 1 soat). Muvaffaqiyatdan keyin
  qisqa muddatli imzolangan cookie (mavjud `lib/session.ts` uslubida,
  alohida TWA cookie nomi) — har so'rovda qayta HMAC qilinmaydi.
  Vitest: Telegram hujjatidagi test-vektorlar bilan.
- **Premium gate:** har TWA route/action boshida `planIncludes(tenant.plan,
  'miniapp')` — bo'lmasa "bu funksiya ulanmagan" ekrani (ikki tilda).
- **Frontend kutubxonasi:** YO'Q (ongli qaror). Rasmiy
  `telegram-web-app.js` script tegi + o'zimizning tor typed wrapper
  (`apps/web/lib/twa-client.ts`: initData, theme params, BackButton,
  MainButton, haptic). `@telegram-apps/sdk` olinmaydi — kerak bo'lgan yuza
  kichik, dependensiya xarajati oqlanmaydi. UI — mavjud Tailwind kit,
  mobile-first, Telegram theme o'zgaruvchilariga mos (dark/light).
- **i18n:** mijozning `customers.lang`i; matnlar `apps/web/messages/*.json`
  ("twa" namespace), domen lug'ati (status nomlari) `packages/shared`dan —
  CLAUDE.md qoida 5 buzilmaydi.
- **Fotolar:** mavjud photo route naqshida, lekin TWA-sessiya bilan
  (mijoz FAQAT o'z tregining fotosini ko'radi).

### Tasklar

- [ ] **B1 · TWA auth poydevori** — `twa-auth.ts` (HMAC + test-vektorlar),
      TWA cookie sessiya, `requireTwaCustomer(tenantId)` guard,
      premium-gate ekrani.
- [ ] **B2 · Skeleton + kirish** — `/m/[tenantId]` layout (theme, til),
      ro'yxatdan o'tmagan tg-user uchun: telefon so'rash o'rniga botga
      yo'naltirish ("botda /start bosing") — registratsiya oqimi BITTA
      joyda qoladi (botda).
- [ ] **B3 · Treklar ro'yxati** — status bo'yicha guruhlangan, foto-miniatura,
      kg/narx, pagination; trek detali: timeline, foto, reys ETA.
- [ ] **B4 · Moliya ekrani** — qarz/avans (`computeDebtTiyin` — o'sha bitta
      servis), to'lovlar tarixi, "to'lash" tugmasi joyi (C-bosqichga stub).
- [ ] **B5 · Kalkulyator + Xitoy manzili** — mavjud tarif/kurs mantig'i,
      manzil `{client_code}` bilan, bir bosishda nusxalash.
- [ ] **B6 · Ochiq trek-qidiruv** — `/m/[tenantId]/lookup`: registratsiyasiz,
      faqat holat + sana (narx/egasi YO'Q), throttle bilan (mavjud
      `auth_throttle` naqshi, `lookup:` scope).
- [ ] **B7 · Bot tomonи** — har tenant botiga `setChatMenuButton` (web_app
      URL) — /sa onboarding + mavjud tenantlar uchun /sa tugmasi;
      bot menyusida "📱 Kabinet" tugmasi (premium tenantlarda), uz/ru.
- [ ] **B8 · Storage abstraksiyasi** — `apps/web/lib/storage.ts` +
      `apps/bot/src/storage.ts` o'rniga BITTA modul `packages/db`ga emas,
      yangi `packages/storage` (local-disk driver hozir, S3 driver
      `@aws-sdk/client-s3` bilan — yagona qo'shiladigan og'ir dependensiya;
      MinIO/R2 mos). `UPLOADS_DRIVER=local|s3` env bilan tanlanadi.
      Bot yozadi, web o'qiydi — interfeys ikkalasiga bitta.
- [ ] **B9 · Jonli sinov VPS test tenant'da** — chek-ro'yxat: /start →
      kabinet ochish → treklar → foto → moliya → ochiq qidiruv → til
      almashtirish → basic tenant'da gate ekrani. Push OLDIN egasi bilan
      kelishiladi.

**DoD qo'shimchasi:** SPEC.md'ga yangi "§10 Mini App" bo'limi yoziladi
(oqimlar + ekranlar) — SPEC kontrakt bo'lib qolishi kerak.

---

## C — 2-bosqich: Click to'lovi (premium)

Muhim prinsip: pul HAR DOIM tenant'ning O'Z merchant hisobiga tushadi —
platforma hech qachon o'zganing pulini yig'maydi. Payme — Click'dan keyingi
iteratsiya (o'sha interfeys, ikkinchi driver).

- [ ] **C1 · Merchant sozlamalari** — tenant settings'da Click service_id/
      merchant_id/secret (DBda shifrlangan: `SESSION_SECRET`dan olingan
      kalit bilan AES-GCM — alohida KMS YO'Q, VPS doirasida yetarli, hujjatda
      halol yozib qo'yiladi); /settings'da "To'lovlar" kartasi (owner only).
- [ ] **C2 · Invoys oqimi** — TWA moliya ekranida "To'lash" → summa (qarz
      default, qisman ham mumkin) → Click checkout URL (Prepare/Complete
      callback'lar bilan) — `app/api/pay/click/route.ts`, tenant'ni
      callback parametrlaridan aniqlash + imzo tekshirish.
- [ ] **C3 · Yakun** — muvaffaqiyatli callback: `payments` yozuvi
      (method='click', created_by=null — bu onlayn to'lov), botda kvitansiya
      xabari, TWA'da yangilangan balans. Idempotentlik: bitta click
      transaction_id ikki marta yozilmaydi (unique index).
- [ ] **C4 · Testlar** — imzo tekshiruvi, idempotentlik, qisman to'lov,
      valyuta USD tenant (som hisobida to'lanadi — SPEC 7.4 qoidasi).

---

## D — 3-bosqich: Bonus / referral (premium)

Bozorda deyarli yo'q — tenant'larga sotuv argumenti. Pul qoidasi bilan bir
xil intizom: balans hech qachon ustidan yozilmaydi.

- [ ] **D1 · Ledger** — `bonus_events` (append-only: earn/spend/adjust,
      amount_tiyin, sabab, track_id?/payment_id?, created_by); balans =
      SUM — servis funksiya + testlar (debt.ts naqshi).
- [ ] **D2 · Qoidalar** — tenant settings: kg-bonus (har kg uchun N so'm),
      referral mukofoti (taklif qilgan + kelgan mijozga), yoqish/o'chirish.
      DELIVERED bo'lganda earn yoziladi (statusChange service kengayadi).
- [ ] **D3 · Referral havola** — bot deep-link `t.me/bot?start=ref_<code>`;
      /start'da bog'lash (o'z-o'zini taklif qilish bloklanadi); TWA'da
      "do'stni taklif qil" ekrani + ulashish tugmasi.
- [ ] **D4 · Sarflash** — to'lovda bonusdan chegirma (naqd: admin panelda,
      onlayn: TWA'da) — spend yozuvi to'lov bilan bitta tranzaksiyada.
- [ ] **D5 · Panel** — mijoz sahifasida bonus balansi + tarix; dashboard'da
      berilgan/sarflangan bonus (owner).

---

## E — 4-bosqich: Viloyat yetkazish (minimal, premium)

Operatsion og'irlik tenant'da qoladi — biz faqat oqimni raqamlashtiramiz.

- [ ] **E1 · `delivery_requests`** — track_id(lar), manzil/punkt, telefon,
      status (requested → accepted → shipped → delivered), narx (tenant
      qo'lda kiritadi), carrier trek-kodi.
- [ ] **E2 · TWA oqimi** — READY_FOR_PICKUP trekda "yetkazib berilsin" →
      manzil formasi → so'rov.
- [ ] **E3 · Panel worklist** — yangi so'rovlar ro'yxati, qabul/rad,
      narx + carrier kod kiritish → mijozga xabar (message_log orqali).

---

## Kutubxonalar siyosati

Qo'shiladi (faqat shu ikkitasi rejalashtirilgan):

| Kutubxona | Qachon | Nima uchun |
|---|---|---|
| `@aws-sdk/client-s3` | B8 | S3-compatible storage driver (MinIO/R2 ham) |
| — Click uchun SDK YO'Q | C | oddiy HTTPS + imzo; `fetch` yetadi |

Ataylab olinmaydi: `@telegram-apps/sdk` (yuza kichik — o'z wrapper),
`@grammyjs/storage-*` (o'z adapter yozildi, 0-bosqich), Redis (pg-boss bor),
alohida KMS (C1'da AES-GCM + hujjat). Yangi dependensiya = alohida asoslash.
