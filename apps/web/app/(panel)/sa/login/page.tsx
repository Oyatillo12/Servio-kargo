import { redirect } from 'next/navigation';

import { isSuperadmin } from '@/lib/superadmin';

import { SaLoginForm } from './login-form';

export const metadata = { title: 'Super-admin — SERVIO Kargo' };

export default function SaLoginPage() {
  // Already unlocked → straight to the console.
  if (isSuperadmin()) redirect('/sa');

  return (
    <main className="flex min-h-svh bg-paper items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-md bg-surface p-6 border border-rule">
        <div className="mb-6 text-center">
          <h1 className="font-display text-title font-semibold uppercase tracking-[0.04em] text-ink">SERVIO Kargo</h1>
          <p className="mt-1 text-small text-faint">Super-admin panel</p>
        </div>
        <SaLoginForm />
      </div>
    </main>
  );
}
