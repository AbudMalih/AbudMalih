-- =============================================================================
-- Hosted verification of TURVIO staging (tenant isolation, depot isolation,
-- API-role privileges, catalog checks). Runs as ONE plpgsql block with
-- synthetic fixtures and ALWAYS ends with an exception, so every row it
-- inserted (incl. the synthetic auth.users) is rolled back – nothing persists.
-- The results are the exception message: TURVIO_VERIFY {"pass": n, "fail": n, "checks": [...]}
-- Safe to run repeatedly. Uses only synthetic ids (prefix 7e57) and
-- example.invalid e-mail addresses.
-- =============================================================================
do $verify$
declare
  org_a  uuid := '7e570000-0000-4000-8000-00000000a001';
  org_b  uuid := '7e570000-0000-4000-8000-00000000b001';
  u_own_a uuid := '7e570000-0000-4000-8000-0000000000a1';
  u_dsp_a uuid := '7e570000-0000-4000-8000-0000000000a2';  -- dispatcher limited to depot A1
  u_drv_a uuid := '7e570000-0000-4000-8000-0000000000a3';
  u_own_b uuid := '7e570000-0000-4000-8000-0000000000b1';
  u_out   uuid := '7e570000-0000-4000-8000-0000000000e1';
  dep_a1 uuid := '7e570000-0000-4000-8000-0000000d00a1';
  dep_a2 uuid := '7e570000-0000-4000-8000-0000000d00a2';
  dep_b  uuid := '7e570000-0000-4000-8000-0000000d00b1';
  drv_a  uuid := '7e570000-0000-4000-8000-0000000100a1';
  t_a1 uuid := '7e570000-0000-4000-8000-0000000700a1';  -- driver A's tour, depot A1
  t_a2 uuid := '7e570000-0000-4000-8000-0000000700a2';  -- unassigned tour, depot A1
  t_a3 uuid := '7e570000-0000-4000-8000-0000000700a3';  -- depot A2
  t_b  uuid := '7e570000-0000-4000-8000-0000000700b1';
  m_dsp uuid;
  checks jsonb := '[]';
  n int;
  ok boolean;
  pass int := 0;
  fail int := 0;
begin
  -- ---------- fixtures (as the migration owner) ----------
  insert into auth.users (id, email) values
    (u_own_a, 'owner-a@turvio-verify.example.invalid'), (u_dsp_a, 'dispatch-a@turvio-verify.example.invalid'),
    (u_drv_a, 'driver-a@turvio-verify.example.invalid'), (u_own_b, 'owner-b@turvio-verify.example.invalid'),
    (u_out, 'outsider@turvio-verify.example.invalid');
  insert into public.organizations (id, name, slug, status) values
    (org_a, 'Verify Tenant A (synthetic)', 'verify-a-7e57', 'active'),
    (org_b, 'Verify Tenant B (synthetic)', 'verify-b-7e57', 'active');
  insert into public.subscriptions (organization_id, plan_code, status, seats) values
    (org_a, 'business', 'active', 10), (org_b, 'business', 'active', 10);
  insert into public.memberships (organization_id, user_id, role) values
    (org_a, u_own_a, 'owner'), (org_a, u_drv_a, 'driver'), (org_b, u_own_b, 'owner');
  insert into public.memberships (organization_id, user_id, role) values (org_a, u_dsp_a, 'dispatcher') returning id into m_dsp;
  insert into public.depots (id, organization_id, name, street, postal_code, city, lat, lng) values
    (dep_a1, org_a, 'Verify A1', 'Teststraße', '30159', 'Hannover', 52.37, 9.73),
    (dep_a2, org_a, 'Verify A2', 'Teststraße', '30159', 'Hannover', 52.38, 9.74),
    (dep_b,  org_b, 'Verify B',  'Teststraße', '04109', 'Leipzig', 51.34, 12.37);
  insert into public.membership_depots (organization_id, membership_id, depot_id) values (org_a, m_dsp, dep_a1);
  insert into public.drivers (id, organization_id, user_id, depot_id, display_name) values (drv_a, org_a, u_drv_a, dep_a1, 'Verify Driver');
  insert into public.tours (id, organization_id, depot_id, driver_id, name, tour_date, published_at) values
    (t_a1, org_a, dep_a1, drv_a, 'V-A1', current_date, now()),
    (t_a2, org_a, dep_a1, null,  'V-A2', current_date, null),
    (t_a3, org_a, dep_a2, null,  'V-A3', current_date, null),
    (t_b,  org_b, dep_b,  null,  'V-B',  current_date, null);
  insert into public.stops (organization_id, tour_id, sequence, recipient_name, street, postal_code, city, lat, lng) values
    (org_a, t_a1, 0, 'Synthetic A1', 'Teststraße', '30159', 'Hannover', 52.37, 9.73),
    (org_a, t_a3, 0, 'Synthetic A3', 'Teststraße', '30159', 'Hannover', 52.38, 9.74),
    (org_b, t_b,  0, 'Synthetic B',  'Teststraße', '04109', 'Leipzig', 51.34, 12.37);

  -- ---------- tenant + depot isolation as `authenticated` ----------
  -- driver A: own published tour only
  perform set_config('request.jwt.claims', json_build_object('sub', u_drv_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_drv_a::text, true);
  set local role authenticated;
  select count(*) into n from public.tours where id in (t_a1, t_a2, t_a3, t_b);
  reset role;
  ok := n = 1; checks := checks || jsonb_build_object('check', 'driver sees only own tour', 'ok', ok, 'detail', n || ' tours');

  -- dispatcher limited to depot A1
  perform set_config('request.jwt.claims', json_build_object('sub', u_dsp_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_dsp_a::text, true);
  set local role authenticated;
  select count(*) into n from public.tours where id in (t_a1, t_a2, t_a3, t_b);
  reset role;
  ok := n = 2; checks := checks || jsonb_build_object('check', 'depot-scoped dispatcher sees depot A1 tours only', 'ok', ok, 'detail', n || ' tours (expected 2)');
  set local role authenticated;
  select count(*) into n from public.stops where tour_id = t_a3;
  reset role;
  ok := n = 0; checks := checks || jsonb_build_object('check', 'depot-scoped dispatcher cannot read depot A2 stops', 'ok', ok, 'detail', n || ' stops');

  -- owner B: nothing of tenant A, cannot modify tenant A
  perform set_config('request.jwt.claims', json_build_object('sub', u_own_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_own_b::text, true);
  set local role authenticated;
  select (select count(*) from public.organizations where id = org_a) + (select count(*) from public.depots where organization_id = org_a)
       + (select count(*) from public.tours where organization_id = org_a) + (select count(*) from public.stops where organization_id = org_a)
       + (select count(*) from public.memberships where organization_id = org_a) into n;
  update public.stops set recipient_name = 'tampered' where organization_id = org_a;
  reset role;
  checks := checks || jsonb_build_object('check', 'tenant B reads no tenant A rows', 'ok', n = 0, 'detail', n || ' rows');
  select count(*) into n from public.stops where recipient_name = 'tampered';
  checks := checks || jsonb_build_object('check', 'tenant B cannot update tenant A stops', 'ok', n = 0, 'detail', n || ' rows changed');

  -- outsider (authenticated, no membership)
  perform set_config('request.jwt.claims', json_build_object('sub', u_out, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_out::text, true);
  set local role authenticated;
  select (select count(*) from public.organizations where id in (org_a, org_b)) + (select count(*) from public.tours where id in (t_a1, t_a2, t_a3, t_b)) into n;
  reset role;
  checks := checks || jsonb_build_object('check', 'user without membership sees nothing', 'ok', n = 0, 'detail', n || ' rows');

  -- ---------- privileges ----------
  set local role anon;
  begin
    perform 1 from public.tours limit 1;
    ok := false;
  exception
    when insufficient_privilege then ok := true;
    when others then ok := false;
  end;
  reset role;
  checks := checks || jsonb_build_object('check', 'anon cannot read tables', 'ok', ok);

  perform set_config('request.jwt.claims', json_build_object('sub', u_own_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    execute 'truncate public.stops';  -- inside the always-rolled-back block
    ok := false;
  exception
    when insufficient_privilege then ok := true;
    when others then ok := false;      -- passed the privilege check (e.g. stopped only by a foreign key)
  end;
  reset role;
  checks := checks || jsonb_build_object('check', 'authenticated cannot TRUNCATE (bypasses RLS)', 'ok', ok);

  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  checks := checks || jsonb_build_object('check', 'RLS enabled on every public table', 'ok', n = 0, 'detail', n || ' without RLS');

  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname in ('public', 'app', 'geo') and c.relkind = 'r'
     and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'TRUNCATE')
          or has_table_privilege('authenticated', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRIGGER'));
  checks := checks || jsonb_build_object('check', 'no anon table access, no TRUNCATE/TRIGGER for authenticated', 'ok', n = 0, 'detail', n || ' tables');

  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname in ('public', 'app', 'geo') and c.relkind = 'r' and pg_get_userbyid(c.relowner) <> 'postgres';
  checks := checks || jsonb_build_object('check', 'TURVIO tables owned by postgres', 'ok', n = 0, 'detail', n || ' other owners');

  select count(*) into n from pg_roles where rolname = 'turvio_service' and not rolbypassrls and not rolsuper and rolcanlogin;
  checks := checks || jsonb_build_object('check', 'turvio_service exists, login, no RLS bypass', 'ok', n = 1);

  if to_regclass('storage.buckets') is not null then
    execute $q$select count(*) from storage.buckets where id = 'proofs' and public = false and file_size_limit = 5242880$q$ into n;
    checks := checks || jsonb_build_object('check', 'proofs bucket private, 5 MB', 'ok', n = 1);
    execute $q$select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and (roles && array['anon','authenticated','public']::name[])$q$ into n;
    checks := checks || jsonb_build_object('check', 'no storage.objects policies for anon/authenticated', 'ok', n = 0, 'detail', n || ' policies');
  end if;

  select count(*) filter (where (c ->> 'ok')::boolean), count(*) filter (where not (c ->> 'ok')::boolean) into pass, fail from jsonb_array_elements(checks) c;
  -- Always roll back: nothing above is kept.
  raise exception 'TURVIO_VERIFY %', jsonb_build_object('pass', pass, 'fail', fail, 'checks', checks)::text;
end
$verify$;
