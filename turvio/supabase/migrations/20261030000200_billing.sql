-- =============================================================================
-- TURVIO – SaaS plans, subscriptions and limits
--
-- Payments are NOT active. Stripe identifiers are stored once Stripe Billing is
-- connected; until then subscriptions are managed manually by platform admins
-- (trials, pilot customers). Prices below are development placeholders, not
-- an offer.
-- =============================================================================

create type public.pricing_model as enum ('flat', 'per_driver');
create type public.billing_interval as enum ('month', 'year');
create type public.plan_audience as enum ('individual_driver', 'company');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'incomplete');

create table public.plans (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  audience public.plan_audience not null,
  pricing_model public.pricing_model not null,
  -- Prices per billing interval in minor units (cents). Annual typically discounted.
  monthly_amount_cents int not null check (monthly_amount_cents >= 0),
  annual_amount_cents int not null check (annual_amount_cents >= 0),
  currency char(3) not null default 'EUR',
  trial_days int not null default 14 check (trial_days between 0 and 90),
  -- Limits; null = unlimited.
  max_drivers int check (max_drivers > 0),
  max_dispatchers int check (max_dispatchers > 0),
  max_depots int check (max_depots > 0),
  max_vehicles int check (max_vehicles > 0),
  max_stops_per_month int check (max_stops_per_month > 0),
  features jsonb not null default '{}'::jsonb,
  stripe_price_monthly_id text,
  stripe_price_annual_id text,
  active boolean not null default true,
  sort_order int not null default 0
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  plan_code text not null references public.plans (code),
  status public.subscription_status not null default 'trialing',
  billing_interval public.billing_interval not null default 'month',
  -- Purchased driver seats for per_driver plans (ignored for flat plans).
  seats int not null default 1 check (seats between 1 and 10000),
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default now() + interval '1 month',
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  -- Per-tenant overrides of plan limits (enterprise deals), e.g. {"max_drivers": 80}.
  limit_overrides jsonb not null default '{}'::jsonb,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);

-- Effective limit for a tenant: override > seats (per_driver) > plan value.
create or replace function app.effective_limit(org uuid, limit_name text) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (s.limit_overrides ->> limit_name)::int,
    case when limit_name = 'max_drivers' and p.pricing_model = 'per_driver' then s.seats end,
    (to_jsonb(p) ->> limit_name)::int
  )
  from public.subscriptions s
  join public.plans p on p.code = s.plan_code
  where s.organization_id = org;
$$;

create or replace function app.subscription_allows_writes(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where s.organization_id = org
      and (s.status = 'active'
           or (s.status = 'trialing' and (s.trial_ends_at is null or s.trial_ends_at > now()))
           or (s.status = 'past_due'))  -- grace period; dunning handled by billing job
  );
$$;

-- Enforce driver / vehicle / depot limits in the database so no client can bypass them.
create or replace function app.enforce_plan_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  limit_name text;
  lim int;
  used int;
  is_active boolean := coalesce((to_jsonb(new) ->> 'active')::boolean, true);
begin
  if not app.subscription_allows_writes(new.organization_id) then
    raise exception 'subscription inactive for organization' using errcode = 'P0001', hint = 'subscription_inactive';
  end if;
  limit_name := case tg_table_name
    when 'drivers' then 'max_drivers'
    when 'vehicles' then 'max_vehicles'
    when 'depots' then 'max_depots'
  end;
  lim := app.effective_limit(new.organization_id, limit_name);
  if lim is null then
    return new;
  end if;
  execute format('select count(*) from public.%I where organization_id = $1 and id <> $2 %s',
                 tg_table_name, case when tg_table_name = 'depots' then '' else 'and active' end)
    into used using new.organization_id, new.id;
  if used >= lim and is_active then
    raise exception 'plan limit % reached (%)', limit_name, lim using errcode = 'P0001', hint = 'plan_limit_reached';
  end if;
  return new;
end;
$$;

create trigger limits_drivers before insert or update of active on public.drivers
  for each row execute function app.enforce_plan_limits();
create trigger limits_vehicles before insert or update of active on public.vehicles
  for each row execute function app.enforce_plan_limits();
create trigger limits_depots before insert on public.depots
  for each row execute function app.enforce_plan_limits();

create trigger audit_subscriptions after insert or update or delete on public.subscriptions
  for each row execute function app.audit();

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

create policy plans_select on public.plans for select to authenticated using (active or app.is_platform_admin());
create policy plans_admin on public.plans for all to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());

-- Tenants can read their subscription; changes go through the backend
-- (service role / Stripe webhooks) or platform admins.
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (app.is_org_admin(organization_id) or app.is_platform_admin());
create policy subscriptions_admin on public.subscriptions for all to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());

revoke all on public.plans, public.subscriptions from anon;
grant select, insert, update, delete on public.plans, public.subscriptions to authenticated;
revoke execute on all functions in schema app from public;
grant execute on function app.effective_limit(uuid, text), app.subscription_allows_writes(uuid) to authenticated;

-- Development plan catalogue (placeholder prices – NOT final pricing).
insert into public.plans (code, name, audience, pricing_model, monthly_amount_cents, annual_amount_cents,
                          max_drivers, max_dispatchers, max_depots, max_vehicles, max_stops_per_month, features, sort_order)
values
  ('driver_solo', 'Driver Solo', 'individual_driver', 'flat', 0, 0, 1, null, 1, 1, 3000,
   '{"optimization": true, "scanning": true, "dispatch": false}', 10),
  ('team', 'Team', 'company', 'per_driver', 0, 0, null, 3, 2, null, null,
   '{"optimization": true, "scanning": true, "dispatch": true, "reports": true}', 20),
  ('business', 'Business', 'company', 'per_driver', 0, 0, null, null, null, null, null,
   '{"optimization": true, "scanning": true, "dispatch": true, "reports": true, "api": true, "multi_depot": true}', 30);
