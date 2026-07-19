'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { createBatchAction } from './actions';

type Transport = 'avia' | 'avto' | 'train';

const TRANSPORTS: { value: Transport; label: string }[] = [
  { value: 'avia', label: 'Avia' },
  { value: 'avto', label: 'Avto' },
  { value: 'train', label: 'Poyezd' },
];

/** Yangi reys form (SPEC §5.7): name, transport, ETA. */
export function NewBatchForm() {
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
      toast.success('Reys yaratildi');
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
        <Plus className="h-4 w-4" />
        Yangi reys
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-white p-3.5">
      <h2 className="text-[13.5px] font-semibold">Yangi reys</h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="batch-name">Nomi</Label>
        <Input
          id="batch-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="AVIA-21.07"
        />
      </div>
      <div className="flex gap-2.5">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label>Transport</Label>
          <Select value={transport} onValueChange={(v) => setTransport(v as Transport)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSPORTS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="batch-eta">ETA</Label>
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
          Bekor qilish
        </Button>
        <Button className="flex-1" onClick={submit} disabled={saving}>
          {saving ? 'Saqlanmoqda…' : 'Yaratish'}
        </Button>
      </div>
    </div>
  );
}
