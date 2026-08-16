# TASKS — SERVIO Kargo v2 ish rejasi

Yagona ish ro'yxati. Har task CLAUDE.md'dagi Definition of Done'ga bo'ysunadi
(typecheck + lint + test yashil; migratsiyalar toza bazada o'tadi; happy path
qo'lda tekshirilgan; barcha matnlar uz + ru). AUDIT.md — tarixiy audit hujjati;
yangi ish FAQAT shu faylda rejalashtiriladi, AUDIT'ga faqat yakun belgilanadi.

Statuslar: `[ ]` ochiq · `[~]` jarayonda · `[x]` tayyor.

Yo'nalish (2026-08, egasi bilan kelishilgan): SaaS asos + **premium tier**
(`tenants.plan`, gating faqat `planIncludes`). Taobao buyout — rejadan
tashqarida. **push = avtodeploy!**

**Ish tartibi (2026-08-15, D-001):** har epic
Research → Analysis → Decision (docs/DECISIONS.md) → SPEC.md (koddan
OLDIN) → Tasks (shu fayl) → Implementation (DoD) → Validation
bosqichlaridan o'tadi. Muhim qaror — egasi bilan. Spec'siz va
DECISIONS yozuvisiz epic boshlanmaydi.

**Tartib prinsipi (2026-08-15 qayta ko'rib chiqildi, D-002):** 2026-08-10
dagi "birinchi pilot, keyin kod" prinsipi egasi qarori bilan almashdi:
2026-08-15 audit topilmalari bo'yicha **F–M epiklari TO'LIQ quriladi,
pilot (P1) shundan keyin boshlanadi**. Riski D-002 da ochiq yozilgan.
Epic tartibi: F → G → H → I → K → L → M → J.

---

## P — Pilot va operatsion og'riqlar (F–M dan KEYIN boshlanadi, D-002)

P1–P2 kod emas, lekin ro'yxatda turadi. P3/P4 F-epic ichiga ko'chdi
(F4/F5). P6/P7 validatsiya savollari pilot boshlanishida beriladi.

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

## W — Ombor "Tarozi rejimi" ✅ (2026-08-10, W1–W5 bajarildi)

Qolgan yagona ochiq nuqta: **P7 dagi VPNsiz tekshiruv** va W3 ni real
Android telefonda sinash — ikkalasi ham pilotda, qurilmada bajariladi.

Qaror (2026-08-10, egasi bilan kelishildi): staff ishi uchun ALOHIDA
panel/ilova qurilmaydi — mavjud panelda `warehouse` roli uchun to'liq
ekranli ish-rejimi. Sabab: **Telegram Xitoyda bloklangan** — bot
staff-rejimi aynan asosiy joyda (Guangzhou/Yiwu qabul posti) VPN'ga
qaram; oddiy web-sahifa esa ochiladi. Auth/permissions/i18n/deploy —
hammasi tayyor infratuzilmada. Bot staff-rejimi zaxira kanal bo'lib
qoladi. Asosiy foydalanuvchi: Xitoy ombori; til: uz/ru (xitoycha —
faqat pilot so'rasa); kirish: mavjud telefon+parol, 30 kunlik cookie.

- [x] **W1 · `/weigh` ekrani** ✅ (2026-08-10) — `app/(panel)/weigh` — `(app)`
      guruhidan TASHQARIDA, shuning uchun sidebar/tab-bar yo'q, faqat bitta
      chiqish havolasi. Oqim: kod (avtofokus; USB-skaner Enter bosadi → vazn
      maydoniga o'tadi, saqlamaydi) → vazn → ixtiyoriy marka → Enter. Marka
      "qulf" tugmasi (bitta mijozning qutilari ketma-ket kelganda) — ushlab
      turilganda maydon ajratib ko'rsatiladi. Yonida bugungi ro'yxat +
      jami (N ta · kg · so'm). `warehouse` roli kirgach shu ekranga tushadi;
      nav'da "Tarozi" (`tracks.weigh` bo'lganlarda), telefon tab-bar'ida
      warehouse uchun birinchi tab. Ro'yxat reload'dan keyin audit log'dan
      tiklanadi (CHINA_WAREHOUSE event'i borlar).
- [x] **W2 · Server tomoni** ✅ (2026-08-10) — `shared/services/weigh.ts`
      `planWeighEntry` — bot ham, panel ham SHU bitta rejalashtiruvchini
      chaqiradi (`apps/bot/src/queries/weighing.ts` refaktor qilindi).
      Marka topilsa va trek EGASIZ bo'lsa — darhol biriktirish + kelish
      xabari; topilmasa xato EMAS; BOSHQA mijozniki bo'lsa — vazn/narx
      yoziladi, ega o'zgartirilmaydi, operator ogohlantiriladi.
      Tarif yo'q / USD kursi yo'q → 0 narx EMAS, aniq rad javob (bot ham).
      **Qo'shimcha:** `warehouse` roliga `tracks.assign` berildi — marka
      qutini ushlab turgan odam o'qiydi (permissions matritsasi + testlar).
- [x] **W3 · Kamera-skan** ✅ (2026-08-10) — `features/weigh/barcode.ts` +
      `scan-sheet.tsx`, native `BarcodeDetector`, kutubxonasiz. Qurilma
      qo'llamasa (yoki HTTPS bo'lmasa) tugma UMUMAN chizilmaydi — USB/qo'lda
      kiritish o'zgarmaydi. Faqat qurilma qo'llaydigan formatlar so'raladi
      (aks holda har kadrda xato), sekundiga ~4 marta dekod (batareya),
      yopilganda kamera treklari to'xtatiladi. **Sinov: Android telefon
      kerak** — Windows Chrome'da API yo'q, shuning uchun bu yerda faqat
      "tugma yo'q" yo'li va format-muzokara testlari tekshirildi.
- [x] **W4 · Foto** ✅ (2026-08-10) — kunlik ro'yxatning har qatorida kamera
      tugmasi (`capture="environment"`, JPEG, 10 MB — bot bilan bir xil
      qoida va bir xil fayl yo'li `{tenantId}/{trackId}.jpg`, ya'ni bitta
      posilkada bitta rasm). `POST /api/tracks/[id]/photo` — Server Action
      EMAS, chunki uning tanasi 1 MB bilan cheklangan. A5/T18 ning asosiy
      qismi shu bilan yopildi.
- [x] **W5 · Bot paritet** ✅ (2026-08-10) — `parseStaffWeighing` endi
      `KOD VAZN MARKA` ni ham o'qiydi (bitta shared parser), bot W2 dagi
      o'sha `planWeighEntry` ni chaqiradi va javobda marka natijasini
      aytadi. `3.2 kg` kabi yozuv marka deb o'qilmaydi: client_code'da
      doim raqam bor — shu bitta qoida har tildagi o'lchov so'zini
      "mijoz" deb tushunishdan saqlaydi.

---

## A — Texnik qarz ✅ (2026-08-15, A3/A5/A6/A7 bajarildi)

- [x] **A3 · T13 qoldig'i** ✅ (2026-08-15) — trek detalida "Xabarlar"
      (`message_log.track_id` bo'yicha, mijoz sahifasi bilan BITTA
      `MessageOutcomesCard` komponenti, yangi `messageLog` i18n ns);
      mijoz kartasida "🚫 botni bloklagan" (oxirgi **notify** `dropped`
      bo'lsa — `failed` emas, u tranzient); dashboardda "Yetmagan
      xabarlar: N" (davr bo'yicha dropped+failed, hamma rollarga —
      bu ops, pul emas).
- [x] **A5 · T18** ✅ (2026-08-15) — trek detalida `PhotoCard`:
      yuklash/almashtirish/o'chirish, o'sha `/api/tracks/[id]/photo`
      (W4) + yangi DELETE handler (`tracks.weigh`, avval DB tozalanadi,
      fayl best-effort o'chadi — teskari tartib singan ramka qoldirardi).
- [x] **A6 · Mijozni tahrirlash UI** ✅ (2026-08-15) — mijoz sahifasida
      qalam → dialog (ism/telefon, `customers.manage`); `phone_normalized`
      qayta hisoblanadi, boshqa mijozning raqami createCustomer'dagi kabi
      rad etiladi (o'zi bundan mustasno). Telefon majburiy — bot shu raqam
      bo'yicha ulaydi (§7.12).
- [x] **A7 · To'lovni bekor qilish** ✅ (2026-08-15) — storno = YANGI
      manfiy `payments` qatori `reversal_of` bilan (migratsiya 0014:
      ustun + partial unique index — ikki marta storno DB darajasida
      taqiqlangan). Qoida `shared/services/paymentReversal.ts`da
      (testlar bilan): storno'ni storno qilib bo'lmaydi, sabab `note`da,
      bekor qilgan `created_by`da. Yangi `payments.cancel` capability —
      owner+manager (egasi qarori 2026-08-15; keyin monitoring bilan
      qattiqlashtirilishi mumkin). Qarz/tushum/kassa hech qanday maxsus
      holatsiz o'zi netlanadi; TWA moliya ekrani storno'ni "bekor
      qilindi" deb ko'rsatadi (sabab mijozga ko'rinmaydi); grafikda
      manfiy kun 0-stub bo'lib qoladi, haqiqiy summa title'da.
      Kassa-by-staff'da bekor qilgan xodim manfiyda ko'rinadi — bu
      ataylab: egasi kunni yopayotganda ko'rsin.

---

## F–M — 2026-08-15 audit yechimlari (D-002 tartibi: F→G→H→I→K→L→M→J)

Har epic o'z Research/Decision bosqichi bilan ochiladi (D-001). Epic
boshlanishida SPEC.md tegishli bo'limi YOZILADI, keyin kod.

### F · Xavfsizlik (2026-08-15: F1–F5 bajarildi; F3-b switchover'ni kutadi)

- [x] **F1 · Bot lookup himoyasi** ✅ — free-text qidiruvda to'liq karta
      (vazn/narx/foto) faqat trek EGASIGA yoki faol xodimga; boshqalarga
      holat + sana + reys (SPEC §3.6 yangilandi, §10.2 qoidasi bilan bir
      xil). Egasiz trek'ka registratsiyalangan mijoz "➕ orqali qo'shing"
      maslahatini oladi.
- [x] **F2 · Botga kiruvchi rate-limit** ✅ — `inboundLimiter.ts`:
      per-(tenant,chat) 25/min + per-tenant 400/min, session/DB'dan OLDIN,
      jim tashlash, xotira chegaralangan; testlar bilan.
- [x] **F3 · Webhook secret_token + opaque path** ✅ — yangi path
      `/webhook/t/:tenantId` + `X-Telegram-Bot-Api-Secret-Token`
      (HMAC(SESSION_SECRET, tenantId) — `@kargotrack/shared/webhook`,
      DB'da secret YO'Q). Eski token-path switchover uchun qoladi va har
      hit'da warn yozadi. Onboarding tartibi: getMe → tenant → setWebhook.
      **Deploy'dan keyin har tenant'da /sa "Webhook" tugmasi bosiladi**
      (docs/DEPLOY.md).
- [ ] **F3-b · Eski token-path'ni o'chirish** — barcha tenantlar yangi
      webhook'ka o'tgach (trigger: F3 warn-logi ~7 kun jim bo'lganda)
      `/webhook/:botToken` marshruti olib tashlanadi. Ungacha eski
      loglardan token olgan hujumchi hali ham update yuborishi mumkin —
      teshik to'liq yopilgani YO'Q.
- [x] **F4 · Uploads zaxira** ✅ (sobiq P3) — backup.sh endi
      `uploads_<stamp>.tar.gz` ham oladi (`docker cp` tar-stream), 14 kun;
      tiklash protsedurasi docs/DEPLOY.md §9.1.
- [x] **F5 · Owner parol tiklash** ✅ (sobiq P4) — /sa qatorida "Parol
      tiklash": eng birinchi faol owner'ga yangi invite-kod (mavjud oqim,
      superadmin parolni BILMAYDI); kod bosilguncha eski parol ishlayveradi.

### G · Peshtaxta: topshirish ekrani ✅ (2026-08-15, D-003)

- [x] **G1 · SPEC §5.15** ✅ — oqim + chekka holatlar (qisman to'lov,
      avans, narxsiz trek, eskirgan tanlov) yozildi, kod undan keyin.
- [x] **G2 · `/handover` ekrani** ✅ — nav "Topshirish" (`tracks.status`);
      mijoz picker (mavjud sheet; L2 QR shu nuqtaga ulanadi) →
      READY_FOR_PICKUP **va** TASHKENT_WAREHOUSE treklari (ikkalasi ham
      jismonan Toshkentda — real peshtaxta "tayyor" bosqichini o'tkazib
      yuboradi), READY birinchi → tanlash → **bitta tranzaksiyada**
      DELIVERED + `payments` yozuvi (`handoverWithPayment`); tanlov
      eskirgan bo'lsa butunlay rad (yarim-topshirish yo'q); notify
      commit'dan keyin, o'sha shared planner orqali.
- [x] **G3 · Qisman to'lov** ✅ — summa default = tanlanganlar jami,
      tanlov o'zgarsa qo'l tegmagunicha ergashadi; "amaldan keyin"
      balansi jonli ko'rsatiladi; 0/bo'sh = to'lovsiz topshirish; pul
      bloki faqat `payments.record`da (warehouse topshiradi, pul olmaydi;
      server qayta tekshiradi).
- [x] **G4 · Testlar** ✅ — `shared/services/handover.ts`
      (eligible-statuslar, narxsiz=0, jami; debt bilan kelishuv testi).
      **Halol chegara:** `handoverWithPayment` tranzaksiyasining o'zi
      (status+to'lov birga commit) DB-testsiz — repoda DB-backed test
      infra yo'q va bitta funksiya uchun qurilmadi (ongli qaror);
      pilot-checklist'da birinchi qatorda tekshiriladi.

### H · Nizo va dalil (D-004)

- [x] **H1 · Trek metadata** ✅ (2026-08-16, SPEC 7.13) — `tracks`ga `marka`,
      `description`, `note` (migratsiya 0015, toza bazada tekshirildi).
      Weigh (panel + bot staff) yozilgan markani saqlaydi — conflict/notFound
      bo'lsa ham (dalil!), xom satr event `meta.markaRaw`da; bo'sh maydon
      hech qachon tozalamaydi. Importda alohida "marka" ustuni YO'Q (rejadan
      farq): mijoz katagi client-code shakliga ega bo'lsa o'zi marka sifatida
      saqlanadi; `Tavsif` — yangi mappable ustun (`tracks.edit` bilan).
      Import fill-if-empty. Qidiruvga marka qo'shildi. Trek detalida metadata
      karta (yangi `tracks.edit` capability: owner+manager). `description`
      mijozga ko'rinadi (bot karta + TWA), `marka`/`note` — faqat panel.
- [x] **H2 · Ko'p foto** ✅ (2026-08-16, SPEC 7.14) — `track_photos`
      (0016-migratsiya: toza baza + yangilanish yo'li Docker'da tekshirildi,
      `photo_path` ko'chirilib DROP qilindi). Fayl yo'li
      `{tenantId}/{trackId}/{photoId}.jpg`, eski fayllar joyida qoladi
      (path ustunda). Panel: galereya + tur tanlab yuklash + har fotoga
      o'chirish; weigh/bot staff — doim `intake` (tezlik); bot 📷 — 1 ta
      bo'lsa karta rasmi, ko'p bo'lsa karta + albom (≤10); notify —
      eng yangi foto; TWA — hammasi. Tur: qabul/shikast/topshirish.
      **Halol chegara:** yangi test yo'q — hammasi IO (route/query),
      pure logika yo'q. Qo'lda tekshirish deploy'dan keyin: turli tur bilan
      ko'p yuklash, har fotoga o'chirish, bot 📷 (1 vs albom), TWA galereya,
      notify'ga eng yangi foto ilova. **Deploy ehtiyoti:** 0016 eski kod
      o'qiydigan `photo_path`ni DROP qiladi — migratsiya va konteyner
      restart orasida eski kod 500 beradi; H-epic'ni tinch soatda deploy
      qilish, restart darhol.
- [x] **H3 · Ticket tizimi** ✅ (2026-08-16, SPEC 3.13/5.16/7.15, D-006) —
      `tickets` + `ticket_messages` (0017). Bot: menyuda "✍️ Murojaat",
      trek kartasida "⚠️ Muammo bor" (faqat egasiga); ochiq ticket bo'lsa —
      xabar qo'shiladi, yopiq bo'lsa — "davom ettirish (qayta ochadi) /
      yangi" tanlovi (D-006), aks holda kategoriya → matn. Panel: /tickets
      worklist (chips, default = faol) + detal (thread bubbles, javob,
      status, tayinlash), yangi `tickets.handle` capability (owner+manager).
      Kategoriya/status nomlari packages/shared'da (rule 5). Shared testlar:
      katalog, clampTicketText, D-006 reopen qoidasi.
- [x] **H4 · Ticket bildirishnomalari** ✅ (2026-08-16) — TICKET_QUEUE
      (pg-boss, standard) + bot'da ticket-worker: javob/yopilish xabari
      rate-limiter orqali, natija `message_log`ga (yangi kind 'ticket' +
      `ticket_message_id` ustuni, 0018) — panel thread'ida har javob yonida
      "Yetkazildi/Navbatda/Xatolik" ko'rinadi. Dashboardda ochiq murojaatlar
      kartasi (/tickets'ga havola). **Halol chegara:** DB-tranzaksiyalar va
      bot oqimi testsiz (DB-backed infra yo'q — G4 bilan bir xil); pure
      qoidalar testlangan. Qo'lda: murojaat ochish → panelda javob → botda
      olish → yopish → yopiqga yozib qayta ochilishini tekshirish.

### I · Hajmiy narxlash (D-005, xulq-atvor — D-007; SPEC 7.16)

- [x] **I1 · Model** ✅ (2026-08-16) — `tracks`ga `length_cm/width_cm/height_cm` (ixtiyoriy,
      faqat uchtasi birga ma'noli) + `volumetric_grams` (narx yozilganda
      MUZLATILADI, `usd_rate_used` mantig'i); `tariffs.volumetric_coef`
      NOT NULL default 167 (D-007: hamma tarifda). Shared
      `services/volumetric.ts`: hajmiy = round(U×K×B×koeff/1000),
      hisob vazni = max(haqiqiy, hajmiy), tenglikda "haqiqiy". O'lchamsiz
      trek — sof kg (regressiya yo'q). Narx yoziladigan uch yo'l ham shu
      xizmatdan o'tadi: tortish (panel+bot), trek detali, import.
      `weight_grams` MA'NOSI o'zgarmaydi — tarozi nima deganini saqlaydi.
      Testlar: regressiya (o'lchamsiz = bugungi narx), hajmiy g'olib,
      tenglik, qo'lda narx ustunligi, USD yo'li. **Migratsiya 0019 additive** —
      0016 dan farqli, eski konteynerni sindirmaydi (toza bazada 0000→0019
      tekshirildi).
- [x] **I2 · Kiritish** ✅ (2026-08-16) — /weigh konsolida `+ O'lcham` toggle'i ostida
      U×K×B (yopiq holatda tab-tartib va Enter-saqlash o'zgarmaydi —
      skaner oqimi muqaddas); trek detalidagi WeightForm'da uchta maydon.
      Tortishda bo'sh o'lcham saqlanganini TOZALAMAYDI (7.13 qoidasi),
      trek detalida esa erkin tahrirlanadi. Tarif dialogida koeffitsiyent
      maydoni (5.9). Bot ombor-rejimi o'lcham qabul qilmaydi (D-007) — lekin
      saqlangan o'lcham bilan narxlaydi, ya'ni ikki surfeys narxda ajralmaydi.
- [x] **I3 · Ko'rsatish** ✅ (2026-08-16) — kalkulyatorda ixtiyoriy 3-qadam (bot: `50x40x30`
      / `50 40 30`, `⏭ O'tkazib yuborish`; TWA: yig'ilgan blok), natijada
      hisob vazni + sababi; trek detali va /weigh kunlik ro'yxatida hajmiy
      belgisi; mijozga (bot kartasi + TWA + "tayyor" bildirishnomasi)
      `Hisob vazni: 8.0 kg (hajmiy) · haqiqiy 5.2 kg` (D-007); bot ombor
      javobida ham hajmiy eslatma. Yangi matnlar uz + ru (parity testi bilan).
      **Halol chegara:** UI komponentlari (weigh konsoli, WeightForm, TWA
      kalkulyator) testsiz — repoda React test infra yo'q; sof qoidalar va
      i18n render testlangan. Qo'lda tekshirish deploy'dan keyin: /weigh'da
      `+ O'lcham` bilan va busiz tortish (skaner oqimi buzilmaganini), trek
      detalida o'lcham saqlash/tozalash, tarif koeffitsiyentini o'zgartirish
      eski treklarni O'ZGARTIRMASLIGI, botda 3-qadamli kalkulyator va
      `⏭ O'tkazib yuborish`, mijoz kartasida hajmiy qator.

### K · Broadcast xavfsizligi (D-008; SPEC 5.8, 7.11, 7.17)

- [x] **K1 · "Menga test yubor"** ✅ (2026-08-16) — formada `📤 Menga test yubor`: matn
      kirgan xodimning O'Z Telegramiga (`admin_users.tg_user_id`) ketadi,
      o'sha navbat va rate-limiter orqali (qoida 3). Telegram ulanmagan
      bo'lsa tugma o'chiq + ulash maslahati. Test tarixga ham,
      `message_log`ga ham yozilmaydi.
- [x] **K2 · Ushlab turish + to'xtatish** ✅ (2026-08-16) — fan-out 60s `startAfter` bilan
      navbatga tushadi; `broadcasts.status` ('queued'|'cancelled') +
      `recipient_count`, `cancelled_at`, `cancelled_by`. Ishchi HAR
      xabardan oldin statusni o'qiydi — oyna ichida bekor qilish hech kimga
      yetkazmaydi, oynadan keyin qolganini to'xtatadi. pg-boss job id'lari
      saqlanmaydi (D-008). Bekor qilingan yetkazish `message_log`ga hech
      nima yozmaydi. Ekranda sanoq + `Bekor qilish` → `To'xtatish`.
- [x] **K3 · Blok ko'rinishi** ✅ (2026-08-16) — blok belgisi qoidasi SPEC 7.17 ga
      ko'chirildi (oxirgi `notify` `dropped`). Dashboardda 🚫 karta +
      /customers'da `Bloklaganlar` filtri (URL'da, qidiruv va sahifa bilan
      birga). Avtomatik chetlashtirish YO'Q (D-008).
      **Halol chegara:** UI va DB oqimi testsiz (React/DB test infra yo'q —
      G4/H4 bilan bir xil); sof qoidalar testlangan (`canStopBroadcast`,
      ushlab turish sanog'i, eski job'ni test deb o'qimaslik). Migratsiya
      0020 additive va eski qatorlarni backfill qiladi (toza bazada +
      backfill semantikasi tekshirildi). Qo'lda: test yuborish (Telegram
      ulangan/ulanmagan), 60s ichida bekor (hech kim olmasligi), oynadan
      keyin to'xtatish (qolgani ketmasligi), bloklaganlar kartasi va
      filtri.

### L · QR klient-karta (Cargou pariteti; D-009, SPEC 3.14)

Qaror qabul qilindi (D-009): QR ichida **oddiy client_code** (imzolangan
token emas) va `qrcode` kutubxonasi qo'shiladi.

- [x] **L1 · Mijoz QR'i** ✅ (2026-08-16) — botda `🪪 Mening kartam` (+ `/karta`): QR rasm,
      izohda kod monospace bilan; Mini App'da `/card` ekrani (server tomonda
      chiziladi). Ro'yxatdan o'tmaganga — "avval /start".
- [x] **L2 · Skan** ✅ (2026-08-16) — skan tugmasi `CustomerPickerSheet` ichiga qo'shiladi,
      ya'ni peshtaxta, biriktirish va trek detali birdan oladi; /weigh'da
      bitta skaner ikkalasini o'qiydi — shakli bo'yicha
      (`looksLikeClientCode`) trek kodi kod maydoniga, mijoz QR'i marka
      maydoniga tushadi. Skan infratuzilmasi `features/weigh` dan
      `components/shared` ga ko'chdi (cross-feature).
      **Halol chegara:** QR o'qish faqat real Android telefonda sinaladi
      (W3 bilan bir xil sabab — Windows Chrome'da `BarcodeDetector` yo'q),
      shuning uchun bu yerda faqat "tugma chizilmaydi" yo'li va shakl
      ajratish qoidasi (`looksLikeClientCode`, testlar bilan) tekshirildi.
      Qo'lda: botda 🪪 (rasm chiqishi), Mini App'da /card, peshtaxtada QR
      skanerlab mijoz avto-tanlanishi, /weigh'da mijoz QR'i marka maydoniga
      tushishi.

### M · Import himoyasi (D-010; SPEC 5.4, 7.18)

Qaror qabul qilindi (D-010): undo **to'liq** qaytaradi, xabarlar jim
(hisobot bilan), oyna **60 daqiqa**, eksportda rad etilgan **va**
ogohlantirishli qatorlar sabab ustuni bilan. Yangi kutubxona YO'Q — `xlsx`
allaqachon bor (`apps/web/lib/xlsx.ts`, eksport yo'li tayyor).

- [ ] **M1 · `import_runs`** — jadval (migratsiya 0022, additive): tenant_id,
      created_by, status, batch_id, source_name, sanoqlar, `items` jsonb
      (har trek uchun: nima YOZILDI / o'rnida nima BOR EDI), `rejected` jsonb,
      `undone_at/by`. Run yozuvi importning O'ZI bilan bitta tranzaksiyada.
      Per-trek iz — `track_events.meta.runId` (yangi ustunsiz, `{source:
      'batch', batchId}` naqshi). `applyImport` runId qaytaradi.
- [ ] **M2 · Undo** — 60 daqiqa ichida: yaratilganlar soft-delete, status
      ortga (yangi teskari event, `meta.source='import-undo'`), to'ldirilgan
      maydonlar bo'shaydi, biriktirilgan mijoz uziladi, reys avvalgiga,
      tiriltirilgan trek qayta o'chadi. Har qator uchun HOZIRGI qiymat run
      yozgani bilan solishtiriladi — bittasi farq qilsa butun qator tashlab
      o'tiladi va sanaladi. Qoida sof funksiyada (`planImportUndoRow`,
      testlar bilan). Xabar yuborilmaydi; ketib bo'lganlari son bo'lib
      aytiladi. Import notify'lari 60s ushlab turiladi va ishchi har
      xabardan oldin run tirikligini tekshiradi (K naqshi). Yangi
      `import.undo` capability. UI: natija ekranida va `Oxirgi importlar`
      kartasida (SPEC 5.4).
- [ ] **M3 · Rad etilgan qatorlar eksporti** — `rejected` jsonb apply
      paytida to'liq saqlanadi (namunaning 200 tasi emas, ≤1000 qator), har
      qatorda asl ustunlar + `Sabab` (badCode / weight / price /
      customerMissing / customerAmbiguous). `⬇️ Muammoli qatorlar` → xlsx
      (mavjud `writeXlsx` + `xlsxResponse` yo'li).

### J · SaaS boshqaruv (pul olishdan oldin — F–M ning oxiri)

- [ ] **J1 · Tenant disable** — `tenants.active`; o'chirilganda webhook
      deleteWebhook, panel login qulfi, TWA gate. /sa'da toggle.
- [ ] **J2 · Billing-lite** — `paid_until` sana + /sa'da belgilash;
      tugashidan 7/1 kun oldin owner'ga ogohlantirish; grace 7 kun,
      keyin auto-disable. Hisob-faktura YO'Q (kerak bo'lsa alohida qaror).

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

`qrcode` — QO'SHILDI (2026-08-16, D-009: QR standartini qo'lda yozish bir
necha yuz qator va o'zi bitta bug manbai; sof JS, Node'da PNG, brauzerda
data-URL). Boshqa yangi kutubxona YO'Q. `@aws-sdk/client-s3` — faqat B8
triggeri otilganda. Click uchun SDK olinmaydi (oddiy HTTPS + imzo, `fetch`
yetadi). Shtrix-kod skan (W3) — native `BarcodeDetector` API, kutubxonasiz;
tashqi lib faqat pilot telefonlari qo'llamasa. Ataylab olinmaydi:
`@telegram-apps/sdk` (o'z wrapper bor), `@grammyjs/storage-*` (o'z adapter
yozildi), Redis (pg-boss bor), alohida KMS (AES-GCM + hujjat). Yangi
dependensiya = alohida asoslash.
