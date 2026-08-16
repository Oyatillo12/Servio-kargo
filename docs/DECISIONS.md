# DECISIONS — arxitektura va biznes qarorlari jurnali (ADR-lite)

Append-only. Har yozuv: Kontekst → Variantlar → Qaror → Oqibatlar.
Yangi epic DECISIONS yozuvisiz boshlanmaydi (CLAUDE.md ga qarang).
Qaror o'zgarsa — eski yozuv o'chirilmaydi, yangi raqam bilan bekor qilinadi.

---

## D-001 · Ish tartibi (workflow) va hujjat strukturasi — 2026-08-15

**Kontekst.** 2026-08-15 dagi bozor-research + to'liq audit ~15 ta muhim
kamchilik topdi. Yechimlar tizimli qurilishi kerak; qarorlar tasks.md
izohlarida sochilib yurmasligi kerak.

**Qaror.** Har epic quyidagi bosqichlardan o'tadi:
Research → Analysis (≥2 variant + trade-off) → Decision (shu jurnal;
muhim qaror — egasi bilan) → Documentation (SPEC.md **koddan oldin**) →
Tasks (tasks.md) → Implementation (DoD) → Testing/Validation (DoD +
qo'lda tekshiruv checklist'i + pilot feedback).

Hujjat rollari: SPEC.md — xulq shartnomasi; tasks.md — yagona ish
ro'yxati; DECISIONS.md — qarorlar; AUDIT.md — muzlatilgan tarix.

**Oqibatlar.** Og'ir RFC jarayoni YO'Q (1 kishilik jamoaga ortiqcha);
lekin spec'siz va qarorsiz kod ham yo'q.

---

## D-002 · Pilotgacha F–M epiklari TO'LIQ quriladi — 2026-08-15 (egasi)

**Kontekst.** tasks.md prinsipi "birinchi pilot, isbotlanmagan talabga kod
yozilmaydi" edi. Audit esa pilot birinchi haftada duch keladigan teshiklarni
ko'rsatdi (peshtaxta, nizo, xavfsizlik).

**Variantlar.** (a) faqat F (xavfsizlik) → pilot; (b) F+G+H-yadro → pilot
(tavsiya etilgan edi); (c) F–M hammasi → pilot.

**Qaror (egasi).** (c) — F dan M gacha hammasi quriladi, pilot keyin
boshlanadi. Tartib: F → G → H → I → K → L → M → J.

**Oqibatlar.** P1 pilot F–M tugagach boshlanadi; tasks.md dagi "pilot
birinchi" tartib prinsipi shu qaror bilan qayta ko'rildi. Risk (ochiq
tan olinadi): ~2–3 oy pilot signalisiz qurish — ba'zi model qarorlari
(ayniqsa I tariflari, P7 marka-first) real ma'lumotsiz qabul qilinadi va
pilotda tuzatilishi mumkin.

---

## D-003 · To'lov modeli: agregat qoladi + peshtaxta ekrani — 2026-08-15 (egasi)

**Kontekst.** "3 qutidan 2 tasini to'lab oldi" holati. Hozir to'lov mijoz
darajasida, qarz = SUM(narxlar) − SUM(to'lovlar).

**Variantlar.** (a) agregat + peshtaxta ekrani; (b) to'liq
payment_allocations jadvali (to'lov ↔ trek); (c) gibrid nullable bog'lash.

**Qaror (egasi).** (a). To'lovlar mijoz darajasida qoladi — migratsiya yo'q,
debt/storno/tushum o'qishlari o'zgarmaydi. Peshtaxta (`/handover`) ekrani:
treklar tanlanadi → jami avto-hisoblanadi → DELIVERED + to'lov bitta
harakatda; summa tahrirlanadi (qisman to'lov = balansga ishonch).

**Oqibatlar.** "Aynan qaysi quti to'langan" degan per-trek holat YO'Q —
kichik kargolarning real ishlash usuli balans bilan. Agar pilot per-trek
holatni talab qilsa, allokatsiya jadvali KEYIN qo'shiladi (agregat model
buni bloklamaydi, faqat kechiktiradi).

---

## D-004 · Mijoz-operator aloqasi: to'liq ticket tizimi — 2026-08-15 (egasi)

**Kontekst.** Har muammo panelda iz qoldirmaydigan telefon qo'ng'irog'i.
Nizo (vazn, shikast, yo'qolgan quti) — kargo biznesining kundalik holati.

**Variantlar.** (a) minimal relay (tugma → worklist → javob), tavsiya
etilgan edi; (b) to'liq ticket tizimi; (c) deep-link shaxsiy akkauntga.

**Qaror (egasi).** (b) — to'liq ticket: `tickets` + `ticket_messages`,
statuslar (open / in_progress / closed), kategoriya (vazn / shikast /
yo'qolgan / to'lov / boshqa), xodimga tayinlash, trek'ka ixtiyoriy
bog'lash. Bot tomonida: "✍️ Murojaat" + trek kartasida "Muammo bor";
javoblar botga yetkaziladi. SLA-taymerlar birinchi versiyaga KIRMAYDI
(kerak bo'lsa alohida qaror).

**Oqibatlar.** Relay'dan ~2–3 hafta ko'proq ish; evaziga nizolar tarixi,
mas'ul va holat bilan panelda yashaydi. H-epic hajmi shu qarorga mos
kattalashtirildi.

---

## D-005 · Hajmiy narxlash: hozir, max(haqiqiy kg, hajmiy kg) — 2026-08-15 (egasi)

**Kontekst.** Bozorda avto-kargo narxi zichlik/kubga bog'liq ($3–6/kg
diapazoni shunga qarab). Bizda faqat kg × tarif + qo'lda override.

**Variantlar.** (a) pilotdan keyin real tarif jadvali bilan (tavsiya
etilgan edi); (b) hozir, standart max(kg, kub×koeff) bilan.

**Qaror (egasi).** (b). O'lchamlar (sm, ixtiyoriy) trek'ka kiritiladi;
tarif darajasida hajmiy koeffitsiyent (kg/m³, default 167 avia-standart,
tahrirlanadi); narx = max(haqiqiy kg, hajm_m³ × koeff) × tarif narxi.
O'lcham kiritilmasa — hozirgidek sof kg (regressiya yo'q).

**Oqibatlar.** Zichlik-DIAPAZONLI tariflar (masalan 100–200 kg/m³ oralig'iga
boshqa narx) birinchi versiyaga kirmaydi — pilot real jadval ko'rsatsa,
tarif modeliga diapazonlar keyin qo'shiladi. price_manual override har
doim ustun turadi (o'zgarmaydi).

---

## D-006 · Ticket xulq-atvori (D-004 davomi) — 2026-08-16 (egasi)

**Kontekst.** D-004 to'liq ticket tizimini tanladi, lekin to'rt xulq-atvor
savoli ochiq qolgan edi. H3 boshlanishidan oldin egasi bilan hal qilindi.

**Qaror (egasi, 4/4 tavsiya bo'yicha).**
1. **Javob yuzasi:** faqat panel. Xodim javobni panelda yozadi, bot
   yetkazadi; botning staff-rejimi ticketlarga aralashmaydi.
2. **Closed xulqi:** mijoz yopiq ticketga yozsa — avto qayta ochiladi
   (statusi `open`ga qaytadi, xabar tarixga qo'shiladi).
3. **Kategoriyalar:** vazn / shikast / yo'qolgan / to'lov / boshqa —
   D-004 ro'yxati o'zgarishsiz.
4. **Yopish:** faqat xodim (panelda). Mijozga yopilgani haqida xabar
   boradi; botda "hal bo'ldi" tugmasi yo'q.

**Oqibatlar.** Bot tomonida bitta oddiy oqim qoladi (murojaat yozish /
davom ettirish); xodim oqimi butunlay panelda. Mijoz-tomonlama yopish va
bot-staff javoblari keyinroq alohida qaror bilan qo'shilishi mumkin.

---

## D-007 · Hajmiy narxlash xulq-atvori (D-005 davomi) — 2026-08-16 (egasi)

**Kontekst.** D-005 formulani tanladi — `max(haqiqiy kg, m³ × koeff) × tarif`.
I-epic boshlanishida uchta xulq-atvor savoli ochiq qolgan edi: koeffitsiyent
qaysi tariflarda yoqiladi, mijoz kalkulyatorida o'lcham qanday so'raladi va
mijoz hajmiy vaznning O'ZINI ko'radimi.

**Qaror (egasi).**
1. **Koeffitsiyent har tarifda** — `tariffs.volumetric_coef`, NOT NULL,
   DEFAULT 167 (D-005 harfma-harf). Migratsiya mavjud barcha tariflarga 167
   yozadi. Muqobil variant ("tarifga qarab yoqiladi", ustun nullable) rad
   etildi. 167 — avia standarti; avto kargoda odatdagi 200–333 dan PAST,
   ya'ni kam hisoblaydi, va egasi tarif kartasidan tuzatadi. Regressiya
   xavfi yo'q: koeffitsiyent faqat o'lchami kiritilgan trekka tegadi.
2. **Kalkulyatorda ixtiyoriy 3-qadam** — bot ham, Mini App ham: vazndan keyin
   "o'lchamlar (ixtiyoriy)" qadami `⏭ O'tkazib yuborish` tugmasi bilan.
   Qadamlar `1/3 · 2/3 · 3/3` bo'ladi; o'lchamsiz oqim aynan hozirgidek
   ishlaydi. Bitta qatorda format (`3.2 50x40x30`) rad etildi — ko'rinmas
   imkoniyat bo'lib qolardi.
3. **Mijoz hajmiy vaznni sababi bilan ko'radi** — bot trek kartasi va TWA:
   `Hisob vazni: 8.0 kg (hajmiy) · haqiqiy 5.2 kg`. Tushuntirilmagan raqam —
   ertangi murojaat; H-epic butun mantig'i shu.

**Oqibatlar.**
- Hajmiy vazn trekka **muzlatiladi** (`tracks.volumetric_grams`): koeffitsiyent
  keyin o'zgarsa, eski trekning ko'rsatuvi o'z narxiga zid bo'lmaydi —
  `usd_rate_used` bilan bir xil mantiq (SPEC 7.4).
- Bot ombor-rejimi (`KOD VAZN MARKA`) o'lcham QABUL QILMAYDI — uchta raqam
  Telegram xabarida xatoga ochiq, o'lcham panel oqimlariga qoladi. Bot orqali
  qayta tortilgan trek saqlangan o'lchamini ishlatadi, ya'ni ikki surfeys
  narxda kelishmovchilikka tushmaydi.
- Zichlik-DIAPAZONLI tariflar hamon rejadan tashqarida (D-005).

---

## D-008 · Broadcast xavfsizligi (K-epic) — 2026-08-16 (egasi)

**Kontekst.** Xabarnoma bitta tugma bilan 3000 mijozga ketadi va qaytarib
bo'lmaydi: hozir forma → tasdiq → darhol har mijozga bitta pg-boss job.
Xato matn, noto'g'ri narx, chala jumla — hammasi bir zumda tarqaladi.
Bloklaganlar esa faqat bitta mijoz kartasida ko'rinadi, umumiy manzara yo'q.

**Variantlar va qaror (egasi, 3/3 tavsiya bo'yicha).**

1. **Ushlab turish oynasi + keyin ham to'xtatish.** Jo'natish 60 soniya
   kechikadi (`startAfter`); shu oynada "Bekor qilish" — hech kimga xabar
   ketmagan holda hammasi bekor bo'ladi. Oyna tugagach tugma "To'xtatish"ga
   aylanadi: yuborilganlari qoladi, qolgani jo'natilmaydi.
   Rad etilgan variantlar: (b) faqat 60s oyna — xatoni 61-soniyada
   payqagan odamga hech nima qoldirmaydi; (c) kechiktirmasdan kuchli tasdiq
   — tasdiq modali xato matnni to'xtatmaydi, uni faqat takrorlaydi.
   **Texnik shakl:** bekor qilish `broadcasts.status` ustuni orqali, pg-boss
   job id'larini saqlash orqali EMAS. Ishchi har xabardan oldin bitta qator
   o'qiydi; 3000 job id'ini saqlab, keyin ularni cancel qilish mo'rt bo'lardi
   va yarim yo'ldagi fan-out'ni to'xtata olmasdi.
2. **"Menga test yubor" — kirgan xodimning o'z Telegramiga.**
   `admin_users.tg_user_id` ulangan bo'lsa faol; ulanmagan bo'lsa tugma
   o'chiq + botda ulash maslahati. Mijozga sinov yuborish rad etildi:
   real mijoz sabab-siz "test" xabar olmasligi kerak. Test `broadcasts`
   tarixiga ham, `message_log`ga ham YOZILMAYDI — u xabarnoma emas,
   ko'rib olish. Lekin baribir NAVBAT orqali ketadi (CLAUDE.md qoida 3):
   web tomondan to'g'ridan-to'g'ri yuborish rate-limiterni chetlab o'tardi.
3. **Bloklaganlar ko'rsatiladi, avtomatik chetlashtirilmaydi.**
   Dashboardda "N mijoz botni bloklagan", mijozlar ro'yxatida filtr.
   Belgi — mavjud qoida (oxirgi **notify** `dropped`, A3). Avtomatik
   chetlashtirish rad etildi: belgi taxmin, blokdan chiqqan mijoz o'zi
   qaytishi kerak, aks holda uni qo'lda tiklamaguncha hech qachon xabar
   olmaydi.

**Oqibatlar.**
- Har xabarnoma endi kamida 60 soniya kechikadi — "shoshilinch" xabarnoma
  degan tushuncha yo'q, va bu ataylab.
- Bekor qilingan xabarnoma `message_log`ga hech nima yozmaydi: aks holda
  dashboarddagi "yetmagan xabarlar" hech kim jo'natmagan xabardan shishardi.
- `broadcasts` jadvaliga progress uchun `recipient_count` qo'shiladi —
  "2 980 / 3 000" ko'rsatish va "tugadimi" savoliga javob berish uchun.
- Bloklaganlar navbatga baribir tushadi: Telegram limiti bo'yicha bu narx,
  lekin blokdan chiqqan mijoz avtomatik qaytadi.

---

## D-009 · QR klient-karta (L-epic) — 2026-08-16 (egasi)

**Kontekst.** Peshtaxtada mijozni topish hozir qidiruv orqali: kod, ism yoki
telefon terish. Raqobatchi (Cargou) mijozga QR-karta beradi, xodim skanerlaydi.
tasks.md L bloki epic boshida ikki savolni ochiq qoldirgan edi.

**Qaror (egasi, 2/2 tavsiya bo'yicha).**

1. **QR ichida oddiy `client_code`** (`DK-1042`), imzolangan token EMAS.
   Sabab: QR mijozni faqat **tanlaydi** — xodim ekranda ism, telefon va
   qarzni ko'rib turib tasdiqlaydi, ya'ni soxta QR bilan boshqa birovning
   yukini olib bo'lmaydi. Oddiy kod inson o'qiy oladigan zaxira ham beradi
   (QR kir bo'lsa — qo'lda kiritiladi) va kalit almashishi eski kartalarni
   o'ldirmaydi. Imzolangan token xavfsizlikni deyarli oshirmasdan uchta
   yangi nosozlik yo'lini qo'shardi.
2. **`qrcode` kutubxonasi qo'shiladi** — "yangi kutubxona = alohida asoslash"
   siyosati (tasks.md) bo'yicha ataylab so'ralgan qaror. Asoslash: QR
   standarti (Reed–Solomon + maska tanlash) bir necha yuz qator kod va o'zi
   bitta bug manbai; `qrcode` sof JS, Node'da PNG bufer, brauzerda data-URL
   beradi — bitta kutubxona ikkala surfeysga. Muqobillar rad etildi:
   "rasmsiz, faqat matn" L2 ni ma'nosiz qilardi; "faqat Mini App'da"
   botdagi kartani yarim qoldirardi.

**Oqibatlar.**
- QR — sirli kalit EMAS: uni ko'rgan odam faqat client_code'ni biladi, bu esa
  posilka qutisiga baribir yozib qo'yiladi (marka, §7.13). Xavfsizlik chegarasi
  o'sha joyda qoladi — xodim tasdig'i.
- Skanerlash yagona joyda: `CustomerPickerSheet` (peshtaxta, biriktirish, trek
  detali) va /weigh marka maydoni. Shu sababli shtrix-skan infratuzilmasi
  `features/weigh` dan `components/shared` ga ko'chiriladi (CLAUDE.md
  layout qoidasi: cross-feature qismlar shu yerda).
- Trek kodi va client_code bitta skanerdan tushadi, shakli bo'yicha ajratiladi
  (`looksLikeClientCode`, testlar bilan) — xodim "qaysi rejim" deb
  o'ylamaydi.
