import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Data-table primitives for the desktop list views.
 *
 * `Table` supplies its own horizontal scroll container: a wide table inside the
 * panel's `max-w-5xl` main column must scroll *itself*, never the page body.
 */
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="overflow-x-auto rounded-xl border border-border bg-white">
    <table
      ref={ref}
      className={cn('w-full border-collapse text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn(className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn(className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }
>(({ className, selected, ...props }, ref) => (
  <tr
    ref={ref}
    data-state={selected ? 'selected' : undefined}
    className={cn(
      'border-b border-[#eef0f4] transition-colors last:border-0',
      selected ? 'bg-[#f3f5fb]' : 'hover:bg-secondary/60',
      className,
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn('px-3 py-2.5 text-left font-semibold', className)}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

/** The header row's shared band styling — apply to the `<tr>` inside `thead`. */
const tableHeadRowClass =
  'border-b border-border bg-secondary text-[11px] uppercase tracking-wide text-muted-foreground';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-3 py-2.5 align-middle', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  tableHeadRowClass,
};
