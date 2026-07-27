'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PanelSection } from '@/components/ui/panel-section';
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

/**
 * Submit button placed at the end of a section (design 2a/2b puts one under
 * "Office data" and one under "China address"). Every one of them submits the
 * same single form — these settings are one row in `tenants` and saving them
 * piecemeal would mean partial writes — so the button an admin happens to
 * press is simply the one nearest what they just edited.
 */
function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="mt-3.5 flex md:justify-end">
      <Button
        type="submit"
        disabled={pending}
        className="w-full md:h-8 md:w-auto md:px-3 md:text-[13px]"
      >
        {pending ? <Spinner /> : null}
        {label}
      </Button>
    </div>
  );
}

export interface SettingsInitial {
  pickupAddress: string;
  workingHours: string;
  contactPhone: string;
  chinaAddressTemplate: string;
  infoText: string;
  weeklyEnabled: boolean;
  weekday: string;
  hour: string;
  botUsername: string | null;
  webhookConnected: boolean;
}

/**
 * Everything on the settings screen that lives in one `tenants` row.
 *
 * The `<form>` is `display: contents` so its sections drop straight into the
 * page's `SectionStack` — on a phone they have to be siblings of the tariff and
 * currency blocks for the grey bands to line up, and on desktop they have to be
 * grid items to fall into the two columns.
 */
export function SettingsForm({ initial: init }: { initial: SettingsInitial }) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [state, formAction] = useFormState(updateSettingsAction, initial);

  const [weekly, setWeekly] = useState(init.weeklyEnabled);
  const [weekday, setWeekday] = useState(init.weekday);
  const [hour, setHour] = useState(init.hour);

  const [connecting, startConnect] = useTransition();

  useEffect(() => {
    if (state.ok) toast.success(t('saved'));
    if (state.error) toast.error(state.error);
  }, [state, t]);

  function reconnect() {
    startConnect(async () => {
      const res = await reconnectWebhookAction();
      if (res.error) toast.error(res.error);
      else toast.success(t('reconnected'));
    });
  }

  return (
    <form action={formAction} className="contents">
      {/* Hidden mirrors of the client-managed controls */}
      <input type="hidden" name="weeklyEnabled" value={weekly ? 'on' : ''} />
      <input type="hidden" name="weekday" value={weekday} />
      <input type="hidden" name="hour" value={hour} />

      {/* China warehouse address template (SPEC §3.10 / §5.9) */}
      <PanelSection
        className="md:col-span-2"
        title={
          <span className="flex items-center gap-2">
            {t('chinaTitle')}
            <span
              aria-hidden
              className="rounded-sm border border-n-200 px-1.5 py-px font-mono text-[11px] font-medium text-faint"
            >
              CN
            </span>
          </span>
        }
      >
        <Textarea
          name="chinaAddressTemplate"
          defaultValue={init.chinaAddressTemplate}
          rows={5}
          placeholder={t('chinaPlaceholder', { token: CLIENT_CODE_TOKEN })}
          aria-label={t('chinaTitle')}
          className="rounded-sm font-mono text-[13px] leading-[1.7]"
        />
        <p className="mt-2 text-[13px] text-muted-foreground">
          <code className="rounded-sm border border-n-200 bg-secondary px-1.5 py-px font-mono text-[12px]">
            {CLIENT_CODE_TOKEN}
          </code>{' '}
          {t('chinaHint')}
        </p>
        <SaveButton label={t('saveChina')} />
      </PanelSection>

      {/* Office info */}
      <PanelSection title={t('officeTitle')} className="md:col-span-4">
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
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="workingHours">{t('workingHours')}</Label>
              <Input
                id="workingHours"
                name="workingHours"
                defaultValue={init.workingHours}
                placeholder={t('workingHoursPlaceholder')}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
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
        <SaveButton label={t('saveOffice')} />
      </PanelSection>

      {/* Info text (SPEC §3.5 / §5.9) */}
      <PanelSection title={t('infoTitle')} className="md:col-span-2">
        <Textarea
          name="infoText"
          defaultValue={init.infoText}
          rows={5}
          placeholder={t('infoPlaceholder')}
          aria-label={t('infoTitle')}
          className="rounded-sm text-[13px]"
        />
        <p className="mt-2 text-[13px] text-muted-foreground">{t('infoHint')}</p>
      </PanelSection>

      {/* Weekly auto-reminder */}
      <PanelSection
        className="md:col-span-2"
        title={t('reminderTitle')}
        action={
          <Switch
            checked={weekly}
            onCheckedChange={setWeekly}
            aria-label={t('reminderTitle')}
          />
        }
      >
        <p className="mb-3 text-[13px] text-muted-foreground">
          {t('reminderDescription')}
        </p>
        <div
          className={cn('flex gap-2.5', !weekly && 'pointer-events-none opacity-50')}
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
      </PanelSection>

      {/* Telegram bot */}
      <PanelSection
        className="md:col-span-4"
        title={t('botTitle')}
        action={
          <span
            className={cn(
              'flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold',
              init.webhookConnected
                ? 'border-success/25 bg-success/10 text-success'
                : 'border-destructive/25 bg-destructive/10 text-destructive',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'h-[7px] w-[7px] rounded-full',
                init.webhookConnected ? 'bg-success' : 'bg-destructive',
              )}
            />
            {init.webhookConnected ? t('botConnected') : t('botDisconnected')}
          </span>
        }
      >
        {init.botUsername ? (
          <p className="mb-3 font-mono text-[13px] text-muted-foreground">
            @{init.botUsername}
          </p>
        ) : null}
        <div className="flex flex-col gap-2.5 md:flex-row md:justify-end">
          <Button
            type="button"
            variant={init.webhookConnected ? 'outline' : 'destructive'}
            className="w-full md:h-8 md:w-auto md:px-3 md:text-[13px]"
            onClick={reconnect}
            disabled={connecting}
          >
            {connecting ? <Spinner /> : null}
            {t('reconnect')}
          </Button>
          {/* Catch-all save for the sections above that have no button of their
              own (info text, staff, reminder). */}
          <SaveButtonInline label={tCommon('save')} />
        </div>
      </PanelSection>
    </form>
  );
}

/** Same submit as `SaveButton`, without the section's trailing spacing row. */
function SaveButtonInline({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full md:h-8 md:w-auto md:px-3 md:text-[13px]"
    >
      {pending ? <Spinner /> : null}
      {label}
    </Button>
  );
}
