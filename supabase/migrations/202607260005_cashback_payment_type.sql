begin;

alter table analytics.events
  drop constraint if exists events_payment_type_check;

alter table analytics.events
  add constraint events_payment_type_check check (
    payment_type is null
    or payment_type in (
      'member-contribution',
      'host-merchant-settlement',
      'cashback-reward',
      'refund'
    )
  );

commit;
