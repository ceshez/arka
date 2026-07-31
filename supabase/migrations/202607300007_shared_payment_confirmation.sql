begin;

-- Persist the paid member in the shared invite snapshot after the wallet
-- provider has returned a confirmed contribution. The per-installation guest
-- key limits the update to the member created by that same installation.
create or replace function public.confirm_arka_member_payment(
  p_reference text,
  p_guest_key text,
  p_asset text
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
  v_member_id text;
  v_asset text;
  v_locked_asset text;
  v_member jsonb;
  v_members jsonb;
  v_updated_members jsonb := '[]'::jsonb;
  v_arka jsonb;
  v_all_paid boolean;
begin
  if length(coalesce(p_guest_key, '')) < 64 then
    raise exception 'Invalid guest identity';
  end if;

  v_asset := upper(trim(coalesce(p_asset, '')));
  if v_asset not in ('NIM', 'USDT') then
    raise exception 'Unsupported contribution asset';
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
  if coalesce(v_row.arka->>'status', '') in ('completed', 'cancelled') then
    raise exception 'This Arka is closed';
  end if;

  v_guest_hash := encode(digest(p_guest_key, 'sha256'), 'hex');
  v_member_id := 'member-guest-' || substr(v_guest_hash, 1, 20);
  v_members := coalesce(v_row.arka->'members', '[]'::jsonb);

  if not exists (
    select 1
    from jsonb_array_elements(v_members) member
    where member->>'id' = v_member_id
      and member->>'role' = 'guest'
  ) then
    raise exception 'Arka member not found';
  end if;

  v_locked_asset := nullif(v_row.arka->>'contributionAsset', '');
  if v_locked_asset is null then
    if exists (
      select 1 from jsonb_array_elements(v_members) member
      where coalesce((member->>'amountPaidNim')::numeric, 0) > 0
    ) then
      v_locked_asset := 'NIM';
    elsif exists (
      select 1 from jsonb_array_elements(v_members) member
      where coalesce((member->>'amountPaidUsdt')::numeric, 0) > 0
    ) then
      v_locked_asset := 'USDT';
    end if;
  end if;

  if v_locked_asset is not null and v_locked_asset <> v_asset then
    raise exception 'The contribution asset is locked after payments begin';
  end if;

  for v_member in select value from jsonb_array_elements(v_members)
  loop
    if v_member->>'id' = v_member_id then
      v_member := v_member || jsonb_build_object(
        'status', 'paid',
        'amountPaidFiat', coalesce((v_member->>'amountDueFiat')::numeric, 0),
        'amountPaidNim', case
          when v_asset = 'NIM' then coalesce((v_member->>'amountDueNim')::numeric, 0)
          else coalesce((v_member->>'amountPaidNim')::numeric, 0)
        end,
        'amountPaidUsdt', case
          when v_asset = 'USDT' then coalesce((v_member->>'amountDueUsdt')::numeric, 0)
          else coalesce((v_member->>'amountPaidUsdt')::numeric, 0)
        end,
        'paidAt', now()
      );
    end if;
    v_updated_members := v_updated_members || jsonb_build_array(v_member);
  end loop;

  v_all_paid := not exists (
    select 1
    from jsonb_array_elements(v_updated_members) member
    where coalesce((member->>'amountDueFiat')::numeric, 0)
      - coalesce((member->>'amountPaidFiat')::numeric, 0) > 0.001
  );

  v_arka := v_row.arka || jsonb_build_object(
    'members', v_updated_members,
    'contributionAsset', v_asset,
    'status', case when v_all_paid then 'ready-to-settle' else 'collecting' end,
    'invite', coalesce(v_row.arka->'invite', '{}'::jsonb) || jsonb_build_object(
      'version', coalesce((v_row.arka#>>'{invite,version}')::integer, 1) + 1
    ),
    'updatedAt', now()
  );

  update public.arka_invites
  set arka = v_arka,
      updated_at = now()
  where id = v_row.id;

  return jsonb_build_object('arka', v_arka, 'memberId', v_member_id);
end;
$$;

revoke all on function public.confirm_arka_member_payment(text, text, text)
  from public, anon, authenticated;
grant execute on function public.confirm_arka_member_payment(text, text, text)
  to anon;

comment on function public.confirm_arka_member_payment(text, text, text) is
  'Security reviewed: intentionally anon-executable shared payment update; the secret guest key scopes the wallet-confirmed client observation to its joined member.';

commit;
