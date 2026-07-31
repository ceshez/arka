create index if not exists arka_refunds_invite_id_idx
  on public.arka_refunds (invite_id);

create index if not exists arka_settlements_invite_id_idx
  on public.arka_settlements (invite_id);

create index if not exists arka_settlements_proposal_id_idx
  on public.arka_settlements (proposal_id);
