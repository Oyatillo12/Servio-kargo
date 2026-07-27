'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { MIN_PASSWORD_LENGTH } from '@kargotrack/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

import { changeOwnPasswordAction } from '../actions';

/**
 * Change your own password, from the account menu (SPEC §5.12).
 *
 * Available to every role on purpose: before this existed the only way to change
 * a password was to edit the database, so a whole office shared one — which is
 * also why nobody could be held to what `created_by` recorded. Asking for the
 * current password means a session left open on a shared warehouse PC is not
 * enough to lock its owner out.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('team');
  const tCommon = useTranslations('common');
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');

  function reset() {
    setCurrent('');
    setNext('');
    setRepeat('');
  }

  function submit() {
    // Caught here rather than server-side: the server never sees the repeat
    // field, and a typo should not cost a round trip to find out.
    if (next !== repeat) {
      toast.error(t('passwordMismatch'));
      return;
    }
    start(async () => {
      const res = await changeOwnPasswordAction({
        currentPassword: current,
        newPassword: next,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('passwordChanged'));
      reset();
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('changePassword')}</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-password">{t('currentPassword')}</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">{t('newPassword')}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
              aria-describedby="new-password-hint"
            />
            <p
              id="new-password-hint"
              className="text-[12px] text-muted-foreground"
            >
              {t('passwordHint', { min: MIN_PASSWORD_LENGTH })}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="repeat-password">{t('repeatPassword')}</Label>
            <Input
              id="repeat-password"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              required
            />
          </div>

          {/* Stated up front, not discovered afterwards: the other devices are
              signed out, and this one deliberately is not. */}
          <p className="text-[12px] text-muted-foreground">
            {t('passwordRevokesSessions')}
          </p>

          <div className="mt-1 flex flex-col gap-2 md:flex-row md:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : null}
              {tCommon('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
