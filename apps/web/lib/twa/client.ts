/**
 * Thin typed access to `window.Telegram.WebApp` (SPEC §10.3 — the deliberate
 * no-SDK decision: the surface we use is tiny, so a wrapper beats a
 * dependency). Client-side only.
 */

export interface TelegramThemeParams {
  bg_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
  hint_color?: string;
}

export interface TelegramBackButton {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

export interface TelegramWebApp {
  initData: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  ready: () => void;
  expand: () => void;
  close: () => void;
  openTelegramLink: (url: string) => void;
  onEvent: (event: 'themeChanged', cb: () => void) => void;
  offEvent: (event: 'themeChanged', cb: () => void) => void;
  BackButton?: TelegramBackButton;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
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

/** Light tap feedback — silently a no-op outside Telegram. */
export function haptic(style: 'light' | 'medium' = 'light'): void {
  try {
    telegramWebApp()?.HapticFeedback?.impactOccurred(style);
  } catch {
    /* older clients */
  }
}
