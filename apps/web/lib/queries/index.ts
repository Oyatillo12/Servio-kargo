/**
 * Tenant-scoped database access for the admin panel. EVERY query filters by the
 * caller-supplied `tenantId` (CLAUDE.md rule 1) — that id always comes from the
 * session (`requireAdmin`), never from user input.
 *
 * This barrel is the panel's import surface (`@/lib/queries`); the modules
 * behind it are split by SPEC area so no single file carries the whole schema.
 */

import 'server-only';

export { CUSTOMER_PICKER_LIMIT, type CustomerOption } from '../customer-types';

export type { TrackFilter } from './track-filter';

export * from './throttle';
export * from './tracks';
export * from './track-pricing';
export * from './track-mutations';
export * from './exports';
export * from './customers';
export * from './customer-refs';
export * from './settings';
export * from './tariffs';
export * from './broadcasts';
export * from './batches';
export * from './import';
export * from './dashboard';
export * from './team';
export * from './actors';
