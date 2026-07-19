'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

      {/* Office info */}
      <div className="space-y-3 rounded-xl border border-border bg-white p-3.5">
        <h2 className="text-[13.5px] font-semibold">Ofis ma&apos;lumotlari</h2>
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

      {/* Staff Telegram IDs */}
      <div className="space-y-2.5 rounded-xl border border-border bg-white p-3.5">
        <h2 className="text-[13.5px] font-semibold">Xodim Telegram IDlari</h2>
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

      {/* Weekly auto-reminder */}
      <div className="space-y-3 rounded-xl border border-border bg-white p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13.5px] font-semibold">Haftalik avto-eslatma</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Qarzdorlarga avtomatik eslatma
            </p>
          </div>
          <Switch checked={weekly} onCheckedChange={setWeekly} />
        </div>
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
      </div>

      {/* Telegram bot */}
      <div className="space-y-3 rounded-xl border border-border bg-white p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13.5px] font-semibold">Telegram bot</p>
            {init.botUsername ? (
              <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">
                @{init.botUsername}
              </p>
            ) : null}
          </div>
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
        </div>
        <Button
          type="button"
          variant={init.webhookConnected ? 'secondary' : 'destructive'}
          className="w-full"
          onClick={reconnect}
          disabled={connecting}
        >
          {connecting ? 'Ulanmoqda…' : 'Webhookni qayta ulash'}
        </Button>
      </div>

      <SaveButton />
    </form>
  );
}
