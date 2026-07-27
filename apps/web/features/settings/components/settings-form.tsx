'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
} from '../actions';

/** ISO weekday number → message key (SPEC §4.4 reminder schedule). */
const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, '0')}:00`,
}));

/** The literal token the China-address template substitutes (SPEC §3.10). */
const CLIENT_CODE_TOKEN = '{client_code}';

const initial: SettingsState = {};

function SaveButton() {
  const t = useTranslations('common');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? <Spinner /> : null}
      {t('save')}
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
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [state, formAction] = useFormState(updateSettingsAction, initial);

  const [staff, setStaff] = useState<number[]>(init.staffIds);
  const [newStaff, setNewStaff] = useState('');
  const [weekly, setWeekly] = useState(init.weeklyEnabled);
  const [weekday, setWeekday] = useState(init.weekday);
  const [hour, setHour] = useState(init.hour);

  const [connecting, startConnect] = useTransition();

  useEffect(() => {
    if (state.ok) toast.success(t('saved'));
    if (state.error) toast.error(state.error);
  }, [state, t]);

  function addStaff() {
    const n = Number(newStaff.trim());
    if (!Number.isSafeInteger(n) || n <= 0) {
      toast.error(t('staffInvalid'));
      return;
    }
    if (!staff.includes(n)) setStaff((s) => [...s, n]);
    setNewStaff('');
  }

  function reconnect() {
    startConnect(async () => {
      const res = await reconnectWebhookAction();
      if (res.error) toast.error(res.error);
      else toast.success(t('reconnected'));
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
        <SectionCard title={t('officeTitle')}>
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pickupAddress">{t('address')}</Label>
              <Input
                id="pickupAddress"
                name="pickupAddress"
                defaultValue={init.pickupAddress}
                placeholder={t('addressPlaceholder')}
              />
            </div>
            <div className="flex gap-2.5">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="workingHours">{t('workingHours')}</Label>
                <Input
                  id="workingHours"
                  name="workingHours"
                  defaultValue={init.workingHours}
                  placeholder={t('workingHoursPlaceholder')}
                  className="font-mono"
                />
              </div>
              <div className="flex flex-[1.4] flex-col gap-1.5">
                <Label htmlFor="contactPhone">{t('contactPhone')}</Label>
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  defaultValue={init.contactPhone}
                  placeholder={t('contactPhonePlaceholder')}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* China warehouse address template (SPEC §3.10 / §5.9) */}
        <SectionCard title={t('chinaTitle')}>
          <div className="space-y-2">
            <Textarea
              name="chinaAddressTemplate"
              defaultValue={init.chinaAddressTemplate}
              rows={5}
              placeholder={t('chinaPlaceholder', { token: CLIENT_CODE_TOKEN })}
              aria-label={t('chinaTitle')}
              className="font-mono text-[13px]"
            />
            <p className="text-[11.5px] text-muted-foreground">
              <code className="rounded bg-secondary px-1 py-0.5">
                {CLIENT_CODE_TOKEN}
              </code>{' '}
              {t('chinaHint')}
            </p>
          </div>
        </SectionCard>

        {/* Info text (SPEC §3.5 / §5.9) */}
        <SectionCard title={t('infoTitle')}>
          <div className="space-y-2">
            <Textarea
              name="infoText"
              defaultValue={init.infoText}
              rows={5}
              placeholder={t('infoPlaceholder')}
              aria-label={t('infoTitle')}
              className="text-[13px]"
            />
            <p className="text-[11.5px] text-muted-foreground">
              {t('infoHint')}
            </p>
          </div>
        </SectionCard>

        {/* Staff Telegram IDs */}
        <SectionCard title={t('staffTitle')}>
          <div className="space-y-2.5">
            {staff.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                {t('staffEmpty')}
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
                    aria-label={`${tCommon('delete')} ${id}`}
                    onClick={() => setStaff((s) => s.filter((x) => x !== id))}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-4 w-4" aria-hidden />
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
                    // The row lives inside the settings <form>; without this the
                    // Enter would submit every setting on the page instead.
                    e.preventDefault();
                    addStaff();
                  }
                }}
                inputMode="numeric"
                placeholder={t('staffPlaceholder')}
                aria-label={t('staffPlaceholder')}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={tCommon('add')}
                onClick={addStaff}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </SectionCard>

        {/* Weekly auto-reminder */}
        <SectionCard
          title={t('reminderTitle')}
          description={t('reminderDescription')}
          action={
            <Switch
              checked={weekly}
              onCheckedChange={setWeekly}
              aria-label={t('reminderTitle')}
            />
          }
        >
          <div
            className={cn(
              'flex gap-2.5',
              !weekly && 'pointer-events-none opacity-50',
            )}
            aria-hidden={!weekly}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="weekday">{t('weekday')}</Label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger id="weekday">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_KEYS.map((key, i) => (
                    <SelectItem key={key} value={String(i + 1)}>
                      {t(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="hour">{t('hour')}</Label>
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger id="hour">
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
          title={t('botTitle')}
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
                aria-hidden
                className={cn(
                  'h-[7px] w-[7px] rounded-full',
                  init.webhookConnected ? 'bg-[#177338]' : 'bg-[#b3261e]',
                )}
              />
              {init.webhookConnected ? t('botConnected') : t('botDisconnected')}
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
            {connecting ? <Spinner /> : null}
            {t('reconnect')}
          </Button>
        </SectionCard>
      </div>

      <SaveButton />
    </form>
  );
}
