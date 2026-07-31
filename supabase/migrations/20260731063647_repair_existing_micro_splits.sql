begin;

-- Repair open equal-split snapshots created before five-decimal allocation was
-- introduced. Paid Arkas are deliberately excluded so confirmed balances are
-- never rewritten.
with candidate_invites as (
  select
    invite.id,
    invite.arka,
    (invite.arka->>'totalFiat')::numeric as total_fiat,
    (invite.arka->>'totalNimEstimate')::numeric as total_nim,
    jsonb_array_length(coalesce(invite.arka->'members', '[]'::jsonb)) as member_count
  from public.arka_invites invite
  where invite.arka->>'splitMethod' = 'equal'
    and invite.arka->>'status' in ('open', 'collecting')
    and jsonb_array_length(coalesce(invite.arka->'members', '[]'::jsonb)) > 0
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(invite.arka->'members', '[]'::jsonb)) member
      where coalesce((member->>'amountPaidFiat')::numeric, 0) > 0
         or coalesce((member->>'amountPaidNim')::numeric, 0) > 0
         or coalesce((member->>'amountPaidUsdt')::numeric, 0) > 0
    )
),
allocated_members as (
  select
    candidate.id,
    candidate.arka,
    jsonb_agg(
      member.value || jsonb_build_object(
        'amountDueFiat',
        case
          when member.ordinality = candidate.member_count
            then round(candidate.total_fiat - (round(candidate.total_fiat / candidate.member_count, 5) * (candidate.member_count - 1)), 5)
          else round(candidate.total_fiat / candidate.member_count, 5)
        end,
        'amountDueNim',
        case
          when member.ordinality = candidate.member_count
            then round(candidate.total_nim - (round(candidate.total_nim / candidate.member_count, 5) * (candidate.member_count - 1)), 5)
          else round(candidate.total_nim / candidate.member_count, 5)
        end,
        'amountDueUsdt',
        case
          when member.ordinality = candidate.member_count
            then round(candidate.total_fiat - (round(candidate.total_fiat / candidate.member_count, 5) * (candidate.member_count - 1)), 5)
          else round(candidate.total_fiat / candidate.member_count, 5)
        end,
        'status',
        case
          when (
            case
              when member.ordinality = candidate.member_count
                then round(candidate.total_nim - (round(candidate.total_nim / candidate.member_count, 5) * (candidate.member_count - 1)), 5)
              else round(candidate.total_nim / candidate.member_count, 5)
            end
          ) >= 0.00001 then 'pending'
          else 'joined'
        end
      )
      order by member.ordinality
    ) as members
  from candidate_invites candidate
  cross join lateral jsonb_array_elements(candidate.arka->'members')
    with ordinality as member(value, ordinality)
  group by candidate.id, candidate.arka
)
update public.arka_invites invite
set arka = allocated.arka || jsonb_build_object(
      'members', allocated.members,
      'invite', coalesce(allocated.arka->'invite', '{}'::jsonb) || jsonb_build_object(
        'version', coalesce((allocated.arka#>>'{invite,version}')::integer, 1) + 1
      ),
      'updatedAt', now()
    ),
    updated_at = now()
from allocated_members allocated
where invite.id = allocated.id;

commit;
