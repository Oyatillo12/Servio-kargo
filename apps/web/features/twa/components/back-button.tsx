'use client';

/**
 * Binds Telegram's NATIVE header back button to a route (SPEC §10.3) — the
 * platform-correct way back, freeing the screen from in-page back links.
 * Outside Telegram (or on old clients) it renders nothing and screens keep
 * their small fallback link.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { haptic, telegramWebApp } from '@/lib/twa/client';

export function TelegramBack({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    const back = telegramWebApp()?.BackButton;
    if (!back) return;
    const onClick = () => {
      haptic();
      router.push(href);
    };
    back.onClick(onClick);
    back.show();
    return () => {
      back.offClick(onClick);
      back.hide();
    };
  }, [href, router]);

  return null;
}
