/**
 * Mini App URL for a tenant's keyboard (SPEC §10.1, tasks.md B7). Returns
 * undefined when the tenant is not premium OR the web origin isn't
 * configured — either way the keyboard simply renders without the button.
 * Origin: APP_URL wins, else built from DOMAIN (both in the production .env
 * the compose file hands every container).
 */

import type { Tenant } from '@kargotrack/db/schema';
import { planIncludes } from '@kargotrack/shared';

export function miniAppUrlFor(tenant: Tenant): string | undefined {
  if (!planIncludes(tenant.plan, 'miniapp')) return undefined;
  const explicit = process.env.APP_URL?.trim().replace(/\/+$/, '');
  const domain = process.env.DOMAIN?.trim();
  const origin = explicit || (domain ? `https://${domain}` : undefined);
  return origin ? `${origin}/m/${tenant.id}` : undefined;
}
