/**
 * Thin typed access to `window.Telegram.WebApp` (tasks.md B — the deliberate
 * no-SDK decision: the surface we use is tiny, so a wrapper beats a
 * dependency). Client-side only.
 */

export interface TelegramWebApp {
  initData: string;
  colorScheme: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
  close: () => void;
  openTelegramLink: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** The WebApp bridge, or null when not running inside Telegram. */
export function telegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}
