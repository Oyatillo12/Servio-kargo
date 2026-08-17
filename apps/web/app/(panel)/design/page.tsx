import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowRight, Download, Plus } from 'lucide-react';

import { TRACK_STATUSES } from '@kargotrack/shared';

import { EmptyState } from '@/components/shared/empty-state';
import { FilterChips } from '@/components/shared/filter-chips';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataItem, DataList } from '@/components/ui/data-list';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { StatTile } from '@/components/ui/stat-tile';
import { Switch } from '@/components/ui/switch';
import { TabStrip, resolveTab, type TabItem } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * `/design` — the whole TERMINAL system on one page (SPEC 5.0).
 *
 * This is the review surface: a token is changed here first, and the two things
 * that cannot be checked by reading CSS are checked here by eye — whether the
 * chosen faces actually carry `oʻ / gʻ` and Cyrillic, and whether signal orange
 * and warning amber stay tellable apart at the size they are really used.
 *
 * DEVELOPMENT ONLY. It renders no tenant data and takes no session, which is
 * also why it may not exist in production: it is the one page in the panel that
 * is not behind `requireAdmin`. Strings are deliberately NOT translated — a
 * specimen sheet is written for whoever is changing the design, and running its
 * labels through `messages/*.json` would put dead keys in both locales.
 */
export const metadata = { title: 'TERMINAL — design system' };

/** The specimen tabs — real links, so the strip below really navigates. */
const DEMO_TABS: TabItem[] = [
  { key: 'umumiy', label: 'Umumiy' },
  { key: 'suratlar', label: 'Suratlar', count: 3 },
  { key: 'tarix', label: 'Tarix' },
  { key: 'xabarlar', label: 'Xabarlar', count: 12 },
];

export default function DesignPage({
  searchParams,
}: {
  searchParams: { tab?: string; p?: string };
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const tab = resolveTab(DEMO_TABS, searchParams.tab);
  const period = ['today', '7d', '30d'].includes(searchParams.p ?? '')
    ? (searchParams.p as string)
    : 'today';
  const keep = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { tab: searchParams.tab, p: searchParams.p, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/design?${qs}` : '/design';
  };

  return (
    <main className="min-h-svh bg-paper px-4 py-8 md:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="border-b border-rule pb-5">
          <p className="eyebrow">SERVIO Kargo · SPEC 5.0 · D-012</p>
          <h1 className="mt-1 font-display text-display font-semibold uppercase tracking-tight text-ink">
            Terminal
          </h1>
          <p className="mt-1.5 max-w-prose text-body text-ink-2">
            Yuk hujjati tili: qog&apos;oz fon, qora siyoh, ingichka chiziqlar,
            katta raqamlar. Rang faqat holatni bildiradi. Oynani torayting —
            tipografika va tugma balandligi 768px da o&apos;zgaradi.
          </p>
        </header>

        {/* ---- 1. The two things only an eye can check --------------------- */}
        <Section
          title="Shrift qamrovi"
          note="Har uch shriftda oʻ / gʻ va kirill — tushib qolsa, boshqa harflardan boshqacha ko'rinadi"
        >
          <div className="grid gap-px bg-rule-soft md:grid-cols-3">
            <GlyphCard family="font-display" name="Oswald" role="sarlavha" />
            <GlyphCard family="font-sans" name="Golos Text" role="matn" />
            <GlyphCard family="font-mono" name="JetBrains Mono" role="raqam" />
          </div>
          <div className="mt-px bg-surface p-4">
            <p className="eyebrow">Yonma-yon — apostrof bir xilmi?</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-ink">
              <span className="font-display text-[34px] leading-none">
                Oʻzbekiston gʻalaba
              </span>
              <span className="font-sans text-[34px] leading-none">
                Oʻzbekiston gʻalaba
              </span>
              <span className="font-mono text-[28px] leading-none">Oʻ gʻ</span>
            </p>
          </div>
        </Section>

        <Section
          title="Signal va ogohlantirish"
          note="Ikkalasi ko'zga yaqin — shuning uchun diqqat holati hech qachon faqat rang bilan aytilmaydi"
        >
          <div className="grid gap-px bg-rule-soft md:grid-cols-2">
            <div className="flex flex-col gap-3 bg-surface p-4">
              <p className="eyebrow">Signal = harakat</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button>
                  <Plus aria-hidden />
                  Yangi mijoz
                </Button>
                <Button variant="outline">
                  <Download aria-hidden />
                  Excel
                </Button>
              </div>
              <p className="text-small text-ink-2">
                Bitta ekranda bitta to&apos;ldirilgan tugma. Qolgani chegarali.
              </p>
            </div>
            <div className="flex flex-col gap-3 bg-surface p-4">
              <p className="eyebrow">Amber = diqqat</p>
              <div className="flex items-center gap-3 rounded-md border border-warning/25 bg-[var(--st-china-bg)] px-3 py-2.5">
                <span className="hatch flex h-9 w-9 flex-none items-center justify-center rounded-sm border border-warning/25">
                  <AlertTriangle
                    className="h-[18px] w-[18px] text-warning"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-small font-semibold text-ink">
                    14 ta yuk tortilmagan
                  </span>
                  <span className="block text-micro text-ink-2">
                    Ikona + shtrix + matn — rang uchinchi darajali
                  </span>
                </span>
              </div>
              <p className="text-small text-ink-2">
                Kulrang bosmada ham, rangni ajratmaydigan ko&apos;zda ham
                o&apos;qiladi.
              </p>
            </div>
          </div>
        </Section>

        {/* ---- 2. Tokens --------------------------------------------------- */}
        <Section title="Yer (ground)">
          <div className="grid grid-cols-2 gap-px bg-rule-soft sm:grid-cols-4">
            <Swatch name="paper" value="#F4F2ED" className="bg-paper" />
            <Swatch name="surface" value="#FFFFFF" className="bg-surface" />
            <Swatch name="surface-alt" value="#FAF9F6" className="bg-surface-alt" />
            <Swatch name="rule" value="#DAD6CC" className="bg-rule" />
            <Swatch name="ink" value="#14171A" className="bg-ink" dark />
            <Swatch name="ink-2" value="#5A5F66" className="bg-ink-2" dark />
            <Swatch name="ink-3" value="#7C818A" className="bg-ink-3" dark />
            <Swatch name="rule-soft" value="#E9E6DE" className="bg-rule-soft" />
          </div>
        </Section>

        <Section title="Signal va holat ranglari">
          <div className="grid grid-cols-2 gap-px bg-rule-soft sm:grid-cols-4">
            <Swatch name="signal" value="#DC5A22" className="bg-signal" dark />
            <Swatch
              name="signal-strong"
              value="#B4441A"
              className="bg-signal-strong"
              dark
            />
            <Swatch name="signal-soft" value="#FBEDE5" className="bg-signal-soft" />
            <Swatch name="destructive" value="#C1272D" className="bg-destructive" dark />
            <Swatch name="warning" value="#C77E10" className="bg-warning" dark />
            <Swatch name="success" value="#1F8A4C" className="bg-success" dark />
            <Swatch
              name="st-transit"
              value="#1F5FA9"
              className="bg-[var(--st-transit)]"
              dark
            />
            <Swatch
              name="st-tashkent"
              value="#3F4E9C"
              className="bg-[var(--st-tashkent)]"
              dark
            />
          </div>
        </Section>

        {/* ---- 3. Type ----------------------------------------------------- */}
        <Section title="Tipografika" note="Bir xil klass, ikki zichlik">
          <div className="divide-y divide-rule-soft bg-surface">
            <TypeRow step="display" spec="26 / 24px · Oswald">
              <span className="font-display text-display font-semibold uppercase">
                Toshkent ombori
              </span>
            </TypeRow>
            <TypeRow step="title" spec="20 / 18px">
              <span className="text-title font-semibold">Treklar ro&apos;yxati</span>
            </TypeRow>
            <TypeRow step="lead" spec="17 / 15px">
              <span className="text-lead">Mijozga xabar yuborildi</span>
            </TypeRow>
            <TypeRow step="body" spec="15 / 13.5px">
              <span className="text-body">
                Yukingiz Toshkentga yetib keldi. Съешь ещё этих булок.
              </span>
            </TypeRow>
            <TypeRow step="small" spec="13 / 12px">
              <span className="text-small text-ink-2">
                Ikkilamchi matn, izoh, yordamchi qator
              </span>
            </TypeRow>
            <TypeRow step="micro" spec="11 / 10.5px">
              <span className="text-micro text-ink-3">
                Sana, hisoblagich, badge ichidagi matn
              </span>
            </TypeRow>
            <TypeRow step="eyebrow" spec="Oswald · uppercase">
              <span className="eyebrow">Vazn · narx · mijoz</span>
            </TypeRow>
            <TypeRow step="mono" spec="Raqam ustuni">
              <span className="flex flex-col font-mono text-body tabular-nums">
                <span>CN-4821-9920</span>
                <span>1 240 000</span>
                <span>12.40</span>
              </span>
            </TypeRow>
          </div>
        </Section>

        {/* ---- 4. Density -------------------------------------------------- */}
        <Section
          title="Zichlik"
          note="h-control: 44px telefonda, 34px desktopda · h-row: 56 / 40px"
        >
          <div className="flex flex-col gap-3 bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Saqlash</Button>
              <Button variant="outline">Bekor qilish</Button>
              <Input className="h-control w-40" placeholder="Trek kodi" />
            </div>
            <div className="border-t border-rule-soft pt-3">
              <p className="eyebrow mb-1.5">Ro&apos;yxat qatori</p>
              <ul className="divide-y divide-rule-soft border-y border-rule-soft">
                {[
                  ['CN-4821-9920', 'DK-1042 · Aziz K.', '12.40'],
                  ['CN-7734-1180', 'DK-0918 · Nodira R.', '3.10'],
                ].map(([code, owner, kg]) => (
                  <li key={code} className="flex h-row items-center gap-3">
                    <span className="font-mono text-small font-semibold text-ink">
                      {code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-small text-ink-2">
                      {owner}
                    </span>
                    <span className="font-mono text-small tabular-nums text-ink-2">
                      {kg} kg
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ---- 5. Statuses ------------------------------------------------- */}
        <Section title="Holat belgilari" note="Chap chetdagi chiziq — asosiy signal">
          <div className="flex flex-wrap gap-2 bg-surface p-4">
            {TRACK_STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
        </Section>

        {/* ---- 6. Controls ------------------------------------------------- */}
        <Section
          title="Boshqaruv elementlari"
          note="Tab'lar va segment — havola, ya'ni URL'da yashaydi"
        >
          <div className="flex flex-col gap-5 bg-surface p-4">
            <div>
              <p className="eyebrow mb-2">Tab lentasi (bosib ko&apos;ring)</p>
              <TabStrip
                items={DEMO_TABS}
                active={tab}
                buildHref={(k) => keep({ tab: k === 'umumiy' ? undefined : k })}
              />
              <p className="mt-2 text-small text-ink-2">
                Faol tab: <code className="font-mono text-ink">{tab}</code> —
                sahifa yangilansa ham saqlanadi.
              </p>
            </div>

            <div>
              <p className="eyebrow mb-2">Segment</p>
              <Segmented
                label="Davr"
                active={period}
                options={[
                  { value: 'today', label: 'Bugun', href: keep({ p: undefined }) },
                  { value: '7d', label: '7 kun', href: keep({ p: '7d' }) },
                  { value: '30d', label: '30 kun', href: keep({ p: '30d' }) },
                ]}
              />
            </div>

            <div>
              <p className="eyebrow mb-2">Filtr chiplari</p>
              <FilterChips
                label="Holat"
                active={undefined}
                chips={[
                  { value: undefined, label: 'Barchasi' },
                  { value: 'a', label: 'Xitoy omborida', count: 42 },
                  { value: 'b', label: 'Yo‘lda', count: 7 },
                  { value: 'c', label: 'Tayyor', count: 13 },
                ]}
                buildHref={() => keep({})}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-code">Trek kodi</Label>
                <Input id="d-code" defaultValue="CN-4821-9920" className="font-mono" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-note">Izoh</Label>
                <Textarea id="d-note" rows={2} placeholder="Ixtiyoriy izoh" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-small text-ink">
                <Checkbox defaultChecked /> Tanlangan
              </label>
              <label className="flex items-center gap-2 text-small text-ink">
                <Switch defaultChecked /> Haftalik eslatma
              </label>
              <Badge>12</Badge>
              <Badge variant="secondary">Qoralama</Badge>
            </div>
          </div>
        </Section>

        <Section title="Raqamli plitkalar" note="Nol — tinch, diqqat — shtrixli">
          <div className="grid gap-px bg-rule-soft md:grid-cols-3">
            <StatTile
              label="Yangi mijozlar"
              sublabel="Bugun"
              value={6}
              className="border-0 md:rounded-none md:border-0"
            />
            <StatTile
              label="Yetkazilmagan xabar"
              sublabel="Bugun"
              value={4}
              alert
              className="border-0 md:rounded-none md:border-0"
            />
            <StatTile
              label="Botni bloklaganlar"
              sublabel="Hozirgi"
              value={0}
              alert
              className="border-0 md:rounded-none md:border-0"
            />
          </div>
        </Section>

        <Section title="Bo&apos;sh holat">
          <div className="bg-surface p-4">
            <EmptyState
              title="Hech narsa topilmadi"
              hint="Qidiruvni o'zgartiring yoki filtrni tozalang"
              action={
                <Button variant="outline" size="sm">
                  Filtrni tozalash
                </Button>
              }
            />
          </div>
        </Section>

        {/* ---- 7. In situ -------------------------------------------------- */}
        <Section title="Amalda" note="Trek kartasi — sistema bir joyda">
          <article className="bg-surface">
            <div className="flex items-start justify-between gap-3 border-b border-rule-soft p-4">
              <div className="min-w-0">
                <p className="eyebrow">Trek</p>
                <p className="font-mono text-lead font-semibold text-ink">
                  CN-4821-9920
                </p>
              </div>
              <StatusBadge status="TASHKENT_WAREHOUSE" />
            </div>
            <DataList>
              <DataItem label="Vazn" value="12.40" unit="kg" />
              <DataItem label="Narx" value="1 240 000" unit="so'm" />
              <DataItem label="Reys" value="AVIA-21.07" mono={false} />
              <DataItem label="Qarz" value="240 000" unit="so'm" tone="debt" />
            </DataList>
            <div className="flex items-center justify-between gap-3 p-4">
              <span className="text-small text-ink-2">
                DK-1042 · Aziz Karimov
              </span>
              <Button size="sm" variant="outline">
                Ochish
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </article>
        </Section>

        <footer className="border-t border-rule pt-4 text-micro text-ink-3">
          Bu sahifa faqat development&apos;da ochiladi (SPEC 5.0).
        </footer>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- helpers */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="font-display text-title font-semibold uppercase tracking-wide text-ink">
          {title}
        </h2>
        {note ? <p className="text-small text-ink-3">{note}</p> : null}
      </div>
      <div className="border border-rule">{children}</div>
    </section>
  );
}

/** One face, with the characters that decide whether it can ship. */
function GlyphCard({
  family,
  name,
  role,
}: {
  family: string;
  name: string;
  role: string;
}) {
  return (
    <div className="bg-surface p-4">
      <p className="eyebrow">
        {name} · {role}
      </p>
      <p className={cn(family, 'mt-2 text-[26px] leading-tight text-ink')}>
        Oʻzbekiston
      </p>
      <p className={cn(family, 'text-[26px] leading-tight text-ink')}>
        Gʻijduvon
      </p>
      <p className={cn(family, 'text-[26px] leading-tight text-ink')}>
        Съешь ещё
      </p>
      <p className={cn(family, 'mt-1 text-title tabular-nums text-ink-2')}>
        0123456789
      </p>
    </div>
  );
}

function Swatch({
  name,
  value,
  className,
  dark,
}: {
  name: string;
  value: string;
  className: string;
  dark?: boolean;
}) {
  return (
    <div className="bg-surface">
      <div className={cn('flex h-16 items-end p-2', className)}>
        <span
          className={cn(
            'font-mono text-micro',
            dark ? 'text-white/80' : 'text-ink-2',
          )}
        >
          {value}
        </span>
      </div>
      <p className="px-2 py-1.5 font-mono text-micro text-ink-2">{name}</p>
    </div>
  );
}

function TypeRow({
  step,
  spec,
  children,
}: {
  step: string;
  spec: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-4">
      <div className="flex w-40 flex-none items-baseline gap-2">
        <code className="font-mono text-micro text-ink">{step}</code>
        <span className="text-micro text-ink-3">{spec}</span>
      </div>
      <div className="min-w-0 text-ink">{children}</div>
    </div>
  );
}
