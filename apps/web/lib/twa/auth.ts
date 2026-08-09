/**
 * Mini App page guard (tasks.md B1). Every TWA server component calls
 * `getTwaContext(params.tenantId)` first and branches on the result — the
 * same discipline as `requireCapability` in the panel: the guard is the
 * control, the UI is a courtesy.
 */

import 'server-only';

import { cache } from 'react';

import { cookies } from 'next/headers';

import { planIncludes } from '@kargotrack/shared';
import type { Customer } from '@kargotrack/db/schema';

import { getTwaCustomerById, getTwaTenant, type TwaTenant } from './queries';
import { TWA_COOKIE_NAME, verifyTwaSessionToken } from './session';

export type TwaGate =
  /** Signed in, premium tenant — render the cabinet. */
  | { state: 'ok'; tenant: TwaTenant; customer: Customer }
  /** No/invalid cookie (or cookie for another tenant) — run initData auth. */
  | { state: 'unauthenticated'; tenant: TwaTenant }
  /** Tenant exists but is on basic — show the "not enabled" screen. */
  | { state: 'not_premium'; tenant: TwaTenant }
  /** Unknown tenant id in the path. */
  | { state: 'not_found' };

/** Cached per request — layout and page both gate without double queries. */
export const getTwaContext = cache(_getTwaContext);

async function _getTwaContext(tenantId: string): Promise<TwaGate> {
  const tenant = await getTwaTenant(tenantId);
  if (!tenant) return { state: 'not_found' };
  if (!planIncludes(tenant.plan, 'miniapp')) {
    return { state: 'not_premium', tenant };
  }

  const claims = verifyTwaSessionToken(
    cookies().get(TWA_COOKIE_NAME)?.value,
  );
  // The token pins its tenant; one issued in another tenant's app is not ours.
  if (!claims || claims.tenantId !== tenant.id) {
    return { state: 'unauthenticated', tenant };
  }

  const customer = await getTwaCustomerById(tenant.id, claims.customerId);
  if (!customer) return { state: 'unauthenticated', tenant };

  return { state: 'ok', tenant, customer };
}
