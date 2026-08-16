import * as React from 'react';

import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Multi-line input matching `Input`'s border, focus ring and disabled states.
 *
 * The panel had four hand-rolled `<textarea className="…">` blocks (broadcast,
 * China address template, info text, import paste) that had already drifted
 * apart — two used `focus:border-primary`, two used `focus-visible:ring-ring`.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex w-full resize-y rounded-md border border-input bg-surface px-3 py-2.5 text-body text-foreground ring-offset-background transition-colors placeholder:text-faint focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
