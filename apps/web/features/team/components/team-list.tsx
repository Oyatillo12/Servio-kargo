'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  LogOut,
  MoreVertical,
  Send,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatDateTime, type AdminRole } from '@kargotrack/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import {
  changeMemberRoleAction,
  revokeInviteAction,
  revokeSessionsAction,
  setMemberActiveAction,
  unlinkTelegramAction,
} from '../actions';
import { InviteCode } from './invite-code';
import { InviteMemberDialog } from './invite-member-dialog';
import { RolePicker } from './role-picker';

export interface TeamMemberView {
  id: string;
  fullName: string | null;
  phone: string | null;
  role: AdminRole;
  active: boolean;
  tgLinked: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
  invite: { code: string; expiresAt: string } | null;
  /** True for the signed-in owner's own row — self-actions are held back. */
  isSelf: boolean;
}

/**
 * The team roster (SPEC §5.12).
 *
 * One row per employee, showing the four things an owner actually needs: what
 * they are allowed to do, whether they can sign in, whether the bot knows them,
 * and when they were last here. Everything destructive lives behind the row's
 * `⋮` menu with a confirm — deactivating a colleague mid-shift is not a thing to
 * do by mis-tapping on a phone.
 */
export function TeamList({ members }: { members: TeamMemberView[] }) {
  const t = useTranslations('team');

  if (members.length === 0) {
    return (
      <p className="px-4 py-6 text-small text-muted-foreground">
        {t('empty')}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-n-200">
      {members.map((m) => (
        <MemberRow key={m.id} member={m} />
      ))}
    </ul>
  );
}

function MemberRow({ member }: { member: TeamMemberView }) {
  const t = useTranslations('team');
  const tRoles = useTranslations('roles');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [roleOpen, setRoleOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reinviteOpen, setReinviteOpen] = useState(false);

  const name = member.fullName ?? member.phone ?? t('unnamed');
  const initial = (member.fullName ?? member.phone ?? '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  /** Run an action, surface its error, and refresh — the shape every item shares. */
  function run(
    fn: () => Promise<{ ok?: boolean; error?: string }>,
    done: string,
  ) {
    start(async () => {
      const res = await fn();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(done);
      router.refresh();
    });
  }

  return (
    <li className={cn('px-4 py-3', !member.active && 'bg-secondary/50')}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-small font-semibold',
            member.active
              ? 'bg-accent text-primary'
              : 'bg-n-200 text-muted-foreground',
          )}
        >
          {initial}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                'truncate text-body font-semibold',
                member.active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {name}
            </span>
            {member.isSelf ? (
              <span className="flex-none text-micro text-faint">
                {t('you')}
              </span>
            ) : null}
            <RoleBadge role={member.role} label={tRoles(member.role)} />
            {!member.active ? (
              <span className="flex-none rounded-full bg-n-200 px-2 py-px text-micro font-semibold text-muted-foreground">
                {t('deactivated')}
              </span>
            ) : null}
          </div>

          {member.phone ? (
            <p className="mt-0.5 truncate font-mono text-micro text-muted-foreground">
              {member.phone}
            </p>
          ) : null}

          {/* Status line: the two facts that decide what an owner does next —
              can they get into the panel, and does the bot recognise them. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-micro text-faint">
            <span className={member.tgLinked ? 'text-success' : undefined}>
              {member.tgLinked ? t('telegramLinked') : t('telegramMissing')}
            </span>
            {member.lastLoginAt ? (
              <span>
                {t('lastLogin', {
                  when: formatDateTime(new Date(member.lastLoginAt)),
                })}
              </span>
            ) : member.hasPassword ? (
              <span>{t('neverSignedIn')}</span>
            ) : (
              <span>{t('noPanelAccess')}</span>
            )}
          </div>

          {member.invite ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <InviteCode code={member.invite.code} />
              <span className="text-micro text-faint">
                {t('inviteValidUntil', {
                  when: formatDateTime(new Date(member.invite.expiresAt)),
                })}
              </span>
            </div>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('memberActions', { name })}
            disabled={pending}
            className="-me-1 flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {pending ? (
              <Spinner />
            ) : (
              <MoreVertical className="h-4 w-4" aria-hidden />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => setRoleOpen(true)}>
              <ShieldCheck aria-hidden />
              {t('changeRole')}
            </DropdownMenuItem>

            {/* Re-invite covers both an expired code and a bot-only warehouse
                hand who has never had panel access. */}
            <DropdownMenuItem onSelect={() => setReinviteOpen(true)}>
              <Send aria-hidden />
              {member.hasPassword ? t('resetAccess') : t('grantAccess')}
            </DropdownMenuItem>

            {member.invite ? (
              <DropdownMenuItem
                onSelect={() =>
                  run(() => revokeInviteAction(member.id), t('inviteRevoked'))
                }
              >
                <X aria-hidden />
                {t('revokeInvite')}
              </DropdownMenuItem>
            ) : null}

            {member.tgLinked ? (
              <DropdownMenuItem
                onSelect={() =>
                  run(
                    () => unlinkTelegramAction(member.id),
                    t('telegramUnlinked'),
                  )
                }
              >
                <UserX aria-hidden />
                {t('unlinkTelegram')}
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() =>
                run(() => revokeSessionsAction(member.id), t('sessionsRevoked'))
              }
            >
              <LogOut aria-hidden />
              {t('revokeSessions')}
            </DropdownMenuItem>

            {member.isSelf ? null : member.active ? (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setDeactivateOpen(true);
                }}
                className="text-destructive"
              >
                <UserX aria-hidden />
                {t('deactivate')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={() =>
                  run(
                    () =>
                      setMemberActiveAction({
                        adminUserId: member.id,
                        active: true,
                      }),
                    t('reactivated'),
                  )
                }
              >
                <UserCheck aria-hidden />
                {t('reactivate')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangeRoleDialog
        open={roleOpen}
        onOpenChange={setRoleOpen}
        member={member}
        onSaved={() => router.refresh()}
      />

      <InviteMemberDialog
        open={reinviteOpen}
        onOpenChange={setReinviteOpen}
        member={{
          id: member.id,
          fullName: member.fullName,
          phone: member.phone,
        }}
      />

      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deactivateTitle')}</DialogTitle>
            <DialogDescription>
              {t('deactivateBody', { name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDeactivateOpen(false)}
              disabled={pending}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={pending}
              onClick={() => {
                setDeactivateOpen(false);
                run(
                  () =>
                    setMemberActiveAction({
                      adminUserId: member.id,
                      active: false,
                    }),
                  t('deactivated'),
                );
              }}
            >
              {pending ? <Spinner /> : null}
              {t('deactivate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

/** Owner reads indigo; the other two stay muted so the rare one is scannable. */
function RoleBadge({ role, label }: { role: AdminRole; label: string }) {
  return (
    <span
      className={cn(
        'flex-none rounded-full px-2 py-px text-micro font-semibold',
        role === 'owner'
          ? 'bg-accent text-primary'
          : 'border border-n-200 text-muted-foreground',
      )}
    >
      {label}
    </span>
  );
}

function ChangeRoleDialog({
  open,
  onOpenChange,
  member,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMemberView;
  onSaved: () => void;
}) {
  const t = useTranslations('team');
  const tCommon = useTranslations('common');
  const [role, setRole] = useState<AdminRole>(member.role);
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('changeRole')}</DialogTitle>
          <DialogDescription>
            {t('changeRoleBody', {
              name: member.fullName ?? member.phone ?? t('unnamed'),
            })}
          </DialogDescription>
        </DialogHeader>

        <RolePicker value={role} onChange={setRole} disabled={pending} />

        <DialogFooter>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            className="flex-1"
            disabled={pending || role === member.role}
            onClick={() =>
              start(async () => {
                const res = await changeMemberRoleAction({
                  adminUserId: member.id,
                  role,
                });
                if (res.error) {
                  toast.error(res.error);
                  return;
                }
                toast.success(t('roleChanged'));
                onOpenChange(false);
                onSaved();
              })
            }
          >
            {pending ? <Spinner /> : null}
            {tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
