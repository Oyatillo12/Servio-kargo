'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

/**
 * Lets a page put its primary actions into the global top bar on phones.
 *
 * On desktop a page's actions sit in its own title row, next to the <h1>. That
 * row is the first thing to go when the viewport is 380px wide: three buttons
 * either wrap onto a second line or scroll sideways, and either way the action
 * the admin came for is no longer where their thumb already is. Hoisting them
 * into the sticky bar keeps them reachable from anywhere on the page, including
 * after scrolling through 40 tracks.
 *
 * `AppHeader` renders the outlet; a page renders `HeaderActions` with whatever
 * belongs there. A portal rather than a layout prop because the actions are
 * interactive client components owned by the page, and the layout is a Server
 * Component that must not import them.
 */
const OUTLET_ID = 'app-header-actions';

/** Mount point inside the top bar. Mobile only — desktop keeps actions in-page. */
export function HeaderActionsOutlet() {
  return (
    <div id={OUTLET_ID} className="flex flex-none items-center gap-1 md:hidden" />
  );
}

export function HeaderActions({ children }: { children: React.ReactNode }) {
  const [outlet, setOutlet] = React.useState<HTMLElement | null>(null);

  // The outlet is rendered by the layout, i.e. it exists before this effect
  // runs; the state hop is only here to keep the first render server-safe.
  React.useEffect(() => {
    setOutlet(document.getElementById(OUTLET_ID));
  }, []);

  return outlet ? createPortal(children, outlet) : null;
}
