'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { TICKET_STATUSES, type TicketStatus } from '@kargotrack/shared';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { assignTicketAction, setTicketStatusAction } from '../actions';

const UNASSIGNED = '__none__';

/**
 * Status + assignee selects (SPEC §5.16). Server-passed labels: status names
 * come from the shared catalogue (rule 5), employee names from the DB.
 */
export function TicketControls({
  ticketId,
  status,
  statusLabels,
  assignedTo,
  assignees,
}: {
  ticketId: string;
  status: TicketStatus;
  statusLabels: Record<TicketStatus, string>;
  assignedTo: string | null;
  assignees: { id: string; fullName: string }[];
}) {
  const t = useTranslations('tickets');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const res = await action();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>{t('status')}</Label>
        <Select
          value={status}
          disabled={isPending}
          onValueChange={(v) =>
            run(() => setTicketStatusAction({ ticketId, status: v }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t('assignee')}</Label>
        <Select
          value={assignedTo ?? UNASSIGNED}
          disabled={isPending}
          onValueChange={(v) =>
            run(() =>
              assignTicketAction({
                ticketId,
                adminUserId: v === UNASSIGNED ? null : v,
              }),
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>{t('unassigned')}</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
