import { redirect } from 'next/navigation';

import { APP_NAME } from '@kargotrack/shared';

import { getSessionAdmin } from '@/lib/auth';

import { LoginForm } from './login-form';

export const metadata = { title: 'Kirish — KargoTrack' };

export default async function LoginPage() {
  // Already signed in → straight to the panel.
  if (await getSessionAdmin()) redirect('/tracks');

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-slate-500">Admin panelga kirish</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
