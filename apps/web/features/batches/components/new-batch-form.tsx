'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { Transport } from '@kargotrack/db/schema';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { createBatchAction } from '../actions';
import { TRANSPORTS, TRANSPORT_KEY } from '../transport';

/** New-batch form (SPEC §5.7): name, transport, ETA. */
export function NewBatchForm() {
  const t = useTranslations('batches');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<Transport>('avia');
  const [eta, setEta] = useState('');
  const [saving, startSave] = useTransition();

  function submit() {
    startSave(async () => {
      const res = await createBatchAction({
        name,
        transport,
        etaDate: eta || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('created'));
      setName('');
      setEta('');
      setTransport('avia');
      setOpen(false);
      if (res.id) router.push(`/batches/${res.id}`);
      else router.refresh();
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-full">
        <Plus className="h-4 w-4" aria-hidden />
        {t('new')}
      </Button>
    );
  }

  return (
    <SectionCard title={t('new')} className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="batch-name">{t('name')}</Label>
        <Input
          id="batch-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          autoFocus
        />
      </div>
      <div className="flex gap-2.5">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="batch-transport">{t('transport')}</Label>
          <Select
            value={transport}
            onValueChange={(v) => setTransport(v as Transport)}
          >
            <SelectTrigger id="batch-transport">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSPORTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(TRANSPORT_KEY[value])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="batch-eta">{t('eta')}</Label>
          <Input
            id="batch-eta"
            type="date"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2.5">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          {tCommon('cancel')}
        </Button>
        <Button
          className="flex-1"
          onClick={submit}
          disabled={saving || !name.trim()}
        >
          {saving ? <Spinner /> : null}
          {t('create')}
        </Button>
      </div>
    </SectionCard>
  );
}
