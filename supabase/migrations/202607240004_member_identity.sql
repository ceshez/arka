begin;

-- A member's public name belongs to the shared Arka snapshot. Private contact
-- nicknames remain device-local and are never exposed through an invite.
--
-- Rejoining from the same installation refreshes that member's public name
-- and wallet address. The guest key is hashed into the same stable member id
-- used when the member first joined, so it cannot edit another participant.
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

  v_display_name := left(
    coalesce(nullif(trim(p_display_name), ''), 'Guest'),
    40
  );
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
        v_member := v_member || jsonb_build_object(
          'displayName',
          v_display_name
        );
        if v_wallet_address is not null then
          v_member := v_member || jsonb_build_object(
            'walletAddress',
            v_wallet_address
          );
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

revoke all on function public.join_arka_invite(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.join_arka_invite(text, text, text, text)
  to anon;

comment on function public.join_arka_invite(text, text, text, text) is
  'Security reviewed: intentionally anon-executable Arka invite RPC; the secret guest key limits public identity updates to the same member installation.';

commit;
