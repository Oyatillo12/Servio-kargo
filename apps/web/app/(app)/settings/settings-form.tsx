'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  reconnectWebhookAction,
  updateSettingsAction,
  type SettingsState,
} from './actions';

const WEEKDAYS = [
  { value: '1', label: 'Dushanba' },
  { value: '2', label: 'Seshanba' },
  { value: '3', label: 'Chorshanba' },
  { value: '4', label: 'Payshanba' },
  { value: '5', label: 'Juma' },
  { value: '6', label: 'Shanba' },
  { value: '7', label: 'Yakshanba' },
];

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, '0')}:00`,
}));

const initial: SettingsState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Saqlanmoqda…' : 'Saqlash'}
    </Button>
  );
}

export interface SettingsInitial {
  pickupAddress: string;
  workingHours: string;
  contactPhone: string;
  staffIds: number[];
  chinaAddressTemplate: string;
  infoText: string;
  weeklyEnabled: boolean;
  weekday: string;
  hour: string;
  botUsername: string | null;
  webhookConnected: boolean;
}

export function SettingsForm({ initial: init }: { initial: SettingsInitial }) {
  const [state, formAction] = useFormState(updateSettingsAction, initial);

  const [staff, setStaff] = useState<number[]>(init.staffIds);
  const [newStaff, setNewStaff] = useState('');
  const [weekly, setWeekly] = useState(init.weeklyEnabled);
  const [weekday, setWeekday] = useState(init.weekday);
  const [hour, setHour] = useState(init.hour);

  const [connecting, startConnect] = useTransition();

  useEffect(() => {
    if (state.ok) toast.success('Sozlamalar saqlandi');
    if (state.error) toast.error(state.error);
  }, [state]);

  function addStaff() {
    const n = Number(newStaff.trim());
    if (!Number.isSafeInteger(n) || n <= 0) {
      toast.error("Telegram ID musbat butun son bo'lishi kerak");
      return;
    }
    if (!staff.includes(n)) setStaff((s) => [...s, n]);
    setNewStaff('');
  }

  function reconnect() {
    startConnect(async () => {
      const res = await reconnectWebhookAction();
      if (res.error) toast.error(res.error);
      else toast.success('Webhook qayta ulandi');
    });
  }

  return (
    <form action={formAction} className="space-y-3">
      {/* Hidden mirrors of the client-managed controls */}
      <input type="hidden" name="staffIds" value={staff.join(',')} />
      <input type="hidden" name="weeklyEnabled" value={weekly ? 'on' : ''} />
      <input type="hidden" name="weekday" value={weekday} />
      <input type="hidden" name="hour" value={hour} />

      {/* Section cards flow into two balanced columns on desktop. */}
      <div className="space-y-3 md:grid md:grid-cols-2 md:items-start md:gap-3 md:space-y-0">
        {/* Office info */}
        <SectionCard title="Ofis ma'lumotlari">
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pickupAddress">Manzil</Label>
              <Input
                id="pickupAddress"
                name="pickupAddress"
                defaultValue={init.pickupAddress}
                placeholder="Chilonzor 9, Toshkent"
              />
            </div>
            <div className="flex gap-2.5">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="workingHours">Ish vaqti</Label>
                <Input
                  id="workingHours"
                  name="workingHours"
                  defaultValue={init.workingHours}
                  placeholder="09:00–19:00"
                  className="font-mono"
                />
              </div>
              <div className="flex flex-[1.4] flex-col gap-1.5">
                <Label htmlFor="contactPhone">Telefon</Label>
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  defaultValue={init.contactPhone}
                  placeholder="+998 71 200 40 40"
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* 🇨🇳 China warehouse address template (SPEC §3.10 / §5.9) */}
        <SectionCard title="🇨🇳 Xitoy ombori manzili">
          <div className="space-y-2">
            <textarea
              name="chinaAddressTemplate"
              defaultValue={init.chinaAddressTemplate}
              rows={5}
              placeholder={
                'Ism: {client_code}\nTel: +86 ...\nManzil: Guangzhou, ...'
              }
              className="w-full resize-y rounded-lg border border-input bg-white px-3 py-2.5 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[11.5px] text-muted-foreground">
              <code className="rounded bg-secondary px-1 py-0.5">
                {'{client_code}'}
              </code>{' '}
              — mijoz kodi o&apos;rniga qo&apos;yiladi.
            </p>
          </div>
        </SectionCard>

        {/* Info text (SPEC §3.5 / §5.9) */}
        <SectionCard title="Ma'lumot matni">
          <div className="space-y-2">
            <textarea
              name="infoText"
              defaultValue={init.infoText}
              rows={5}
              placeholder="Taqiqlangan yuklar, qoidalar, tez-tez so'raladigan savollar…"
              className="w-full resize-y rounded-lg border border-input bg-white px-3 py-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[11.5px] text-muted-foreground">
              Botda ℹ️ Ma&apos;lumot bo&apos;limida ko&apos;rsatiladi.
            </p>
          </div>
        </SectionCard>

        {/* Staff Telegram IDs */}
        <SectionCard title="Xodim Telegram IDlari">
          <div className="space-y-2.5">
            {staff.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Hali xodim qo&apos;shilmagan.
              </p>
            ) : (
              staff.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                >
                  <span className="font-mono text-[12.5px] text-slate-600">
                    {id}
                  </span>
                  <button
                    type="button"
                    aria-label="O'chirish"
                    onClick={() => setStaff((s) => s.filter((x) => x !== id))}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
            <div className="flex gap-2">
              <Input
                value={newStaff}
                onChange={(e) => setNewStaff(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addStaff();
                  }
                }}
                inputMode="numeric"
                placeholder="Telegram ID"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Qo'shish"
                onClick={addStaff}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SectionCard>

        {/* Weekly auto-reminder */}
        <SectionCard
          title="Haftalik avto-eslatma"
          description="Qarzdorlarga avtomatik eslatma"
          action={<Switch checked={weekly} onCheckedChange={setWeekly} />}
        >
          <div
            className={cn(
              'flex gap-2.5',
              !weekly && 'pointer-events-none opacity-50',
            )}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Kun</Label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Soat</Label>
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        {/* Telegram bot */}
        <SectionCard
          title="Telegram bot"
          description={
            init.botUsername ? (
              <span className="font-mono">@{init.botUsername}</span>
            ) : undefined
          }
          action={
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold',
                init.webhookConnected
                  ? 'border-[#c2e8cf] bg-[#e2f6e8] text-[#177338]'
                  : 'border-[#f5c8c6] bg-[#fde8e8] text-[#b3261e]',
              )}
            >
              <span
                className={cn(
                  'h-[7px] w-[7px] rounded-full',
                  init.webhookConnected ? 'bg-[#177338]' : 'bg-[#b3261e]',
                )}
              />
              {init.webhookConnected ? 'Ulangan' : 'Uzilgan'}
            </span>
          }
        >
          <Button
            type="button"
            variant={init.webhookConnected ? 'secondary' : 'destructive'}
            className="w-full"
            onClick={reconnect}
            disabled={connecting}
          >
            {connecting ? 'Ulanmoqda…' : 'Webhookni qayta ulash'}
          </Button>
        </SectionCard>
      </div>

      <SaveButton />
    </form>
  );
}
