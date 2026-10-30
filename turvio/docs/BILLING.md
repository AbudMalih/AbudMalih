# Subscriptions & billing

**Payments are not active.** Nothing in this repository charges money or talks to Stripe yet.

## Model

* **Plans** (`public.plans`, mirrored in `packages/shared/src/billing.ts`):

  | Code | Audience | Pricing model | Notes |
  |---|---|---|---|
  | `driver_solo` | individual driver | flat | 1 driver, 1 depot, 1 vehicle, 3,000 stops/month |
  | `team` | company | per driver (seats) | max 3 dispatchers, 2 depots |
  | `business` | company | per driver (seats) | no limits, API, multi-depot |

  All prices are `0` = **not set**. Pricing is a business decision.
* **Billing interval:** monthly or annual (`billing_interval`), separate monthly/annual price per plan.
* **Subscription** (one per tenant): status `trialing | active | past_due | cancelled | incomplete`, seats, trial end, current period, `cancel_at_period_end`, `limit_overrides` (enterprise deals), Stripe customer/subscription IDs (empty).
* **Effective limit** = override → seats (per-driver plans, for `max_drivers`) → plan value; `null` = unlimited.
* **Usable subscription:** active, past_due (grace period), or trialing before `trial_ends_at`.

## Enforcement

* Database trigger `app.enforce_plan_limits()` blocks creating/activating drivers, vehicles and depots beyond the limit, and blocks new resources when the subscription is not usable. Tenants cannot modify their own subscription (RLS); only platform admins or the backend (service role / future Stripe webhooks) can.
* API: `/v1/orgs/:orgId/optimize` returns `402 subscription_inactive` or `403 feature_not_in_plan`.
* Downgrades: `checkPlanChange()` refuses a downgrade while usage exceeds the target plan's limits, so no data silently becomes inaccessible.

## Stripe Billing integration plan (M7)

1. Stripe account owned by Lunapact Technologies; test mode first.
2. Products/prices per plan & interval; per-driver plans use quantity = seats. Store price IDs in `plans.stripe_price_*_id`.
3. Checkout / Customer Portal for upgrades, downgrades (with `checkPlanChange` pre-check), seat changes and cancellation (`cancel_at_period_end`).
4. Webhook endpoint in `apps/api` (signature verification, idempotency table) updates `subscriptions` with the service role: `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`.
5. Trials: Stripe trial periods mirrored into `trial_ends_at`; reminder emails before expiry.
6. Tax: Stripe Tax; EU B2B reverse charge; invoicing entity per Lunapact's legal setup.
