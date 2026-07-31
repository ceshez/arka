begin;

-- Keep five decimal places for both fiat display allocation and NIM (one
-- luna). Two-decimal rounding made a $0.01 equal split assign $0.00 to one of
-- two members and incorrectly showed "No payment due".
create or replace function public.join_arka_invite(
  p_reference text,
  p_guest_key text,
  p_display_name text,
  p_wallet_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
set statement_timeout = '5s'
set lock_timeout = '2s'
as $$
declare
  v_row public.arka_invites;
  v_guest_hash text;
  v_user_id text;
  v_member_id text;
  v_members jsonb;
  v_member jsonb;
  v_updated_members jsonb := '[]'::jsonb;
  v_arka jsonb;
  v_count integer;
  v_index integer := 0;
  v_total_fiat numeric;
  v_total_nim numeric;
  v_due_fiat numeric;
  v_due_nim numeric;
  v_display_name text;
  v_wallet_address text;
begin
  if length(coalesce(p_guest_key, '')) < 64 then
    raise exception 'Invalid guest identity';
  end if;

  v_display_name := left(coalesce(nullif(trim(p_display_name), ''), 'Guest'), 40);
  v_wallet_address := nullif(left(trim(coalesce(p_wallet_address, '')), 128), '');

  select *
  into v_row
  from public.arka_invites invite
  where invite.public_token::text = lower(trim(p_reference))
     or invite.join_code = upper(
       case
         when trim(p_reference) ilike 'ARKA-%' then trim(p_reference)
         else 'ARKA-' || trim(p_reference)
       end
     )
  for update;

  if v_row.id is null then raise exception 'Arka not found'; end if;
  if v_row.expires_at <= now() then raise exception 'This Arka invite has expired'; end if;
  if coalesce(v_row.arka->>'status', '') not in ('open', 'collecting') then
    raise exception 'Arka not found';
  end if;

  v_guest_hash := encode(digest(p_guest_key, 'sha256'), 'hex');
  v_user_id := 'user-guest-' || substr(v_guest_hash, 1, 20);
  v_member_id := 'member-guest-' || substr(v_guest_hash, 1, 20);
  v_members := coalesce(v_row.arka->'members', '[]'::jsonb);

  if exists (
    select 1
    from jsonb_array_elements(v_members) member
    where member->>'userId' = v_user_id
  ) then
    for v_member in select value from jsonb_array_elements(v_members)
    loop
      if v_member->>'userId' = v_user_id then
        v_member := v_member || jsonb_build_object('displayName', v_display_name);
        if v_wallet_address is not null then
          v_member := v_member || jsonb_build_object('walletAddress', v_wallet_address);
        end if;
      end if;
      v_updated_members := v_updated_members || jsonb_build_array(v_member);
    end loop;

    v_arka := v_row.arka || jsonb_build_object(
      'members', v_updated_members,
      'invite', coalesce(v_row.arka->'invite', '{}'::jsonb) || jsonb_build_object(
        'version', coalesce((v_row.arka#>>'{invite,version}')::integer, 1) + 1
      ),
      'updatedAt', now()
    );

    update public.arka_invites
    set arka = v_arka, updated_at = now()
    where id = v_row.id;

    return jsonb_build_object('arka', v_arka, 'memberId', v_member_id);
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_members) member
    where coalesce((member->>'amountPaidFiat')::numeric, 0) > 0
       or coalesce((member->>'amountPaidNim')::numeric, 0) > 0
       or coalesce((member->>'amountPaidUsdt')::numeric, 0) > 0
  ) then
    raise exception 'Membership is locked after contributions begin';
  end if;

  v_member := jsonb_build_object(
    'id', v_member_id,
    'userId', v_user_id,
    'arkaId', v_row.arka->>'id',
    'displayName', v_display_name,
    'role', 'guest',
    'walletAddress', v_wallet_address,
    'amountDueFiat', 0,
    'amountDueNim', 0,
    'amountDueUsdt', 0,
    'amountPaidFiat', 0,
    'amountPaidNim', 0,
    'amountPaidUsdt', 0,
    'status', 'joined',
    'joinedAt', now()
  );
  v_members := v_members || jsonb_build_array(v_member);

  if v_row.arka->>'splitMethod' = 'equal' then
    v_count := jsonb_array_length(v_members);
    v_total_fiat := (v_row.arka->>'totalFiat')::numeric;
    v_total_nim := (v_row.arka->>'totalNimEstimate')::numeric;

    for v_member in select value from jsonb_array_elements(v_members)
    loop
      v_index := v_index + 1;
      v_due_fiat := case
        when v_index = v_count then round(v_total_fiat - (round(v_total_fiat / v_count, 5) * (v_count - 1)), 5)
        else round(v_total_fiat / v_count, 5)
      end;
      v_due_nim := case
        when v_index = v_count then round(v_total_nim - (round(v_total_nim / v_count, 5) * (v_count - 1)), 5)
        else round(v_total_nim / v_count, 5)
      end;
      v_member := v_member || jsonb_build_object(
        'amountDueFiat', v_due_fiat,
        'amountDueNim', v_due_nim,
        'amountDueUsdt', v_due_fiat,
        'status', case when v_due_nim >= 0.00001 or v_due_fiat > 0 then 'pending' else 'joined' end
      );
      v_updated_members := v_updated_members || jsonb_build_array(v_member);
    end loop;
  else
    v_updated_members := v_members;
  end if;

  v_arka := v_row.arka || jsonb_build_object(
    'members', v_updated_members,
    'invite', coalesce(v_row.arka->'invite', '{}'::jsonb) || jsonb_build_object(
      'version', coalesce((v_row.arka#>>'{invite,version}')::integer, 1) + 1
    ),
    'updatedAt', now()
  );

  update public.arka_invites
  set arka = v_arka, updated_at = now()
  where id = v_row.id;

  return jsonb_build_object('arka', v_arka, 'memberId', v_member_id);
end;
$$;

revoke all on function public.join_arka_invite(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.join_arka_invite(text, text, text, text)
  to anon;

comment on function public.join_arka_invite(text, text, text, text) is
  'Security reviewed: intentionally anon-executable invite RPC. Stable guest identity controls member updates; equal splits retain five-decimal micro-payment precision.';

-- The host contribution already resides in the host wallet. Recording it as
-- covered avoids an invalid wallet-to-itself transaction.
create or replace function public.mark_arka_host_share_covered(
  p_public_token uuid,
  p_host_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
set statement_timeout = '5s'
set lock_timeout = '2s'
as $$
declare
  v_row public.arka_invites;
  v_member jsonb;
  v_members jsonb := '[]'::jsonb;
  v_arka jsonb;
  v_all_paid boolean;
  v_paid_at timestamptz := now();
begin
  select *
  into v_row
  from public.arka_invites invite
  where invite.public_token = p_public_token
  for update;

  if v_row.id is null
     or encode(digest(coalesce(p_host_secret, ''), 'sha256'), 'hex') <> v_row.host_secret_hash then
    raise exception 'Arka not found';
  end if;
  if coalesce(v_row.arka->>'status', '') in ('completed', 'cancelled', 'expired') then
    raise exception 'This Arka is closed';
  end if;

  for v_member in
    select value from jsonb_array_elements(coalesce(v_row.arka->'members', '[]'::jsonb))
  loop
    if v_member->>'role' = 'host' or v_member->>'userId' = v_row.arka->>'hostId' then
      v_member := v_member || jsonb_build_object(
        'status', case
          when coalesce((v_member->>'amountDueNim')::numeric, 0) > 0 then 'paid'
          else coalesce(v_member->>'status', 'joined')
        end,
        'amountPaidFiat', coalesce((v_member->>'amountDueFiat')::numeric, 0),
        'amountPaidNim', coalesce((v_member->>'amountDueNim')::numeric, 0),
        'amountPaidUsdt', 0,
        'paidAt', v_paid_at
      );
    end if;
    v_members := v_members || jsonb_build_array(v_member);
  end loop;

  v_all_paid := not exists (
    select 1
    from jsonb_array_elements(v_members) member
    where coalesce((member->>'amountDueNim')::numeric, 0)
      - coalesce((member->>'amountPaidNim')::numeric, 0) >= 0.00001
  );

  v_arka := v_row.arka || jsonb_build_object(
    'members', v_members,
    'contributionAsset', coalesce(nullif(v_row.arka->>'contributionAsset', ''), 'NIM'),
    'status', case when v_all_paid then 'ready-to-settle' else 'collecting' end,
    'invite', coalesce(v_row.arka->'invite', '{}'::jsonb) || jsonb_build_object(
      'version', coalesce((v_row.arka#>>'{invite,version}')::integer, 1) + 1
    ),
    'updatedAt', v_paid_at
  );

  update public.arka_invites
  set arka = v_arka, updated_at = v_paid_at
  where id = v_row.id;

  return jsonb_build_object('arka', v_arka);
end;
$$;

revoke all on function public.mark_arka_host_share_covered(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_arka_host_share_covered(uuid, text)
  to anon;

comment on function public.mark_arka_host_share_covered(uuid, text) is
  'Security reviewed: intentionally anon-executable host action protected by the 256-bit host secret; records funds already held by the host without a self-payment.';

create table public.cashback_claims (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.arka_invites(id) on delete cascade,
  arka_id text not null check (char_length(arka_id) between 8 and 128),
  arka_code text not null check (arka_code ~ '^ARKA-[A-F0-9]{8}$'),
  member_id text not null check (char_length(member_id) between 8 and 128),
  installation_hash text not null check (installation_hash ~ '^[a-f0-9]{64}$'),
  recipient_wallet_address text not null check (char_length(recipient_wallet_address) between 36 and 128),
  contribution_tx_hash text not null unique check (contribution_tx_hash ~ '^[a-f0-9]{64}$'),
  contribution_fiat numeric(20,5) not null check (contribution_fiat > 0),
  contribution_nim numeric(20,5) not null check (contribution_nim > 0),
  reward_fiat numeric(20,5) not null check (reward_fiat > 0 and reward_fiat <= 0.30000),
  reward_nim numeric(20,5) not null check (reward_nim >= 0.00001),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  payout_tx_hash text unique check (payout_tx_hash is null or payout_tx_hash ~ '^[a-f0-9]{64}$'),
  payout_block_number bigint check (payout_block_number is null or payout_block_number > 0),
  claimed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (invite_id, member_id)
);

create index cashback_claims_invite_id_idx
  on public.cashback_claims (invite_id);
create index cashback_claims_pending_idx
  on public.cashback_claims (claimed_at)
  where status = 'pending';
create index cashback_claims_daily_installation_idx
  on public.cashback_claims (installation_hash, claimed_at)
  where status in ('pending', 'confirmed');
create index cashback_claims_daily_wallet_idx
  on public.cashback_claims (recipient_wallet_address, claimed_at)
  where status in ('pending', 'confirmed');

alter table public.cashback_claims enable row level security;
revoke all on table public.cashback_claims from anon, authenticated;
grant select, insert, update on table public.cashback_claims to service_role;

create or replace function public.claim_arka_cashback(
  p_reference text,
  p_guest_key text,
  p_installation_key text,
  p_transaction_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
set statement_timeout = '5s'
set lock_timeout = '2s'
as $$
declare
  v_row public.arka_invites;
  v_member jsonb;
  v_member_id text;
  v_installation_hash text;
  v_wallet text;
  v_paid_fiat numeric;
  v_paid_nim numeric;
  v_eligible_fiat numeric;
  v_reward_fiat numeric;
  v_reward_nim numeric;
  v_arka_remaining numeric;
  v_daily_remaining numeric;
  v_claim public.cashback_claims;
  v_day_start timestamptz := date_trunc('day', now());
begin
  if length(coalesce(p_guest_key, '')) < 64 then
    raise exception 'Invalid guest identity';
  end if;
  if length(coalesce(p_installation_key, '')) not between 32 and 256 then
    raise exception 'Invalid installation identity';
  end if;
  if lower(trim(coalesce(p_transaction_hash, ''))) !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid transaction reference';
  end if;

  select *
  into v_row
  from public.arka_invites invite
  where invite.public_token::text = lower(trim(p_reference))
     or invite.join_code = upper(
       case
         when trim(p_reference) ilike 'ARKA-%' then trim(p_reference)
         else 'ARKA-' || trim(p_reference)
       end
     )
  for update;
  if v_row.id is null then raise exception 'Arka not found'; end if;

  v_member_id := 'member-guest-' || substr(encode(digest(p_guest_key, 'sha256'), 'hex'), 1, 20);
  select value
  into v_member
  from jsonb_array_elements(coalesce(v_row.arka->'members', '[]'::jsonb))
  where value->>'id' = v_member_id and value->>'role' = 'guest'
  limit 1;
  if v_member is null then raise exception 'Arka member not found'; end if;

  select *
  into v_claim
  from public.cashback_claims claim
  where claim.invite_id = v_row.id and claim.member_id = v_member_id;
  if v_claim.id is not null then
    return jsonb_build_object('claim', to_jsonb(v_claim), 'alreadyClaimed', true);
  end if;

  v_paid_fiat := coalesce((v_member->>'amountPaidFiat')::numeric, 0);
  v_paid_nim := coalesce((v_member->>'amountPaidNim')::numeric, 0);
  v_wallet := upper(regexp_replace(coalesce(v_member->>'walletAddress', ''), '\s+', '', 'g'));
  if v_member->>'status' <> 'paid' or v_paid_fiat <= 0 or v_paid_nim <= 0 or v_wallet = '' then
    raise exception 'This contribution is not eligible for cashback';
  end if;

  v_installation_hash := encode(digest(p_installation_key, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('arka-cashback:' || v_day_start::text, 0));

  if exists (
    select 1 from public.cashback_claims claim
    where claim.claimed_at >= v_day_start
      and claim.status in ('pending', 'confirmed')
      and (claim.installation_hash = v_installation_hash or claim.recipient_wallet_address = v_wallet)
  ) then
    raise exception 'Cashback is limited to one reward per day';
  end if;

  v_eligible_fiat := least(v_paid_fiat, 10.00000);
  v_reward_fiat := round(v_eligible_fiat * 0.03, 5);
  v_reward_nim := round(v_paid_nim * (v_eligible_fiat / v_paid_fiat) * 0.03, 5);

  select greatest(0.30000 - coalesce(sum(claim.reward_fiat), 0), 0)
  into v_arka_remaining
  from public.cashback_claims claim
  where claim.invite_id = v_row.id and claim.status in ('pending', 'confirmed');

  select greatest(10.00000 - coalesce(sum(claim.reward_fiat), 0), 0)
  into v_daily_remaining
  from public.cashback_claims claim
  where claim.claimed_at >= v_day_start and claim.status in ('pending', 'confirmed');

  if least(v_reward_fiat, v_arka_remaining, v_daily_remaining) < v_reward_fiat then
    v_reward_nim := round(
      v_reward_nim * (least(v_reward_fiat, v_arka_remaining, v_daily_remaining) / v_reward_fiat),
      5
    );
    v_reward_fiat := least(v_reward_fiat, v_arka_remaining, v_daily_remaining);
  end if;
  if v_reward_fiat <= 0 or v_reward_nim < 0.00001 then
    raise exception 'The cashback limit has been reached';
  end if;

  insert into public.cashback_claims (
    invite_id,
    arka_id,
    arka_code,
    member_id,
    installation_hash,
    recipient_wallet_address,
    contribution_tx_hash,
    contribution_fiat,
    contribution_nim,
    reward_fiat,
    reward_nim
  ) values (
    v_row.id,
    v_row.arka->>'id',
    v_row.join_code,
    v_member_id,
    v_installation_hash,
    v_wallet,
    lower(trim(p_transaction_hash)),
    v_paid_fiat,
    v_paid_nim,
    v_reward_fiat,
    v_reward_nim
  )
  returning * into v_claim;

  return jsonb_build_object('claim', to_jsonb(v_claim), 'alreadyClaimed', false);
end;
$$;

create or replace function public.confirm_arka_cashback(
  p_claim_id uuid,
  p_payout_tx_hash text,
  p_block_number bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
set statement_timeout = '5s'
set lock_timeout = '2s'
as $$
declare
  v_claim public.cashback_claims;
  v_row public.arka_invites;
  v_member jsonb;
  v_members jsonb := '[]'::jsonb;
  v_arka jsonb;
  v_confirmed_at timestamptz := now();
begin
  if lower(trim(coalesce(p_payout_tx_hash, ''))) !~ '^[a-f0-9]{64}$'
     or coalesce(p_block_number, 0) <= 0 then
    raise exception 'Invalid payout transaction';
  end if;

  select *
  into v_claim
  from public.cashback_claims claim
  where claim.id = p_claim_id
  for update;
  if v_claim.id is null then raise exception 'Cashback claim not found'; end if;
  if v_claim.status = 'confirmed' then
    return jsonb_build_object('claim', to_jsonb(v_claim), 'alreadyConfirmed', true);
  end if;
  if v_claim.status <> 'pending' then raise exception 'Cashback claim is closed'; end if;

  select *
  into v_row
  from public.arka_invites invite
  where invite.id = v_claim.invite_id
  for update;

  for v_member in
    select value from jsonb_array_elements(coalesce(v_row.arka->'members', '[]'::jsonb))
  loop
    if v_member->>'id' = v_claim.member_id then
      v_member := v_member || jsonb_build_object(
        'cashbackEarnedNim', v_claim.reward_nim,
        'cashbackPaidAt', v_confirmed_at
      );
    end if;
    v_members := v_members || jsonb_build_array(v_member);
  end loop;

  v_arka := v_row.arka || jsonb_build_object(
    'members', v_members,
    'invite', coalesce(v_row.arka->'invite', '{}'::jsonb) || jsonb_build_object(
      'version', coalesce((v_row.arka#>>'{invite,version}')::integer, 1) + 1
    ),
    'updatedAt', v_confirmed_at
  );

  update public.cashback_claims
  set status = 'confirmed',
      payout_tx_hash = lower(trim(p_payout_tx_hash)),
      payout_block_number = p_block_number,
      confirmed_at = v_confirmed_at
  where id = v_claim.id
  returning * into v_claim;

  update public.arka_invites
  set arka = v_arka, updated_at = v_confirmed_at
  where id = v_row.id;

  return jsonb_build_object('claim', to_jsonb(v_claim), 'arka', v_arka, 'alreadyConfirmed', false);
end;
$$;

revoke all on function public.claim_arka_cashback(text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.confirm_arka_cashback(uuid, text, bigint)
  from public, anon, authenticated;
grant execute on function public.claim_arka_cashback(text, text, text, text)
  to service_role;
grant execute on function public.confirm_arka_cashback(uuid, text, bigint)
  to service_role;

comment on table public.cashback_claims is
  'Server-only cashback ledger. Enforces one reward per Arka member, one reward per recipient wallet or installation per UTC day, $0.30 per Arka, and $10 treasury spend per UTC day.';
comment on function public.claim_arka_cashback(text, text, text, text) is
  'Server-only claim allocator. The API must verify BotID and the mainnet contribution before calling this function.';
comment on function public.confirm_arka_cashback(uuid, text, bigint) is
  'Server-only payout confirmation. The API must verify the treasury mainnet transaction before calling this function.';

commit;
