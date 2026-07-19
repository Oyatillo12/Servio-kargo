'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** App-wide toast host (brand-styled). Rendered once in the root layout. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-secondary group-[.toast]:text-slate-600',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
