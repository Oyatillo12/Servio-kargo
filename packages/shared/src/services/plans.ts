/**
 * Subscription tiers. Like `permissions.ts` answers "may this ROLE do that?",
 * this module is the ONLY place that answers "does this tenant's PLAN include
 * that feature?" — panel, bot and future Mini App all ask here, so a tier
 * change is one edit.
 *
 * Every tenant starts on `basic` (the current full product). `premium` is the
 * monetization ladder the roadmap builds toward: the Telegram Mini App
 * cabinet, online debt payment, the bonus program and delivery requests ship
 * gated on it. Gating exists BEFORE those features do, so each one lands
 * behind a flag instead of retrofitting one later.
 */

export const TENANT_PLANS = ['basic', 'premium'] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];

export type PlanFeature =
  | 'miniapp'
  | 'online_payments'
  | 'bonus'
  | 'delivery_requests';

/** Lowest tier that unlocks each feature. */
const FEATURE_MIN_PLAN: Record<PlanFeature, TenantPlan> = {
  miniapp: 'premium',
  online_payments: 'premium',
  bonus: 'premium',
  delivery_requests: 'premium',
};

/** Tiers are ordered: a higher tier includes everything below it. */
const PLAN_RANK: Record<TenantPlan, number> = {
  basic: 0,
  premium: 1,
};

export function planIncludes(plan: TenantPlan, feature: PlanFeature): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}

/** Display names — the /sa console and (later) plan-aware UI read these. */
export const PLAN_LABELS: Record<TenantPlan, string> = {
  basic: 'Basic',
  premium: 'Premium',
};
