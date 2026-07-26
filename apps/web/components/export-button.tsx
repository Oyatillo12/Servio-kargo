import { Download } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * "⬇️ Excel" download link (AUDIT.md T2). A plain `<a download>` rather than a
 * client component: the route handler streams the file back, so there is no
 * state to hold and the button keeps working with JS disabled.
 *
 * `prefetch` is irrelevant here (it's not a `next/link`), but `download` matters
 * — without it a browser that can preview .xlsx would navigate away from the
 * panel instead of saving.
 */
export function ExportButton({
  href,
  label = 'Excel',
  className,
}: {
  /** `/api/export/...` URL, already carrying the screen's current filters. */
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      download
      className={cn(
        buttonVariants({ variant: 'secondary', size: 'sm' }),
        className,
      )}
      title="Joriy ro'yxatni Excel faylga yuklab olish"
    >
      <Download className="h-4 w-4" />
      {label}
    </a>
  );
}
