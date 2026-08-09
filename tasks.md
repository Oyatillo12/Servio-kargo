# TASKS — SERVIO Kargo v2 ish rejasi

Yagona ish ro'yxati. Har task CLAUDE.md'dagi Definition of Done'ga bo'ysunadi
(typecheck + lint + test yashil; migratsiyalar toza bazada o'tadi; happy path
qo'lda tekshirilgan; barcha matnlar uz + ru). AUDIT.md — tarixiy audit hujjati;
yangi ish FAQAT shu faylda rejalashtiriladi, AUDIT'ga faqat yakun belgilanadi.

Statuslar: `[ ]` ochiq · `[~]` jarayonda · `[x]` tayyor.

Yo'nalish (2026-08, egasi bilan kelishilgan): SaaS asos + **premium tier**
(`tenants.plan`, gating faqat `planIncludes`). Taobao buyout — rejadan
tashqarida. **push = avtodeploy!**

**Tartib prinsipi (2026-08-10 qayta ko'rib chiqildi):** mahsulot mijoz
tomonidan bozor darajasiga chiqdi (bot + kabinet). Endi navbat KOD emas —
**birinchi real pilot tenant va uning fikri**. Yangi quyi tizim (to'lov,
bonus, yetkazish) faqat real tenant so'rovi tasdiqlagach quriladi; ungacha
faqat operatsion og'riqlar va ma'lumot xavfsizligi yopiladi. Isbotlanmagan
talabga kod yozish = eng qimmat overengineering.

---

## P — HOZIRGI USTUVORLIK: pilot va operatsion og'riqlar

Tartib bo'yicha bajariladi. P1–P2 kod emas, lekin ro'yxatda turadi, chunki
ular hamma koddan muhimroq.

- [ ] **P1 · Pilot tenant** (egasi) — bitta real kargo kompaniyasini tizimga
      o'tkazish va 2 hafta kundalik ishlatish. Har shikoyat/so'rov shu faylga
      task bo'lib tushadi va navbatni o'zgartiradi.
- [ ] **P2 · Demo video** (egasi) — landing'dagi `DEMO_VIDEO` sloti hali
      bo'sh (`features/marketing/config.ts`). Kabinet chiqqani bilan demo
      kuchaydi — ekran yozuvi + ovoz, tayyor brif artifact'larda bor.
- [ ] **P3 · Uploads zaxira (A1)** — `/data/uploads` uchun kunlik tar/rsync
      cron + tiklash protsedurasi hujjati (docs/DEPLOY.md). Ma'lumot
      yo'qolishi — bitta haqiqiy ekzistensial xavf. S3 EMAS — pastdagi
      "Keyinga qoldirilgan"ga qarang.
- [ ] **P4 · Owner parolini tiklash (A2)** — /sa'da tenant owner'iga yangi
      invite-kod berish tugmasi (mavjud invite oqimini qayta ishlatadi).
      Pilotdagi birinchi support-qo'ng'iroq shu bo'ladi.
- [ ] **P5 · "Filtrga mos hammasini tanlash" (T10)** — bulk action
      `trackIds` emas filtr qabul qiladi, tasdiq modalida aniq son.
      500 trekli tenant uchun har kungi og'riq — bonus tizimidan muhim.
- [ ] **P6 · To'lov odati validatsiyasi** (egasi + men) — pilot tenant'dan
      so'raladi: mijozlar qanday to'laydi? (a) Click/Payme merchant hisobi
      bormi, (b) yoki shaxsiy kartaga o'tkazma olamimi? Javob C-bosqichning
      SHAKLINI belgilaydi (quyida) — bu javobsiz C boshlanmaydi.
- [ ] **P7 · Attributsiya modeli validatsiyasi** (egasi + men) — pilot
      tenant qanday ishlaydi: **trek-kod-first** (har posilka kod bilan
      yuritiladi — hozirgi model) yoki **marka-first** (kodga qaralmaydi,
      client_code + vazn yetadi)? Marka-first bo'lsa, import/attributsiya
      oqimi ustuvorlashadi, bot'dagi "trek qo'shish" ikkinchi darajaga
      tushadi. Shu bilan birga: Xitoy omboridan bizning domen VPNsiz
      ochilishini xodim telefonida tekshirish (W uchun shart).

---

## W — Ombor "Tarozi rejimi" (panel ichida, alohida ilova EMAS)

Qaror (2026-08-10, egasi bilan kelishildi): staff ishi uchun ALOHIDA
panel/ilova qurilmaydi — mavjud panelda `warehouse` roli uchun to'liq
ekranli ish-rejimi. Sabab: **Telegram Xitoyda bloklangan** — bot
staff-rejimi aynan asosiy joyda (Guangzhou/Yiwu qabul posti) VPN'ga
qaram; oddiy web-sahifa esa ochiladi. Auth/permissions/i18n/deploy —
hammasi tayyor infratuzilmada. Bot staff-rejimi zaxira kanal bo'lib
qoladi. Asosiy foydalanuvchi: Xitoy ombori; til: uz/ru (xitoycha —
faqat pilot so'rasa); kirish: mavjud telefon+parol, 30 kunlik cookie.

- [ ] **W1 · `/weigh` ekrani** — panel ichida, app-shell minimal (to'liq
      ekran, katta touch-maydonlar, telefonga mo'ljallangan). Oqim:
      kod-maydon (avtofokus, USB-skaner klaviatura kabi yozadi) → vazn →
      ixtiyoriy marka (client_code) → Enter → keyingisi. Yonida bugungi
      kiritilganlar ro'yxati (kod, kg, narx, ega belgisi) — xato darhol
      ko'rinadi.
- [ ] **W2 · Server tomoni** — bot'dagi `applyStaffWeighing` bilan BITTA
      shared qoidalar: vazn+narx, CREATED→CHINA_WAREHOUSE event + notify,
      noma'lum kod → egasiz trek. YANGI: marka berilsa va client_code
      topilsa — darhol biriktirish (topilmasa egasiz, xato EMAS).
- [ ] **W3 · Kamera-skan** — Android Chrome'dagi native `BarcodeDetector`
      API bilan (dependensiyasiz); qurilma qo'llamasa tugma ko'rinmaydi,
      qo'lda/USB ishlashda davom etadi. Tashqi kutubxona — faqat pilot
      telefonlari qo'llamasa (trigger).
- [ ] **W4 · Foto** — shu ekrandan kamera bilan (`capture` input, JPEG,
      10 MB — bot bilan bir xil qoida). Bu A5/T18'ning asosiy qismini
      yopadi; trek detalidagi foto boshqaruvi A5'da qoladi.
- [ ] **W5 · Bot paritet** — bot staff-rejimi parseri `KOD VAZN MARKA`
      formatini ham qabul qiladi (zaxira kanal ham biriktira olsin);
      W2 bilan bitta shared parser.

---

## A — Texnik qarz (keyingi navbat, pilot fikri bilan tartiblanadi)

- [ ] **A3 · T13 qoldig'i** — trek detalida "Xabarlar" bo'limi; mijoz
      kartasida "🚫 botni bloklagan" belgisi (oxirgi notify dropped bo'lsa);
      dashboardda "yetmagan xabarlar: N".
- [ ] **A5 · T18** — trek detalidan foto yuklash/o'chirish (bot bilan bir
      xil qoida: JPEG, 10 MB). Asosiy ehtiyojni W4 yopadi; bu faqat
      ofisdan tuzatish uchun.
- [ ] **A6 · Mijozni tahrirlash UI** — ism/telefon; `phone_normalized`
      qayta hisoblanadi.
- [ ] **A7 · To'lovni bekor qilish** — storno yozuv (append-only, o'chirish
      emas), sabab bilan; audit izi saqlanadi.

---

## C — Onlayn to'lov (premium) — SHAKLI P6 javobiga bog'liq

Muhim prinsip: pul HAR DOIM tenant'ning O'Z hisobiga tushadi — platforma
hech qachon o'zganing pulini yig'maydi.

**C-0 · Shakl tanlovi (P6 dan keyin):**
- Tenant'da merchant hisobi BOR → **C-full**: Click integratsiyasi (quyida),
  Payme keyingi iteratsiya (o'sha interfeys, ikkinchi driver).
- Tenant shaxsiy kartaga o'tkazma oladi (kichik kargolarda keng tarqalgan) →
  **C-lite**: kabinet moliya ekranida tenant karta raqami + summa +
  "to'ladim" tugmasi → panelda tasdiqlash worklist'i → tasdiqlangach
  `payments` yozuvi + kvitansiya. Merchant shartnomasiz ishlaydi; C-full
  keyin ustiga qo'shiladi.

**C-full tasklari (faqat C-0 shuni tanlasa):**

- [ ] **C1 · Merchant sozlamalari** — tenant settings'da Click service_id/
      merchant_id/secret (DBda AES-GCM, kalit `SESSION_SECRET`dan — alohida
      KMS YO'Q, hujjatda halol yozib qo'yiladi); /settings'da "To'lovlar"
      kartasi (owner only).
- [ ] **C2 · Invoys oqimi** — TWA moliya ekranida "To'lash" → summa (qarz
      default, qisman mumkin) → Click checkout (Prepare/Complete callback) —
      `app/api/pay/click/route.ts`, imzo tekshirish.
- [ ] **C3 · Yakun** — callback: `payments` yozuvi (method='click',
      created_by=null), botda kvitansiya, TWA'da yangi balans.
      Idempotentlik: click transaction_id unique index.
- [ ] **C4 · Testlar** — imzo, idempotentlik, qisman to'lov, USD tenant
      (som hisobida to'lanadi — SPEC 7.4).

---

## D — Referral (premium) — QISQARTIRILDI

2026-08-10 qarori: to'liq bonus/cashback ledger **qurilmaydi** — bozorda
yo'qligi talab yo'qligining belgisi bo'lishi mumkin; isbotlanmagan talabga
append-only ledger + sarflash oqimi = overengineering. Qoladigani faqat
arzon va viral qismi:

- [ ] **D3 · Referral havola** — bot deep-link `t.me/bot?start=ref_<code>`;
      /start'da bog'lash (o'z-o'zini taklif bloklanadi); TWA'da "do'stni
      taklif qil" + ulashish tugmasi; panelda "kim kimni olib keldi" hisobi.
      Mukofot — hozircha shunchaki HISOBLAB KO'RSATILADI (tenant qo'lda
      chegirma qiladi); avtomatik bonus-balans YO'Q.

Cashback/kg-bonus ledger → "Keyinga qoldirilgan" (tenant so'rasagina).

---

## Bajarilgan bosqichlar

### 0-bosqich — Poydevor ✅ (2026-08-10)

- [x] CI'da `pnpm test` gate
- [x] docker-compose: web `PORT=3000` pin (bot 8443 bilan to'qnashuv)
- [x] Login/invite//sa throttle — `auth_throttle` + `shared/services/throttle.ts` (T9)
- [x] Bot sessiyalari Postgresda — `bot_sessions` + 30 kun TTL sweep (T16)
- [x] `message_log` — worker yakuniy natijani yozadi; mijoz sahifasida bo'lim (T13 yadrosi)
- [x] `tenants.plan` + `planIncludes` + /sa boshqaruvi

### B — Mini App kabinet ✅ (2026-08-10, prod'da ishlayapti)

Arxitektura qarorlari (kod o'zgartirishdan oldin o'qilsin): `apps/web`
ichida `(miniapp)/m/[tenantId]` route-guruhi; `initData` HMAC tekshiruvi
o'sha tenant bot tokeni bilan (SDKsiz, `lib/twa/init-data.ts`); TWA cookie
admin cookie'dan domain-ajratilgan (`lib/twa/session.ts`); har ekran
`planIncludes('miniapp')` ortida; til `customers.lang`dan (panel cookie
EMAS); frontend — rasmiy `telegram-web-app.js` + tor typed wrapper,
`@telegram-apps/sdk` olinmagan; SPEC §10 — kontrakt.

- [x] **B1** auth poydevori (HMAC + test-vektorlar, guard, gate ekrani)
- [x] **B2** skeleton + kirish (registratsiya botda qoladi)
- [x] **B3** treklar ro'yxati + detal (timeline, egalik-himoyali foto route)
- [x] **B4** moliya (o'sha bitta `computeDebtTiyin`; "to'lash" joyi C ga)
- [x] **B5** kalkulyator + Xitoy manzili (bot bilan bir xil shared hisob)
- [x] **B6** ochiq trek-qidiruv (faqat holat+sana, IP-throttle)
- [x] **B7** setChatMenuButton hayot sikli + klaviaturada "📱 Kabinet"
- [x] **B9** jonli sinov — 2026-08-10 push/deploy, egasi prod'da tasdiqladi

---

## Keyinga qoldirilgan (ongli YAGNI — trigger yozilgan)

| Nima | Trigger (shunda qilinadi) |
|---|---|
| **B8 · S3 storage abstraksiyasi** (`packages/storage`, `@aws-sdk/client-s3`) | Ikkinchi server kerak bo'lganda YOKI disk siqilganda. Ungacha P3 backup xavfni yopadi. |
| **Cashback / kg-bonus ledger** (sobiq D1–D2, D4–D5) | Kamida bitta to'lovchi tenant o'zi so'raganda. |
| **E · Viloyat yetkazish** (delivery_requests + TWA oqimi + worklist) | Pilot tenant mijozlari so'rayotganini aytganda. Minimal shakl saqlanadi: so'rov → admin qo'lda jo'natadi. |
| **A8 · T14 bulk undo + savat** | Pilotda xato-bulk real sodir bo'lganda; katta ish, alohida dizayn. |
| **Payme drayveri** | C-full ishlagach, tenant so'rovi bilan. |

---

## Kutubxonalar siyosati

Hozir qo'shiladigan YANGI kutubxona YO'Q. `@aws-sdk/client-s3` — faqat B8
triggeri otilganda. Click uchun SDK olinmaydi (oddiy HTTPS + imzo, `fetch`
yetadi). Shtrix-kod skan (W3) — native `BarcodeDetector` API, kutubxonasiz;
tashqi lib faqat pilot telefonlari qo'llamasa. Ataylab olinmaydi:
`@telegram-apps/sdk` (o'z wrapper bor), `@grammyjs/storage-*` (o'z adapter
yozildi), Redis (pg-boss bor), alohida KMS (AES-GCM + hujjat). Yangi
dependensiya = alohida asoslash.
