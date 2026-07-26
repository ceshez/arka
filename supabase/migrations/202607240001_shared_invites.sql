create extension if not exists pgcrypto;

create table if not exists public.arka_invites (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null unique default gen_random_uuid(),
  join_code text not null unique check (join_code ~ '^ARKA-[A-F0-9]{8}$'),
  arka jsonb not null,
  host_secret_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (octet_length(arka::text) <= 65536)
);

alter table public.arka_invites enable row level security;
revoke all on table public.arka_invites from anon, authenticated;

create or replace function public.arka_invite_row(p_reference text)
returns public.arka_invites
language sql
stable
security definer
set search_path = public
as $$
  select invite
  from public.arka_invites invite
  where invite.public_token::text = lower(trim(p_reference))
     or invite.join_code = upper(
       case
         when trim(p_reference) ilike 'ARKA-%' then trim(p_reference)
         else 'ARKA-' || trim(p_reference)
       end
     )
  limit 1;
$$;

revoke all on function public.arka_invite_row(text) from public, anon, authenticated;

create or replace function public.create_arka_invite(
  p_arka jsonb,
  p_host_secret text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_id text;
  v_public_token uuid := gen_random_uuid();
  v_invite jsonb;
  v_arka jsonb;
begin
  if p_arka is null or jsonb_typeof(p_arka) <> 'object' then
    raise exception 'Invalid Arka details';
  end if;
  if octet_length(p_arka::text) > 65536 then
    raise exception 'Arka details are too large';
  end if;
  if length(coalesce(p_host_secret, '')) < 64 then
    raise exception 'Invalid host secret';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'The invite deadline must be in the future';
  end if;

  loop
    v_code := 'ARKA-' || upper(encode(gen_random_bytes(4), 'hex'));
    exit when not exists (
      select 1 from public.arka_invites where join_code = v_code
    );
  end loop;

  v_id := 'arka-' || replace(v_public_token::text, '-', '');
  v_invite := coalesce(p_arka->'invite', '{}'::jsonb) || jsonb_build_object(
    'arkaId', v_id,
    'code', v_code,
    'publicToken', v_public_token::text,
    'version', 1,
    'qrValue', '/join/' || v_public_token::text || '/preview',
    'inviteLink', '/join/' || v_public_token::text || '/preview',
    'expiresAt', p_expires_at
  );
  v_arka := p_arka || jsonb_build_object(
    'id', v_id,
    'code', v_code,
    'invite', v_invite,
    'expiresAt', p_expires_at,
    'updatedAt', now()
  );

  insert into public.arka_invites (
    id,
    public_token,
    join_code,
    arka,
    host_secret_hash,
    expires_at
  ) values (
    gen_random_uuid(),
    v_public_token,
    v_code,
    v_arka,
    encode(digest(p_host_secret, 'sha256'), 'hex'),
    p_expires_at
  );

  return jsonb_build_object('arka', v_arka);
end;
$$;

create or replace function public.get_arka_invite(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.arka_invites;
begin
  v_row := public.arka_invite_row(p_reference);
  if v_row.id is null then return null; end if;
  if v_row.expires_at <= now() then return null; end if;
  if coalesce(v_row.arka->>'status', '') not in ('open', 'collecting') then return null; end if;
  return jsonb_build_object('arka', v_row.arka);
end;
$$;

create or replace function public.join_arka_invite(
  p_reference text,
  p_guest_key text,
  p_display_name text,
  p_wallet_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
begin
  if length(coalesce(p_guest_key, '')) < 64 then
    raise exception 'Invalid guest identity';
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
    return jsonb_build_object('arka', v_row.arka, 'memberId', v_member_id);
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
    'displayName', left(coalesce(nullif(trim(p_display_name), ''), 'Guest'), 40),
    'role', 'guest',
    'walletAddress', nullif(left(coalesce(p_wallet_address, ''), 128), ''),
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
        when v_index = v_count then round(v_total_fiat - (round(v_total_fiat / v_count, 2) * (v_count - 1)), 2)
        else round(v_total_fiat / v_count, 2)
      end;
      v_due_nim := case
        when v_index = v_count then round(v_total_nim - (round(v_total_nim / v_count, 2) * (v_count - 1)), 2)
        else round(v_total_nim / v_count, 2)
      end;
      v_member := v_member || jsonb_build_object(
        'amountDueFiat', v_due_fiat,
        'amountDueNim', v_due_nim,
        'amountDueUsdt', v_due_fiat,
        'status', case when v_due_fiat > 0 then 'pending' else 'joined' end
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

create or replace function public.update_arka_invite(
  p_public_token uuid,
  p_host_secret text,
  p_arka jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.arka_invites;
  v_arka jsonb;
begin
  select *
  into v_row
  from public.arka_invites
  where public_token = p_public_token
  for update;

  if v_row.id is null then raise exception 'Arka not found'; end if;
  if encode(digest(coalesce(p_host_secret, ''), 'sha256'), 'hex') <> v_row.host_secret_hash then
    raise exception 'Arka not found';
  end if;
  if p_arka is null or jsonb_typeof(p_arka) <> 'object' or octet_length(p_arka::text) > 65536 then
    raise exception 'Invalid Arka details';
  end if;
  if coalesce((p_arka#>>'{invite,version}')::integer, 0)
    <> coalesce((v_row.arka#>>'{invite,version}')::integer, 1) then
    raise exception 'The shared invite changed. Refresh before saving again';
  end if;

  v_arka := p_arka || jsonb_build_object(
    'id', v_row.arka->>'id',
    'code', v_row.join_code,
    'invite', coalesce(p_arka->'invite', '{}'::jsonb) || jsonb_build_object(
      'arkaId', v_row.arka->>'id',
      'code', v_row.join_code,
      'publicToken', v_row.public_token::text,
      'version', coalesce((v_row.arka#>>'{invite,version}')::integer, 1) + 1
    ),
    'updatedAt', now()
  );

  update public.arka_invites
  set arka = v_arka,
      expires_at = coalesce((v_arka->>'expiresAt')::timestamptz, expires_at),
      updated_at = now()
  where id = v_row.id;

  return jsonb_build_object('arka', v_arka);
end;
$$;

revoke all on function public.create_arka_invite(jsonb, text, timestamptz) from public;
revoke all on function public.get_arka_invite(text) from public;
revoke all on function public.join_arka_invite(text, text, text, text) from public;
revoke all on function public.update_arka_invite(uuid, text, jsonb) from public;

grant execute on function public.create_arka_invite(jsonb, text, timestamptz) to anon, authenticated;
grant execute on function public.get_arka_invite(text) to anon, authenticated;
grant execute on function public.join_arka_invite(text, text, text, text) to anon, authenticated;
grant execute on function public.update_arka_invite(uuid, text, jsonb) to anon, authenticated;
