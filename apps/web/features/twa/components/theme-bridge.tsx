'use client';

/**
 * Copies Telegram's live theme into CSS custom properties and stamps
 * `data-twa-theme` on <html>, so `twa.css` surfaces follow the chat the app
 * was opened from (SPEC §10.3). Renders nothing; safe outside Telegram
 * (falls back to the light tokens baked into the CSS).
 */

import { useEffect } from 'react';

import { telegramWebApp } from '@/lib/twa/client';

function applyTheme(): void {
  const webApp = telegramWebApp();
  if (!webApp) return;
  const root = document.documentElement;
  root.dataset.twaTheme = webApp.colorScheme === 'dark' ? 'dark' : 'light';

  const p = webApp.themeParams ?? {};
  const map: Record<string, string | undefined> = {
    '--tg-theme-bg-color': p.bg_color,
    '--tg-theme-secondary-bg-color': p.secondary_bg_color,
    '--tg-theme-text-color': p.text_color,
    '--tg-theme-hint-color': p.hint_color,
  };
  for (const [name, value] of Object.entries(map)) {
    if (value) root.style.setProperty(name, value);
  }
}

export function ThemeBridge() {
  useEffect(() => {
    const webApp = telegramWebApp();
    applyTheme();
    webApp?.ready();
    webApp?.expand();
    webApp?.onEvent('themeChanged', applyTheme);
    return () => webApp?.offEvent('themeChanged', applyTheme);
  }, []);

  return null;
}
