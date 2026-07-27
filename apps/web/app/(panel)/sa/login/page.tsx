import { redirect } from 'next/navigation';

import { isSuperadmin } from '@/lib/superadmin';

import { SaLoginForm } from './login-form';

export const metadata = { title: 'Super-admin — SERVIO Kargo' };

export default function SaLoginPage() {
  // Already unlocked → straight to the console.
  if (isSuperadmin()) redirect('/sa');

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">SERVIO Kargo</h1>
          <p className="mt-1 text-sm text-slate-500">Super-admin panel</p>
        </div>
        <SaLoginForm />
      </div>
    </main>
  );
}
