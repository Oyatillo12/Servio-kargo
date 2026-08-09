/**
 * Tenant-scoped database access for the bot. Every query is filtered by
 * `tenant_id` (CLAUDE.md rule 1). Handlers call these helpers and delegate all
 * decisions/formatting to `@kargotrack/shared`, so they stay thin.
 *
 * This barrel is the handlers' import surface (`./queries`); the modules behind
 * it are split by SPEC area so no single file carries the whole schema.
 */

export { isUniqueViolation } from './internal';

export * from './sessions';
export * from './tenants';
export * from './customers';
export * from './contexts';
export * from './tracks';
export * from './weighing';
export * from './staff';
