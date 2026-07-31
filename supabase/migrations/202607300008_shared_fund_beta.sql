begin;

create table if not exists public.arka_contributions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.arka_invites(id) on delete cascade,
  arka_id text not null,
  member_id text not null,
  sender_address text not null,
  shared_wallet_address text not null,
  amount_luna bigint not null check (amount_luna > 0),
  memo text not null,
  transaction_hash text not null unique check (transaction_hash ~ '^[0-9a-f]{64}$'),
  network_id integer not null check (network_id = 24),
  block_number bigint not null,
  status text not null check (status in ('pending', 'confirmed', 'rejected')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (invite_id, member_id)
);

create table if not exists public.arka_settlement_proposals (
  id uuid primary key,
  invite_id uuid not null unique references public.arka_invites(id) on delete cascade,
  arka_id text not null,
  source_wallet_address text not null,
  recipient_wallet_address text not null,
  amount_luna bigint not null check (amount_luna > 0),
  memo text not null,
  approval_threshold integer not null check (approval_threshold between 2 and 16),
  status text not null check (status in ('prepared', 'awaiting-approvals', 'confirmed', 'expired', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arka_settlements (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.arka_settlement_proposals(id) on delete cascade,
  invite_id uuid not null references public.arka_invites(id) on delete cascade,
  arka_id text not null,
  source_wallet_address text not null,
  recipient_wallet_address text not null,
  amount_luna bigint not null check (amount_luna > 0),
  memo text,
  transaction_hash text not null unique check (transaction_hash ~ '^[0-9a-f]{64}$'),
  network_id integer not null check (network_id = 24),
  block_number bigint not null,
  status text not null check (status = 'confirmed'),
  confirmed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.arka_refunds (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  invite_id uuid not null references public.arka_invites(id) on delete cascade,
  arka_id text not null,
  member_id text not null,
  recipient_wallet_address text not null,
  amount_luna bigint not null check (amount_luna > 0),
  transaction_hash text unique,
  status text not null check (status in ('requested', 'awaiting-approvals', 'confirmed', 'rejected')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, member_id)
);

alter table public.arka_contributions enable row level security;
alter table public.arka_settlement_proposals enable row level security;
alter table public.arka_settlements enable row level security;
alter table public.arka_refunds enable row level security;

revoke all on public.arka_contributions from anon, authenticated;
revoke all on public.arka_settlement_proposals from anon, authenticated;
revoke all on public.arka_settlements from anon, authenticated;
revoke all on public.arka_refunds from anon, authenticated;

create or replace function public.enforce_shared_fund_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member_count integer;
  v_member jsonb;
  v_previous_member jsonb;
begin
  if coalesce(new.arka->>'fundingMode', 'host-wallet') <> 'shared-wallet' then
    return new;
  end if;

  v_member_count := jsonb_array_length(coalesce(new.arka->'members', '[]'::jsonb));
  if v_member_count < 1 or v_member_count > 16 then
    raise exception 'Shared funds support up to 16 current participants';
  end if;

  if tg_op = 'UPDATE' then
    if old.arka->>'sharedWalletStatus' = 'verified' and (
      new.arka->>'sharedWalletAddress' is distinct from old.arka->>'sharedWalletAddress'
      or new.arka->>'approvalThreshold' is distinct from old.arka->>'approvalThreshold'
    ) then
      raise exception 'Verified shared fund settings are locked';
    end if;

    if old.arka->>'sharedWalletStatus' = 'verified' and (
      jsonb_array_length(coalesce(new.arka->'members', '[]'::jsonb))
        <> jsonb_array_length(coalesce(old.arka->'members', '[]'::jsonb))
      or exists (
        select 1
        from jsonb_array_elements(coalesce(new.arka->'members', '[]'::jsonb)) member
        where not exists (
          select 1
          from jsonb_array_elements(coalesce(old.arka->'members', '[]'::jsonb)) previous
          where previous->>'id' = member->>'id'
            and previous->>'walletAddress' is not distinct from member->>'walletAddress'
            and previous->>'activationPublicKey' is not distinct from member->>'activationPublicKey'
        )
      )
    ) then
      raise exception 'Shared fund membership is locked after wallet verification';
    end if;

    for v_member in select value from jsonb_array_elements(coalesce(new.arka->'members', '[]'::jsonb))
    loop
      select value into v_previous_member
      from jsonb_array_elements(coalesce(old.arka->'members', '[]'::jsonb))
      where value->>'id' = v_member->>'id'
      limit 1;

      if coalesce((v_member->>'amountPaidNim')::numeric, 0)
        > coalesce((v_previous_member->>'amountPaidNim')::numeric, 0)
        and not exists (
          select 1
          from public.arka_contributions contribution
          where contribution.invite_id = new.id
            and contribution.member_id = v_member->>'id'
            and contribution.status = 'confirmed'
        )
      then
        raise exception 'Shared contributions require verified mainnet evidence';
      end if;
    end loop;

    if new.arka->>'recipientWalletAddress' is distinct from old.arka->>'recipientWalletAddress' then
      if nullif(old.arka->>'recipientWalletAddress', '') is not null then
        raise exception 'The final recipient is locked after settlement preparation';
      end if;
      if nullif(new.arka->>'recipientWalletAddress', '') is null or not exists (
        select 1
        from public.arka_settlement_proposals proposal
        where proposal.invite_id = new.id
          and replace(upper(proposal.recipient_wallet_address), ' ', '')
            = replace(upper(new.arka->>'recipientWalletAddress'), ' ', '')
      ) then
        raise exception 'The final recipient can only be set when settlement is prepared';
      end if;
    end if;

    if nullif(old.arka->>'recipientWalletAddress', '') is not null
      and new.arka->>'recipientLabel' is distinct from old.arka->>'recipientLabel'
    then
      raise exception 'The final recipient is locked after settlement preparation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_shared_fund_snapshot_trigger on public.arka_invites;
create trigger enforce_shared_fund_snapshot_trigger
before insert or update on public.arka_invites
for each row execute function public.enforce_shared_fund_snapshot();

revoke all on function public.enforce_shared_fund_snapshot() from public, anon, authenticated;

comment on table public.arka_contributions is
  'Server-verified NIM mainnet contributions. Browser roles have no direct write access.';
comment on table public.arka_settlements is
  'Server-verified final transfers from an Arka shared wallet to its locked recipient.';
comment on table public.arka_refunds is
  'Assisted multisig refund instructions and verified outcomes; never automatic custody.';

create or replace function public.get_arka_invite(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.arka_invites;
begin
  v_row := public.arka_invite_row(p_reference);
  if v_row.id is null then return null; end if;
  if v_row.expires_at <= now() and coalesce(v_row.arka->>'status', '') in ('open', 'collecting') then
    return null;
  end if;
  if coalesce(v_row.arka->>'status', '') not in (
    'open', 'collecting', 'ready-to-settle', 'settling', 'completed', 'cancelled'
  ) then
    return null;
  end if;
  return jsonb_build_object('arka', v_row.arka);
end;
$$;

revoke all on function public.get_arka_invite(text) from public, anon, authenticated;
grant execute on function public.get_arka_invite(text) to anon;

commit;
