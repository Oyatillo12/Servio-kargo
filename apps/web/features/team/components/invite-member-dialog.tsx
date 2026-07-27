'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { AdminRole } from '@kargotrack/shared';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

import { inviteMemberAction, reinviteMemberAction } from '../actions';
import { InviteCode } from './invite-code';
import { RolePicker } from './role-picker';

/**
 * Add an employee, or re-issue a code for one who already has a row.
 *
 * Two-step by design: the form, then the code. The code screen is the whole
 * point of the flow — it is what the owner reads down the phone — so it gets the
 * sheet to itself instead of appearing as a toast that vanishes in four seconds
 * while they are still looking for a pen.
 *
 * `member` set means re-invite: an expired code, or a bot-only warehouse hand
 * (migrated out of `settings.staff_tg_ids`, so they have no phone yet) being
 * given panel access for the first time.
 */
export function InviteMemberDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: { id: string; fullName: string | null; phone: string | null };
}) {
  const t = useTranslations('team');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();

  const [phone, setPhone] = useState(member?.phone ?? '');
  const [fullName, setFullName] = useState(member?.fullName ?? '');
  const [role, setRole] = useState<AdminRole>('manager');
  const [code, setCode] = useState<string | null>(null);

  function close(next: boolean) {
    if (!next) {
      setCode(null);
      setPhone(member?.phone ?? '');
      setFullName(member?.fullName ?? '');
      setRole('manager');
    }
    onOpenChange(next);
  }

  function submit() {
    start(async () => {
      const res = member
        ? await reinviteMemberAction({ adminUserId: member.id, phone })
        : await inviteMemberAction({ phone, fullName, role });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setCode(res.code ?? null);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="bottom" className="flex flex-col gap-3">
        <SheetHeader>
          <SheetTitle>{member ? t('reinvite') : t('addMember')}</SheetTitle>
        </SheetHeader>

        {code ? (
          <div className="flex flex-col gap-3">
            <p className="text-[13.5px] text-muted-foreground">
              {t('codeExplainer', { name: fullName || phone })}
            </p>
            <InviteCode code={code} className="self-start" />
            <ol className="flex list-decimal flex-col gap-1 ps-5 text-[13px] text-muted-foreground">
              <li>{t('codeStep1')}</li>
              <li>{t('codeStep2')}</li>
              <li>{t('codeStep3')}</li>
            </ol>
            <p className="text-[12px] text-faint">{t('codeExpiry')}</p>
            <Button onClick={() => close(false)} className="mt-1">
              {tCommon('done')}
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="member-phone">{t('phone')}</Label>
              <Input
                id="member-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="+998 90 000 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="font-mono"
                required
                aria-describedby="member-phone-hint"
              />
              <p
                id="member-phone-hint"
                className="text-[12px] text-muted-foreground"
              >
                {t('phoneHint')}
              </p>
            </div>

            {member ? null : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="member-name">{t('fullName')}</Label>
                  <Input
                    id="member-name"
                    name="fullName"
                    autoComplete="off"
                    placeholder={t('fullNamePlaceholder')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    aria-describedby="member-name-hint"
                  />
                  {/* Optional in the schema, but the reason to fill it in is not
                      obvious from a form field, so it is stated. */}
                  <p
                    id="member-name-hint"
                    className="text-[12px] text-muted-foreground"
                  >
                    {t('fullNameHint')}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>{t('role')}</Label>
                  <RolePicker
                    value={role}
                    onChange={setRole}
                    disabled={pending}
                  />
                </div>
              </>
            )}

            <div className="mt-1 flex flex-col gap-2 md:flex-row md:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => close(false)}
                disabled={pending}
              >
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner /> : null}
                {t('createInvite')}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** "Add employee" entry point on the team screen. */
export function InviteMemberButton() {
  const t = useTranslations('team');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" aria-hidden />
        {t('addMember')}
      </Button>
      <InviteMemberDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
