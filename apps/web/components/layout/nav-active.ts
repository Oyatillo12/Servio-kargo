'use client';

import { usePathname } from 'next/navigation';

/** True when `href` is the current section (the route itself or a child of it). */
export function useIsActive(href: string): boolean {
  const pathname = usePathname();
  return pathname === href || pathname.startsWith(`${href}/`);
}
