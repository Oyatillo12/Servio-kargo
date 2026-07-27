import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Panel buttons (design screen 1e): 6px radius, filled indigo for the one
 * action that matters on a screen, a bordered white button for everything
 * else. `default` is sized for a thumb (44px); `xs` is the 32px desktop
 * density used in header rows and card actions.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'border border-primary bg-primary text-primary-foreground hover:bg-primary-hover hover:border-primary-hover',
        destructive:
          'border border-destructive/25 bg-white text-destructive hover:bg-destructive/5',
        outline:
          'border border-input bg-white font-medium text-foreground hover:border-faint',
        secondary:
          'border border-transparent bg-secondary font-medium text-foreground hover:bg-n-200',
        ghost: 'font-medium text-muted-foreground hover:bg-secondary hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 py-2',
        xs: 'h-8 px-3 text-[13px]',
        sm: 'h-9 px-3 text-[13px]',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
