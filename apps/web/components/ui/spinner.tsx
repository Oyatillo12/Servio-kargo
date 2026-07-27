import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Inline pending indicator for buttons and toolbars.
 *
 * Buttons across the panel signalled work by swapping their label for
 * "Saving…", which changes the button's width mid-click and moves whatever sits
 * next to it. Pairing this with a stable label keeps the layout still.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('h-4 w-4 animate-spin', className)}
      aria-hidden
      role="presentation"
    />
  );
}
