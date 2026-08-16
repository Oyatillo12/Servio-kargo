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
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 px-5 py-10">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <Wordmark className="h-9" />
        <RouteDots />
        <p className="text-small text-muted-foreground">{t('tagline')}</p>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-sm">
        <LoginForm />
      </div>

      <p className="text-micro text-muted-foreground">{t('footer')}</p>
    </main>
  );
}
