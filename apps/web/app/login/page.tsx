import { redirect } from 'next/navigation';

import { getSessionAdmin } from '@/lib/auth';
import { RouteDots, Wordmark } from '@/components/brand';

import { LoginForm } from './login-form';

export const metadata = { title: 'Kirish — KargoTrack' };

export default async function LoginPage() {
  // Already signed in → straight to the panel.
  if (await getSessionAdmin()) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 px-5 py-10">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <Wordmark className="text-2xl" />
        <RouteDots />
        <p className="text-[13px] text-muted-foreground">
          Xitoy → O&apos;zbekiston kargo boshqaruvi
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-5 shadow-sm">
        <LoginForm />
      </div>

      <p className="text-[11px] text-muted-foreground">KargoTrack admin panel</p>
    </main>
  );
}
