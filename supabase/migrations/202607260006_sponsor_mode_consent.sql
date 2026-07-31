begin;

create or replace function public.respond_arka_sponsor_request(
  p_reference text,
  p_guest_key text,
  p_request_id text,
  p_accepted boolean
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
  v_request jsonb;
  v_arka jsonb;
begin
  if length(coalesce(p_guest_key, '')) < 64 then
    raise exception 'Invalid guest identity';
  end if;
  if length(coalesce(trim(p_request_id), '')) < 16 then
    raise exception 'Invalid treating request';
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

  v_guest_hash := encode(digest(p_guest_key, 'sha256'), 'hex');
  v_member_id := 'member-guest-' || substr(v_guest_hash, 1, 20);

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(v_row.arka->'members', '[]'::jsonb)) member
    where member->>'id' = v_member_id
      and member->>'role' = 'guest'
  ) then
    raise exception 'Arka member not found';
  end if;

  v_request := v_row.arka->'sponsorModeRequest';
  if v_request is null
     or coalesce(v_request->>'id', '') <> trim(p_request_id)
     or coalesce(v_row.arka->>'splitMethod', '') <> 'sponsor' then
    raise exception 'Treating request not found';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_row.arka->'members', '[]'::jsonb)) member
    where coalesce((member->>'amountDueFiat')::numeric, 0)
      >= coalesce((v_row.arka->>'totalFiat')::numeric, 0) - 0.01
  ) then
    raise exception 'Treating request is already closed';
  end if;

  v_arka := jsonb_set(
    v_row.arka,
    array['sponsorModeRequest', 'responses', v_member_id],
    jsonb_build_object(
      'status', case when p_accepted then 'accepted' else 'declined' end,
      'respondedAt', now()
    ),
    true
  );
  v_arka := v_arka || jsonb_build_object(
    'invite', coalesce(v_arka->'invite', '{}'::jsonb) || jsonb_build_object(
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

revoke all on function public.respond_arka_sponsor_request(text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.respond_arka_sponsor_request(text, text, text, boolean)
  to anon;

comment on function public.respond_arka_sponsor_request(text, text, text, boolean) is
  'Security reviewed: the secret guest key limits a treating-mode response to the same joined member installation.';

commit;
