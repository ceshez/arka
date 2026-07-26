begin;

-- Analytics is intentionally isolated from the browser-facing public schema.
-- The Mini App can only append validated events through one narrow RPC. Internal
-- reads require the service_role and must happen from a private dashboard or
-- another trusted server-side environment.
create schema if not exists analytics;

revoke all on schema analytics from public, anon, authenticated;
grant usage on schema analytics to service_role;

create table if not exists analytics.events (
  event_id uuid primary key default gen_random_uuid(),
  dedupe_key text unique,
  event_name text not null check (
    event_name in (
      'app_opened',
      'screen_viewed',
      'demo_started',
      'create_started',
      'arka_created',
      'invite_viewed',
      'invite_shared',
      'invite_opened',
      'join_started',
      'join_succeeded',
      'join_failed',
      'payment_summary_viewed',
      'payment_started',
      'payment_confirmed',
      'payment_failed',
      'payment_cancelled',
      'arka_ready_to_settle',
      'settlement_started',
      'settlement_confirmed',
      'settlement_failed',
      'settlement_cancelled',
      'arka_completed',
      'success_card_shared',
      'error_occurred'
    )
  ),
  event_version smallint not null default 1 check (event_version between 1 and 100),
  source text not null default 'client' check (source in ('client', 'database', 'backfill')),
  installation_hash text check (
    installation_hash is null or installation_hash ~ '^[a-f0-9]{64}$'
  ),
  session_id uuid,
  arka_id text check (arka_id is null or char_length(arka_id) between 1 and 96),
  actor_role text check (actor_role is null or actor_role in ('host', 'guest')),
  arka_type text check (arka_type is null or arka_type in ('tab', 'vault', 'demo')),
  category text check (
    category is null or category in ('dinner', 'cafe', 'trip', 'gift', 'event', 'roommates', 'custom')
  ),
  split_method text check (
    split_method is null or split_method in ('equal', 'custom', 'by-consumption', 'sponsor')
  ),
  invite_method text check (
    invite_method is null or invite_method in ('native-share', 'clipboard', 'qr', 'link', 'code', 'unknown')
  ),
  asset text check (asset is null or asset in ('NIM', 'USDT')),
  payment_type text check (
    payment_type is null or payment_type in ('member-contribution', 'host-merchant-settlement', 'refund')
  ),
  payment_status text check (
    payment_status is null
    or payment_status in ('preparing', 'awaiting-user-confirmation', 'submitted', 'confirmed', 'failed', 'cancelled')
  ),
  error_code text check (
    error_code is null or error_code ~ '^[a-z0-9][a-z0-9-]{0,63}$'
  ),
  route text check (route is null or char_length(route) between 1 and 128),
  app_surface text check (app_surface is null or app_surface in ('nimiq-pay', 'browser')),
  app_version text check (app_version is null or char_length(app_version) between 1 and 32),
  environment text check (environment is null or environment in ('development', 'test', 'production')),
  amount_fiat numeric(20, 2) check (amount_fiat is null or amount_fiat between 0 and 1000000000000),
  amount_nim numeric(30, 8) check (amount_nim is null or amount_nim between 0 and 1000000000000000000000),
  amount_usdt numeric(30, 6) check (amount_usdt is null or amount_usdt between 0 and 1000000000000),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 604800000),
  member_count integer check (member_count is null or member_count between 0 and 1000),
  is_demo boolean not null default false,
  properties jsonb not null default '{}'::jsonb check (
    jsonb_typeof(properties) = 'object'
    and octet_length(properties::text) <= 4096
  ),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  check (dedupe_key is null or char_length(dedupe_key) between 8 and 256)
);

create index if not exists analytics_events_occurred_at_idx
  on analytics.events (occurred_at desc);
create index if not exists analytics_events_name_occurred_at_idx
  on analytics.events (event_name, occurred_at desc);
create index if not exists analytics_events_arka_occurred_at_idx
  on analytics.events (arka_id, occurred_at)
  where arka_id is not null;
create index if not exists analytics_events_installation_occurred_at_idx
  on analytics.events (installation_hash, occurred_at desc)
  where installation_hash is not null;
create index if not exists analytics_events_error_occurred_at_idx
  on analytics.events (error_code, occurred_at desc)
  where error_code is not null;

alter table analytics.events enable row level security;
revoke all on table analytics.events from public, anon, authenticated;
grant select on table analytics.events to service_role;

create table if not exists analytics.kpi_definitions (
  metric_key text primary key check (metric_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  display_name text not null check (char_length(display_name) between 3 and 80),
  description text not null check (char_length(description) between 10 and 500),
  formula text not null check (char_length(formula) between 3 and 500),
  unit text not null check (unit in ('count', 'percent', 'seconds', 'USD', 'NIM', 'USDT')),
  is_primary boolean not null default false,
  source_view text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table analytics.kpi_definitions enable row level security;
revoke all on table analytics.kpi_definitions from public, anon, authenticated;
grant select on table analytics.kpi_definitions to service_role;

create table if not exists analytics.kpi_targets (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null references analytics.kpi_definitions(metric_key) on delete cascade,
  period_start date not null,
  period_end date not null,
  target_value numeric(30, 8) not null,
  comparison text not null check (comparison in ('at-least', 'at-most', 'equal')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (metric_key, period_start, period_end)
);

create index if not exists analytics_kpi_targets_period_idx
  on analytics.kpi_targets (period_start, period_end);

alter table analytics.kpi_targets enable row level security;
revoke all on table analytics.kpi_targets from public, anon, authenticated;
grant select, insert, update, delete on table analytics.kpi_targets to service_role;

insert into analytics.kpi_definitions (
  metric_key,
  display_name,
  description,
  formula,
  unit,
  is_primary,
  source_view
) values
  (
    'active_installations',
    'Active installations',
    'Distinct pseudonymous installations that generated at least one event during the reporting period.',
    'count(distinct installation_hash)',
    'count',
    false,
    'analytics.daily_kpis'
  ),
  (
    'arkas_created',
    'Arkas created',
    'Distinct non-duplicate Arkas created during the reporting period.',
    'count(distinct arka_id where event_name = arka_created)',
    'count',
    false,
    'analytics.daily_kpis'
  ),
  (
    'arka_activation_rate',
    'Arka activation rate',
    'Share of created Arkas that reached at least one successful guest join.',
    'activated_arkas / arkas_created * 100',
    'percent',
    true,
    'analytics.funnel_kpis'
  ),
  (
    'arka_completion_rate_7d',
    '7-day Arka completion rate',
    'Share of mature Arka cohorts that completed within seven days of creation.',
    'arkas_completed_within_7d / eligible_arkas * 100',
    'percent',
    true,
    'analytics.funnel_kpis'
  ),
  (
    'payment_success_rate',
    'Payment success rate',
    'Share of member contribution payment attempts that ended confirmed.',
    'payment_confirmed / payment_started * 100',
    'percent',
    true,
    'analytics.daily_kpis'
  ),
  (
    'nim_payment_share',
    'NIM payment share',
    'Share of confirmed payments completed with NIM instead of USDT.',
    'confirmed_nim_payments / confirmed_payments * 100',
    'percent',
    true,
    'analytics.daily_kpis'
  ),
  (
    'confirmed_nim_volume',
    'Confirmed NIM volume',
    'Total NIM amount represented by confirmed member contributions.',
    'sum(amount_nim where event_name = payment_confirmed)',
    'NIM',
    false,
    'analytics.daily_kpis'
  ),
  (
    'settled_nim_volume',
    'Settled NIM volume',
    'Total NIM amount represented by confirmed host-to-merchant settlements.',
    'sum(amount_nim where event_name = settlement_confirmed)',
    'NIM',
    false,
    'analytics.daily_kpis'
  ),
  (
    'median_completion_seconds',
    'Median Arka completion time',
    'Median elapsed time from Arka creation to completed merchant settlement.',
    'median(completed_at - created_at)',
    'seconds',
    false,
    'analytics.funnel_kpis'
  ),
  (
    'error_rate',
    'Error rate',
    'Share of tracked client events that represent an error or failed operation.',
    'error_events / all_client_events * 100',
    'percent',
    false,
    'analytics.daily_kpis'
  )
on conflict (metric_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  formula = excluded.formula,
  unit = excluded.unit,
  is_primary = excluded.is_primary,
  source_view = excluded.source_view,
  updated_at = now();

create or replace function public.record_analytics_event(
  p_event_name text,
  p_installation_key text,
  p_session_id uuid,
  p_event_id uuid default null,
  p_occurred_at timestamptz default now(),
  p_arka_id text default null,
  p_actor_role text default null,
  p_arka_type text default null,
  p_category text default null,
  p_split_method text default null,
  p_invite_method text default null,
  p_asset text default null,
  p_payment_type text default null,
  p_payment_status text default null,
  p_error_code text default null,
  p_route text default null,
  p_app_surface text default null,
  p_app_version text default null,
  p_environment text default null,
  p_amount_fiat numeric default null,
  p_amount_nim numeric default null,
  p_amount_usdt numeric default null,
  p_duration_ms integer default null,
  p_member_count integer default null,
  p_is_demo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_installation_hash text;
  v_event_id uuid := coalesce(p_event_id, gen_random_uuid());
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_inserted integer := 0;
begin
  if p_event_name is null or p_event_name not in (
    'app_opened',
    'screen_viewed',
    'demo_started',
    'create_started',
    'invite_viewed',
    'invite_shared',
    'invite_opened',
    'join_started',
    'join_failed',
    'payment_summary_viewed',
    'payment_started',
    'payment_confirmed',
    'payment_failed',
    'payment_cancelled',
    'arka_ready_to_settle',
    'settlement_started',
    'settlement_confirmed',
    'settlement_failed',
    'settlement_cancelled',
    'arka_completed',
    'success_card_shared',
    'error_occurred'
  ) then
    raise exception 'Unsupported analytics event';
  end if;

  if char_length(coalesce(p_installation_key, '')) not between 32 and 256 then
    raise exception 'Invalid analytics installation key';
  end if;
  if p_session_id is null then
    raise exception 'Invalid analytics session';
  end if;
  if v_occurred_at < now() - interval '7 days'
     or v_occurred_at > now() + interval '5 minutes' then
    raise exception 'Invalid analytics event time';
  end if;
  if p_arka_id is not null and char_length(p_arka_id) not between 1 and 96 then
    raise exception 'Invalid analytics Arka id';
  end if;
  if p_route is not null and (
    char_length(p_route) not between 1 and 128
    or position('?' in p_route) > 0
    or position('#' in p_route) > 0
  ) then
    raise exception 'Invalid analytics route';
  end if;

  v_installation_hash := encode(extensions.digest(p_installation_key, 'sha256'), 'hex');

  if (
    select count(*)
    from analytics.events event
    where event.installation_hash = v_installation_hash
      and event.received_at >= now() - interval '1 minute'
  ) >= 120 then
    return jsonb_build_object('accepted', false, 'reason', 'rate-limited');
  end if;

  insert into analytics.events (
    event_id,
    event_name,
    source,
    installation_hash,
    session_id,
    arka_id,
    actor_role,
    arka_type,
    category,
    split_method,
    invite_method,
    asset,
    payment_type,
    payment_status,
    error_code,
    route,
    app_surface,
    app_version,
    environment,
    amount_fiat,
    amount_nim,
    amount_usdt,
    duration_ms,
    member_count,
    is_demo,
    occurred_at
  ) values (
    v_event_id,
    p_event_name,
    'client',
    v_installation_hash,
    p_session_id,
    nullif(trim(p_arka_id), ''),
    p_actor_role,
    p_arka_type,
    p_category,
    p_split_method,
    p_invite_method,
    p_asset,
    p_payment_type,
    p_payment_status,
    p_error_code,
    p_route,
    p_app_surface,
    p_app_version,
    p_environment,
    p_amount_fiat,
    p_amount_nim,
    p_amount_usdt,
    p_duration_ms,
    p_member_count,
    coalesce(p_is_demo, false),
    v_occurred_at
  )
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return jsonb_build_object('accepted', true, 'inserted', v_inserted = 1);
end;
$$;

revoke all on function public.record_analytics_event(
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  integer,
  boolean
) from public, anon, authenticated;
grant execute on function public.record_analytics_event(
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  integer,
  boolean
) to anon;

alter function public.record_analytics_event(
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  integer,
  boolean
) set statement_timeout to '5s';

comment on function public.record_analytics_event(
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  integer,
  boolean
) is
  'Append-only, validated analytics ingestion. Stores a one-way installation hash and never accepts wallet addresses, transaction hashes, names, invite tokens, or free-form client JSON.';

create or replace function analytics.safe_timestamptz(
  p_value text,
  p_fallback timestamptz
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if nullif(trim(p_value), '') is null then
    return p_fallback;
  end if;
  return p_value::timestamptz;
exception
  when others then
    return p_fallback;
end;
$$;

revoke all on function analytics.safe_timestamptz(text, timestamptz)
  from public, anon, authenticated;

create or replace function analytics.capture_arka_invite_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arka_id text := coalesce(new.arka->>'id', new.id::text);
  v_new_status text := coalesce(new.arka->>'status', '');
  v_old_status text := case when tg_op = 'UPDATE' then coalesce(old.arka->>'status', '') else '' end;
  v_member jsonb;
  v_member_count integer := case
    when jsonb_typeof(new.arka->'members') = 'array'
      then jsonb_array_length(new.arka->'members')
    else 0
  end;
begin
  if tg_op = 'INSERT' then
    insert into analytics.events (
      dedupe_key,
      event_name,
      source,
      arka_id,
      actor_role,
      arka_type,
      category,
      split_method,
      member_count,
      is_demo,
      occurred_at
    ) values (
      'db:arka-created:' || v_arka_id,
      'arka_created',
      'database',
      v_arka_id,
      'host',
      new.arka->>'type',
      new.arka#>>'{metadata,category}',
      new.arka->>'splitMethod',
      v_member_count,
      coalesce(new.arka#>>'{metadata,isDemo}', 'false') = 'true',
      analytics.safe_timestamptz(new.arka->>'createdAt', new.created_at)
    )
    on conflict do nothing;
  end if;

  if tg_op = 'UPDATE' then
    for v_member in
      select member.value
      from jsonb_array_elements(
        case
          when jsonb_typeof(new.arka->'members') = 'array' then new.arka->'members'
          else '[]'::jsonb
        end
      ) member
      where member.value->>'role' = 'guest'
        and not exists (
          select 1
          from jsonb_array_elements(
            case
              when jsonb_typeof(old.arka->'members') = 'array' then old.arka->'members'
              else '[]'::jsonb
            end
          ) old_member
          where old_member.value->>'id' = member.value->>'id'
        )
    loop
      insert into analytics.events (
        dedupe_key,
        event_name,
        source,
        arka_id,
        actor_role,
        arka_type,
        category,
        split_method,
        member_count,
        is_demo,
        occurred_at
      ) values (
        'db:join-succeeded:' || v_arka_id || ':' || coalesce(v_member->>'id', md5(v_member::text)),
        'join_succeeded',
        'database',
        v_arka_id,
        'guest',
        new.arka->>'type',
        new.arka#>>'{metadata,category}',
        new.arka->>'splitMethod',
        v_member_count,
        coalesce(new.arka#>>'{metadata,isDemo}', 'false') = 'true',
        analytics.safe_timestamptz(v_member->>'joinedAt', new.updated_at)
      )
      on conflict do nothing;
    end loop;
  end if;

  if v_new_status = 'ready-to-settle' and v_old_status is distinct from v_new_status then
    insert into analytics.events (
      dedupe_key,
      event_name,
      source,
      arka_id,
      actor_role,
      arka_type,
      category,
      split_method,
      member_count,
      is_demo,
      occurred_at
    ) values (
      'db:arka-ready:' || v_arka_id,
      'arka_ready_to_settle',
      'database',
      v_arka_id,
      'host',
      new.arka->>'type',
      new.arka#>>'{metadata,category}',
      new.arka->>'splitMethod',
      v_member_count,
      coalesce(new.arka#>>'{metadata,isDemo}', 'false') = 'true',
      new.updated_at
    )
    on conflict do nothing;
  end if;

  if v_new_status = 'completed' and v_old_status is distinct from v_new_status then
    insert into analytics.events (
      dedupe_key,
      event_name,
      source,
      arka_id,
      actor_role,
      arka_type,
      category,
      split_method,
      asset,
      payment_type,
      payment_status,
      member_count,
      is_demo,
      occurred_at
    ) values (
      'db:arka-completed:' || v_arka_id,
      'arka_completed',
      'database',
      v_arka_id,
      'host',
      new.arka->>'type',
      new.arka#>>'{metadata,category}',
      new.arka->>'splitMethod',
      new.arka->>'selectedAsset',
      'host-merchant-settlement',
      'confirmed',
      v_member_count,
      coalesce(new.arka#>>'{metadata,isDemo}', 'false') = 'true',
      analytics.safe_timestamptz(new.arka->>'completedAt', new.updated_at)
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function analytics.capture_arka_invite_lifecycle()
  from public, anon, authenticated;

drop trigger if exists capture_arka_invite_lifecycle on public.arka_invites;
create trigger capture_arka_invite_lifecycle
after insert or update of arka on public.arka_invites
for each row execute function analytics.capture_arka_invite_lifecycle();

-- Backfill the lifecycle facts already present in the existing JSON snapshots.
insert into analytics.events (
  dedupe_key,
  event_name,
  source,
  arka_id,
  actor_role,
  arka_type,
  category,
  split_method,
  member_count,
  is_demo,
  occurred_at
)
select
  'db:arka-created:' || coalesce(invite.arka->>'id', invite.id::text),
  'arka_created',
  'backfill',
  coalesce(invite.arka->>'id', invite.id::text),
  'host',
  invite.arka->>'type',
  invite.arka#>>'{metadata,category}',
  invite.arka->>'splitMethod',
  case
    when jsonb_typeof(invite.arka->'members') = 'array'
      then jsonb_array_length(invite.arka->'members')
    else 0
  end,
  coalesce(invite.arka#>>'{metadata,isDemo}', 'false') = 'true',
  analytics.safe_timestamptz(invite.arka->>'createdAt', invite.created_at)
from public.arka_invites invite
on conflict do nothing;

insert into analytics.events (
  dedupe_key,
  event_name,
  source,
  arka_id,
  actor_role,
  arka_type,
  category,
  split_method,
  member_count,
  is_demo,
  occurred_at
)
select
  'db:join-succeeded:' || coalesce(invite.arka->>'id', invite.id::text) || ':' || coalesce(member.value->>'id', md5(member.value::text)),
  'join_succeeded',
  'backfill',
  coalesce(invite.arka->>'id', invite.id::text),
  'guest',
  invite.arka->>'type',
  invite.arka#>>'{metadata,category}',
  invite.arka->>'splitMethod',
  jsonb_array_length(invite.arka->'members'),
  coalesce(invite.arka#>>'{metadata,isDemo}', 'false') = 'true',
  analytics.safe_timestamptz(member.value->>'joinedAt', invite.created_at)
from public.arka_invites invite
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(invite.arka->'members') = 'array' then invite.arka->'members'
    else '[]'::jsonb
  end
) member
where member.value->>'role' = 'guest'
on conflict do nothing;

insert into analytics.events (
  dedupe_key,
  event_name,
  source,
  arka_id,
  actor_role,
  arka_type,
  category,
  split_method,
  asset,
  payment_type,
  payment_status,
  amount_fiat,
  amount_nim,
  amount_usdt,
  member_count,
  is_demo,
  occurred_at
)
select
  'backfill:payment-confirmed:' || coalesce(invite.arka->>'id', invite.id::text) || ':' || coalesce(member.value->>'id', md5(member.value::text)),
  'payment_confirmed',
  'backfill',
  coalesce(invite.arka->>'id', invite.id::text),
  member.value->>'role',
  invite.arka->>'type',
  invite.arka#>>'{metadata,category}',
  invite.arka->>'splitMethod',
  case
    when coalesce((member.value->>'amountPaidNim')::numeric, 0) > 0 then 'NIM'
    else 'USDT'
  end,
  'member-contribution',
  'confirmed',
  coalesce((member.value->>'amountPaidFiat')::numeric, 0),
  nullif(coalesce((member.value->>'amountPaidNim')::numeric, 0), 0),
  nullif(coalesce((member.value->>'amountPaidUsdt')::numeric, 0), 0),
  jsonb_array_length(invite.arka->'members'),
  coalesce(invite.arka#>>'{metadata,isDemo}', 'false') = 'true',
  analytics.safe_timestamptz(member.value->>'paidAt', invite.updated_at)
from public.arka_invites invite
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(invite.arka->'members') = 'array' then invite.arka->'members'
    else '[]'::jsonb
  end
) member
where member.value->>'status' in ('paid', 'settled')
  and (
    coalesce((member.value->>'amountPaidFiat')::numeric, 0) > 0
    or coalesce((member.value->>'amountPaidNim')::numeric, 0) > 0
    or coalesce((member.value->>'amountPaidUsdt')::numeric, 0) > 0
  )
on conflict do nothing;

insert into analytics.events (
  dedupe_key,
  event_name,
  source,
  arka_id,
  actor_role,
  arka_type,
  category,
  split_method,
  asset,
  payment_type,
  payment_status,
  member_count,
  is_demo,
  occurred_at
)
select
  'db:arka-completed:' || coalesce(invite.arka->>'id', invite.id::text),
  'arka_completed',
  'backfill',
  coalesce(invite.arka->>'id', invite.id::text),
  'host',
  invite.arka->>'type',
  invite.arka#>>'{metadata,category}',
  invite.arka->>'splitMethod',
  invite.arka->>'selectedAsset',
  'host-merchant-settlement',
  'confirmed',
  case
    when jsonb_typeof(invite.arka->'members') = 'array'
      then jsonb_array_length(invite.arka->'members')
    else 0
  end,
  coalesce(invite.arka#>>'{metadata,isDemo}', 'false') = 'true',
  analytics.safe_timestamptz(invite.arka->>'completedAt', invite.updated_at)
from public.arka_invites invite
where invite.arka->>'status' = 'completed'
on conflict do nothing;

create or replace view analytics.arka_lifecycle
with (security_invoker = true)
as
select
  event.arka_id,
  min(event.occurred_at) filter (where event.event_name = 'arka_created') as created_at,
  min(event.occurred_at) filter (where event.event_name = 'invite_shared') as first_invite_shared_at,
  min(event.occurred_at) filter (where event.event_name = 'join_succeeded') as first_join_succeeded_at,
  min(event.occurred_at) filter (where event.event_name = 'payment_started') as first_payment_started_at,
  min(event.occurred_at) filter (where event.event_name = 'payment_confirmed') as first_payment_confirmed_at,
  min(event.occurred_at) filter (where event.event_name = 'arka_ready_to_settle') as ready_to_settle_at,
  min(event.occurred_at) filter (where event.event_name = 'settlement_started') as settlement_started_at,
  min(event.occurred_at) filter (
    where event.event_name in ('settlement_confirmed', 'arka_completed')
  ) as completed_at,
  count(*) filter (where event.event_name = 'join_succeeded') as successful_joins,
  count(*) filter (where event.event_name = 'payment_started') as payment_attempts,
  count(*) filter (where event.event_name = 'payment_confirmed') as confirmed_member_payments,
  count(*) filter (where event.event_name = 'payment_failed') as failed_member_payments,
  count(*) filter (
    where event.event_name = 'payment_confirmed' and event.asset = 'NIM'
  ) as confirmed_nim_member_payments,
  coalesce(sum(event.amount_nim) filter (
    where event.event_name = 'payment_confirmed'
  ), 0) as confirmed_nim_contribution_amount,
  coalesce(sum(event.amount_usdt) filter (
    where event.event_name = 'payment_confirmed'
  ), 0) as confirmed_usdt_contribution_amount,
  coalesce(sum(event.amount_nim) filter (
    where event.event_name = 'settlement_confirmed'
  ), 0) as settled_nim_amount,
  coalesce(sum(event.amount_usdt) filter (
    where event.event_name = 'settlement_confirmed'
  ), 0) as settled_usdt_amount,
  max(event.member_count) as max_member_count,
  max(event.arka_type) as arka_type,
  max(event.category) as category,
  max(event.split_method) as split_method,
  bool_or(event.is_demo) as is_demo
from analytics.events event
where event.arka_id is not null
group by event.arka_id;

create or replace view analytics.daily_kpis
with (security_invoker = true)
as
with daily as (
  select
    event.occurred_at::date as day,
    count(*) as all_events,
    count(*) filter (where event.source = 'client') as client_events,
    count(distinct event.installation_hash) filter (
      where event.installation_hash is not null
    ) as active_installations,
    count(distinct event.session_id) filter (
      where event.session_id is not null
    ) as sessions,
    count(*) filter (where event.event_name = 'app_opened') as app_opens,
    count(distinct event.arka_id) filter (
      where event.event_name = 'arka_created'
    ) as arkas_created,
    count(*) filter (where event.event_name = 'invite_shared') as invites_shared,
    count(*) filter (where event.event_name = 'join_succeeded') as successful_joins,
    count(*) filter (where event.event_name = 'payment_started') as payment_attempts,
    count(*) filter (where event.event_name = 'payment_confirmed') as confirmed_payments,
    count(*) filter (where event.event_name = 'payment_failed') as failed_payments,
    count(*) filter (where event.event_name = 'payment_cancelled') as cancelled_payments,
    count(*) filter (
      where event.event_name = 'payment_confirmed' and event.asset = 'NIM'
    ) as confirmed_nim_payments,
    count(*) filter (
      where event.event_name = 'payment_confirmed' and event.asset = 'USDT'
    ) as confirmed_usdt_payments,
    count(distinct event.arka_id) filter (
      where event.event_name = 'arka_ready_to_settle'
    ) as arkas_ready_to_settle,
    count(*) filter (where event.event_name = 'settlement_started') as settlement_attempts,
    count(*) filter (where event.event_name = 'settlement_confirmed') as confirmed_settlements,
    count(distinct event.arka_id) filter (
      where event.event_name = 'arka_completed'
    ) as arkas_completed,
    count(*) filter (
      where event.event_name in (
        'join_failed',
        'payment_failed',
        'settlement_failed',
        'error_occurred'
      )
    ) as error_events,
    coalesce(sum(event.amount_fiat) filter (
      where event.event_name = 'payment_confirmed'
    ), 0) as confirmed_fiat_volume,
    coalesce(sum(event.amount_nim) filter (
      where event.event_name = 'payment_confirmed'
    ), 0) as confirmed_nim_volume,
    coalesce(sum(event.amount_usdt) filter (
      where event.event_name = 'payment_confirmed'
    ), 0) as confirmed_usdt_volume,
    coalesce(sum(event.amount_fiat) filter (
      where event.event_name = 'settlement_confirmed'
    ), 0) as settled_fiat_volume,
    coalesce(sum(event.amount_nim) filter (
      where event.event_name = 'settlement_confirmed'
    ), 0) as settled_nim_volume,
    coalesce(sum(event.amount_usdt) filter (
      where event.event_name = 'settlement_confirmed'
    ), 0) as settled_usdt_volume
  from analytics.events event
  group by event.occurred_at::date
)
select
  daily.*,
  round(100.0 * daily.confirmed_payments / nullif(daily.payment_attempts, 0), 2)
    as payment_success_rate,
  round(100.0 * daily.confirmed_nim_payments / nullif(daily.confirmed_payments, 0), 2)
    as nim_payment_share,
  round(100.0 * daily.error_events / nullif(daily.client_events, 0), 2)
    as error_rate
from daily;

create or replace view analytics.funnel_kpis
with (security_invoker = true)
as
select
  lifecycle.created_at::date as cohort_day,
  count(*) as arkas_created,
  count(*) filter (where lifecycle.first_invite_shared_at is not null) as arkas_with_invite_shared,
  count(*) filter (where lifecycle.first_join_succeeded_at is not null) as activated_arkas,
  count(*) filter (where lifecycle.first_payment_started_at is not null) as arkas_with_payment_attempt,
  count(*) filter (where lifecycle.first_payment_confirmed_at is not null) as arkas_with_confirmed_payment,
  count(*) filter (where lifecycle.ready_to_settle_at is not null) as arkas_ready_to_settle,
  count(*) filter (where lifecycle.completed_at is not null) as arkas_completed,
  count(*) filter (
    where lifecycle.created_at <= now() - interval '7 days'
  ) as eligible_arkas_for_7d,
  count(*) filter (
    where lifecycle.completed_at is not null
      and lifecycle.completed_at <= lifecycle.created_at + interval '7 days'
  ) as arkas_completed_within_7d,
  round(
    100.0 * count(*) filter (where lifecycle.first_join_succeeded_at is not null)
      / nullif(count(*), 0),
    2
  ) as activation_rate,
  round(
    100.0 * count(*) filter (
      where lifecycle.completed_at is not null
        and lifecycle.completed_at <= lifecycle.created_at + interval '7 days'
    )
      / nullif(count(*) filter (
        where lifecycle.created_at <= now() - interval '7 days'
      ), 0),
    2
  ) as completion_rate_7d,
  percentile_cont(0.5) within group (
    order by extract(epoch from lifecycle.completed_at - lifecycle.created_at)
  ) filter (where lifecycle.completed_at is not null) as median_completion_seconds
from analytics.arka_lifecycle lifecycle
where lifecycle.created_at is not null
group by lifecycle.created_at::date;

create or replace view analytics.error_kpis
with (security_invoker = true)
as
select
  event.occurred_at::date as day,
  event.event_name,
  coalesce(event.error_code, 'unknown-error') as error_code,
  coalesce(event.route, 'unknown') as route,
  coalesce(event.app_surface, 'browser') as app_surface,
  coalesce(event.environment, 'production') as environment,
  count(*) as occurrences,
  count(distinct event.installation_hash) filter (
    where event.installation_hash is not null
  ) as affected_installations
from analytics.events event
where event.event_name in (
  'join_failed',
  'payment_failed',
  'settlement_failed',
  'error_occurred'
)
group by
  event.occurred_at::date,
  event.event_name,
  coalesce(event.error_code, 'unknown-error'),
  coalesce(event.route, 'unknown'),
  coalesce(event.app_surface, 'browser'),
  coalesce(event.environment, 'production');

revoke all on analytics.arka_lifecycle from public, anon, authenticated;
revoke all on analytics.daily_kpis from public, anon, authenticated;
revoke all on analytics.funnel_kpis from public, anon, authenticated;
revoke all on analytics.error_kpis from public, anon, authenticated;
grant select on analytics.arka_lifecycle to service_role;
grant select on analytics.daily_kpis to service_role;
grant select on analytics.funnel_kpis to service_role;
grant select on analytics.error_kpis to service_role;

create or replace function public.get_internal_analytics_snapshot(
  p_from date default current_date - 29,
  p_to date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Invalid analytics date range';
  end if;
  if p_to - p_from > 366 then
    raise exception 'Analytics date range cannot exceed 366 days';
  end if;

  select jsonb_build_object(
    'generatedAt', now(),
    'from', p_from,
    'to', p_to,
    'daily', coalesce((
      select jsonb_agg(to_jsonb(row_data) order by row_data.day)
      from (
        select *
        from analytics.daily_kpis
        where day between p_from and p_to
      ) row_data
    ), '[]'::jsonb),
    'funnel', coalesce((
      select jsonb_agg(to_jsonb(row_data) order by row_data.cohort_day)
      from (
        select *
        from analytics.funnel_kpis
        where cohort_day between p_from and p_to
      ) row_data
    ), '[]'::jsonb),
    'errors', coalesce((
      select jsonb_agg(
        to_jsonb(row_data)
        order by row_data.day, row_data.occurrences desc
      )
      from (
        select *
        from analytics.error_kpis
        where day between p_from and p_to
      ) row_data
    ), '[]'::jsonb),
    'lifecycle', coalesce((
      select jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc)
      from (
        select *
        from analytics.arka_lifecycle
        where created_at::date between p_from and p_to
        order by created_at desc
        limit 500
      ) row_data
    ), '[]'::jsonb),
    'definitions', coalesce((
      select jsonb_agg(to_jsonb(definition) order by definition.metric_key)
      from analytics.kpi_definitions definition
    ), '[]'::jsonb),
    'targets', coalesce((
      select jsonb_agg(to_jsonb(target) order by target.period_start, target.metric_key)
      from analytics.kpi_targets target
      where target.period_end >= p_from
        and target.period_start <= p_to
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_internal_analytics_snapshot(date, date)
  from public, anon, authenticated;
grant execute on function public.get_internal_analytics_snapshot(date, date)
  to service_role;
alter function public.get_internal_analytics_snapshot(date, date)
  set statement_timeout to '15s';

comment on function public.get_internal_analytics_snapshot(date, date) is
  'Private dashboard read model. Call only from a trusted server with the Supabase service role; never expose that key in the Mini App.';

alter default privileges for role postgres in schema analytics
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema analytics
  revoke execute on functions from public, anon, authenticated;

commit;
