import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getSessionAdmin } from '@/lib/auth';
import { homeRouteFor } from '@/lib/home-route';
import { RouteDots, Wordmark } from '@/components/layout/brand';
import { LoginForm } from '@/features/auth/components/login-form';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

export default async function LoginPage() {
  // Already signed in → straight to wherever this role works.
  const session = await getSessionAdmin();
  if (session) redirect(homeRouteFor(session.role));

  const t = await getTranslations('auth');

  return (
    /*
     * Two panels on a desk browser, one column on a phone (SPEC 5.0).
     *
     * The old screen was a 384px card floating in the middle of whatever
     * monitor it opened on, which said nothing about what this is. The left
     * panel states it now — the mark, the route, the one line naming the
     * business this runs — and the form keeps a column of the width a password
     * field actually wants. On a phone the panel collapses to a header and the
     * form takes the screen.
     */
    <main className="min-h-svh bg-paper">
      <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col md:flex-row md:items-center md:gap-12 md:px-8">
        <section className="flex flex-col justify-center gap-4 px-5 pb-7 pt-10 md:flex-1 md:px-0 md:py-12">
          <Wordmark className="h-7 self-start md:h-8" />
          <h1 className="max-w-[14ch] font-display text-display font-semibold uppercase leading-[1.1] tracking-tight text-ink md:text-[40px] md:leading-[1.05]">
            {t('tagline')}
          </h1>
          <RouteDots />
          {/* A band of the same hatch the panel uses for "needs attention":
              here it is texture rather than state — the only ornament on the
              screen, and it is made of the system's own material. */}
          <div
            aria-hidden
            className="hatch h-2 w-40 rounded-sm border border-rule"
          />
        </section>

        <section className="flex flex-col gap-3 pb-10 md:w-[380px] md:flex-none md:py-12">
          <div className="border-y border-rule bg-surface p-5 md:rounded-lg md:border">
            <p className="eyebrow mb-3">{t('pageTitle')}</p>
            <LoginForm />
          </div>
          <p className="px-5 text-micro text-faint md:px-0">{t('footer')}</p>
        </section>
      </div>
    </main>
  );
}
