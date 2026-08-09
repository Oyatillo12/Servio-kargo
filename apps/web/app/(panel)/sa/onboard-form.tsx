'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { onboardTenantAction, type OnboardState } from './actions';

const initialState: OnboardState = {};

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
const labelClass = 'mb-1 block text-sm font-medium text-slate-700';

function Field({
  name,
  label,
  hint,
  ...props
}: {
  name: string;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <input id={name} name={name} className={inputClass} {...props} />
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? 'Yaratilmoqda…' : 'Kompaniyani yaratish'}
    </button>
  );
}

export function OnboardForm() {
  const [state, formAction] = useFormState(onboardTenantAction, initialState);
  const [currency, setCurrency] = useState<'UZS' | 'USD'>('UZS');
  const isUsd = currency === 'USD';

  return (
    <form action={formAction} className="space-y-5">
      {state.ok ? (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          <p className="font-semibold">
            ✅ {state.ok.name} yaratildi va webhook o‘rnatildi.
          </p>
          {state.ok.botUsername ? (
            <p className="mt-1">
              Bot:{' '}
              <a
                href={`https://t.me/${state.ok.botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                @{state.ok.botUsername}
              </a>{' '}
              — mijoz botni ochib <code>/start</code> bossa ishlaydi.
            </p>
          ) : null}
          <p className="mt-1">
            Admin kiritilgan telefon + parol bilan panelga kira oladi.
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Kompaniya
        </p>
        <Field
          name="name"
          label="Kompaniya nomi"
          placeholder="Dream Kargo"
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            name="codePrefix"
            label="Mijoz kodi prefiksi"
            placeholder="DK"
            hint="2–4 lotin harf"
            maxLength={4}
            required
          />
          <div>
            <label htmlFor="currency" className={labelClass}>
              Valyuta
            </label>
            <select
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'UZS' | 'USD')}
              className={inputClass}
            >
              <option value="UZS">So&apos;m (UZS)</option>
              <option value="USD">Dollar (USD)</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="plan" className={labelClass}>
            Tarif rejasi
          </label>
          <select id="plan" name="plan" defaultValue="basic" className={inputClass}>
            <option value="basic">Basic — bot + panel</option>
            <option value="premium">Premium — Mini App, to&apos;lov, bonus (tez orada)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            name="pricePerKg"
            label={isUsd ? 'Kg narxi ($)' : "Kg narxi (so'm)"}
            placeholder={isUsd ? '3.5' : '55000'}
            inputMode="decimal"
            required
          />
          {isUsd ? (
            <Field
              name="usdRate"
              label="Kurs (1$ = ? so'm)"
              placeholder="12800"
              inputMode="numeric"
              required
            />
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Telegram bot
        </p>
        <Field
          name="botToken"
          label="Bot token (BotFather'dan)"
          placeholder="123456789:AAE..."
          hint="@BotFather → /newbot → tokenni shu yerga qo‘ying"
          autoComplete="off"
          required
        />
      </div>

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Ma'lumot kartasi (ixtiyoriy)
        </p>
        <Field
          name="pickupAddress"
          label="Olib ketish manzili"
          placeholder="Toshkent sh., Chilonzor t., Bunyodkor 1"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            name="workingHours"
            label="Ish vaqti"
            placeholder="Du–Sha, 09:00–18:00"
          />
          <Field
            name="contactPhone"
            label="Aloqa telefoni"
            placeholder="+998 90 111 22 33"
            inputMode="tel"
          />
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Birinchi admin
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field
            name="adminPhone"
            label="Admin telefoni"
            placeholder="+998 90 123 45 67"
            inputMode="tel"
            autoComplete="off"
            required
          />
          <Field
            name="adminPassword"
            label="Admin paroli"
            type="password"
            hint="kamida 6 belgi"
            autoComplete="new-password"
            required
          />
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
