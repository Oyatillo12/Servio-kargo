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
