/**
 * Mini App sign-in (tasks.md B1): the client posts the raw
 * `window.Telegram.WebApp.initData`; we validate it against THIS tenant's
 * bot token, and when the Telegram user is a registered customer we issue
 * the TWA session cookie. Registration itself stays in the bot (SPEC §3.1)
 * — this endpoint never creates customers.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { planIncludes } from '@kargotrack/shared';

import { validateInitData } from '@/lib/twa/init-data';
import { getTwaCustomerByTg, getTwaTenant } from '@/lib/twa/queries';
import {
  createTwaSessionToken,
  TWA_COOKIE_NAME,
  TWA_MAX_AGE_SECONDS,
} from '@/lib/twa/session';

const schema = z.object({
  tenantId: z.string().uuid(),
  initData: z.string().min(1).max(8192),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const tenant = await getTwaTenant(parsed.data.tenantId);
  if (!tenant || !planIncludes(tenant.plan, 'miniapp')) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const identity = validateInitData(parsed.data.initData, tenant.botToken);
  if (!identity) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const customer = await getTwaCustomerByTg(tenant.id, identity.tgUserId);
  if (!customer) {
    // Valid Telegram user, but not a customer yet → send them to the bot.
    return NextResponse.json({
      ok: true,
      registered: false,
      botUsername: tenant.botUsername,
    });
  }

  // The Mini App page and this API are same-origin inside Telegram's webview,
  // so 'lax' works exactly like it does for the panel.
  cookies().set(TWA_COOKIE_NAME, createTwaSessionToken(tenant.id, customer.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/m',
    maxAge: TWA_MAX_AGE_SECONDS,
  });
  return NextResponse.json({ ok: true, registered: true });
}
