/**
 * Mini App URL for a tenant's keyboard (SPEC §10.1, tasks.md B7). Returns
 * undefined when the tenant is not premium OR the web origin isn't
 * configured — either way the keyboard simply renders without the button.
 * Origin: APP_URL wins, else built from DOMAIN (both in the production .env
 * the compose file hands every container).
 */

import type { Tenant } from '@kargotrack/db/schema';
import { planIncludes } from '@kargotrack/shared';

/** The cabinet screens a bot answer can hand off to (SPEC §10.2). */
export type MiniAppSection = 'tracks' | 'finance' | 'calc' | 'card';

export function miniAppUrlFor(
  tenant: Tenant,
  /**
   * Deep-links straight to a screen (D-012): a bot answer that has just shown
   * a summary offers to open the full thing where it actually lives, instead
   * of growing another paging flow inside the chat.
   */
  section?: MiniAppSection,
): string | undefined {
  if (!planIncludes(tenant.plan, 'miniapp')) return undefined;
  const explicit = process.env.APP_URL?.trim().replace(/\/+$/, '');
  const domain = process.env.DOMAIN?.trim();
  const origin = explicit || (domain ? `https://${domain}` : undefined);
  if (!origin) return undefined;
  const base = `${origin}/m/${tenant.id}`;
  return section ? `${base}/${section}` : base;
}
