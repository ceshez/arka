begin;

-- Arka's browser client uses the publishable key without Supabase Auth.
-- Keep the deliberately public invite surface limited to the anon role.
revoke execute on function public.create_arka_invite(jsonb, text, timestamptz) from authenticated;
revoke execute on function public.get_arka_invite(text) from authenticated;
revoke execute on function public.join_arka_invite(text, text, text, text) from authenticated;
revoke execute on function public.update_arka_invite(uuid, text, jsonb) from authenticated;

-- SECURITY DEFINER is intentional: browser roles have no direct access to
-- arka_invites. Exclude public from function lookup so an exposed caller cannot
-- influence object resolution. pgcrypto lives in Supabase's extensions schema.
alter function public.arka_invite_row(text)
  set search_path to pg_catalog, extensions;
alter function public.create_arka_invite(jsonb, text, timestamptz)
  set search_path to pg_catalog, extensions;
alter function public.get_arka_invite(text)
  set search_path to pg_catalog, extensions;
alter function public.join_arka_invite(text, text, text, text)
  set search_path to pg_catalog, extensions;
alter function public.update_arka_invite(uuid, text, jsonb)
  set search_path to pg_catalog, extensions;

-- Bound resource use for calls made through the public Data API.
alter function public.arka_invite_row(text) set statement_timeout to '5s';
alter function public.create_arka_invite(jsonb, text, timestamptz) set statement_timeout to '5s';
alter function public.get_arka_invite(text) set statement_timeout to '5s';
alter function public.join_arka_invite(text, text, text, text) set statement_timeout to '5s';
alter function public.update_arka_invite(uuid, text, jsonb) set statement_timeout to '5s';

alter function public.join_arka_invite(text, text, text, text) set lock_timeout to '2s';
alter function public.update_arka_invite(uuid, text, jsonb) set lock_timeout to '2s';

-- Supabase grants EXECUTE on new functions by default in some projects.
-- Make every future public function opt-in instead.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

comment on function public.create_arka_invite(jsonb, text, timestamptz) is
  'Security reviewed: intentionally anon-executable Arka invite RPC; direct table access is revoked.';
comment on function public.get_arka_invite(text) is
  'Security reviewed: intentionally anon-executable Arka invite RPC; requires an unguessable UUID token or unique join code.';
comment on function public.join_arka_invite(text, text, text, text) is
  'Security reviewed: intentionally anon-executable Arka invite RPC; validates deadline, state, guest identity, and membership lock.';
comment on function public.update_arka_invite(uuid, text, jsonb) is
  'Security reviewed: intentionally anon-executable Arka invite RPC; requires the host secret and optimistic invite version.';

commit;
