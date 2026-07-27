/**
 * Demo-request leads from the public landing page. Platform-level like
 * `lib/sa-queries.ts` — a lead is a cargo company that is not a tenant yet,
 * so nothing here is tenant-scoped. Viewed only on the /sa console.
 */

import 'server-only';

import { desc } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { leads, type Lead, type NewLead } from '@kargotrack/db/schema';

export async function insertLead(input: NewLead): Promise<void> {
  const db = getDb();
  await db.insert(leads).values(input);
}

/** Newest first for the /sa console. */
export async function listLeadsForSa(limit = 100): Promise<Lead[]> {
  const db = getDb();
  return db.select().from(leads).orderBy(desc(leads.createdAt)).limit(limit);
}

const TG_TIMEOUT_MS = 10_000;

/**
 * Forward a new lead to the platform owner's Telegram chat. Optional wiring:
 * silently a no-op unless LEADS_BOT_TOKEN and LEADS_CHAT_ID are set. Never
 * throws — the lead is already in the database; losing the ping must not
 * surface an error to the visitor.
 */
export async function notifyLeadTelegram(lead: {
  name: string;
  phone: string;
  company: string | null;
  locale: string;
}): Promise<void> {
  const token = process.env.LEADS_BOT_TOKEN?.trim();
  const chatId = process.env.LEADS_CHAT_ID?.trim();
  if (!token || !chatId) return;

  const text = [
    '🔔 Yangi demo soʼrovi — kargotrack.uz',
    `👤 ${lead.name}`,
    `📞 ${lead.phone}`,
    lead.company ? `🏢 ${lead.company}` : null,
    `🌐 til: ${lead.locale}`,
  ]
    .filter(Boolean)
    .join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TG_TIMEOUT_MS);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch {
    // Fire-and-forget by design.
  } finally {
    clearTimeout(timer);
  }
}
