-- Run with psql as the local database owner after applying the migrations.
-- All fixtures and changes are rolled back. No real user accounts are used.
\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end $$;
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','event-owner@example.test'),
 ('10000000-0000-0000-0000-000000000002','event-guest@example.test'),
 ('10000000-0000-0000-0000-000000000003','event-stranger@example.test');
insert into public.records(user_id,id,kind,trip_id,data) values
 ('10000000-0000-0000-0000-000000000001','test-trip','trip','test-trip','{"id":"test-trip","title":"Private trip"}'),
 ('10000000-0000-0000-0000-000000000001','test-event','item','test-trip','{"id":"test-event","tripId":"test-trip","category":"voucher","title":"Concert"}'),
 ('10000000-0000-0000-0000-000000000001','test-hotel','item','test-trip','{"id":"test-hotel","tripId":"test-trip","category":"hotel","title":"Private hotel"}'),
 ('10000000-0000-0000-0000-000000000001','test-event-file','attachment','test-trip','{"id":"test-event-file","ownerType":"item","ownerId":"test-event"}'),
 ('10000000-0000-0000-0000-000000000001','test-hotel-file','attachment','test-trip','{"id":"test-hotel-file","ownerType":"item","ownerId":"test-hotel"}'),
 ('10000000-0000-0000-0000-000000000001','test-doc-file','attachment',null,'{"id":"test-doc-file","ownerType":"doc","ownerId":"test-doc"}');
insert into storage.objects(bucket_id,name) values
 ('files','10000000-0000-0000-0000-000000000001/test-event-file'),
 ('files','10000000-0000-0000-0000-000000000001/test-hotel-file'),
 ('files','10000000-0000-0000-0000-000000000001/test-doc-file');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
insert into public.event_invites(token,item_id,scope,role) values
 ('event-view-01234567890123456789','test-event','event','viewer'),
 ('trip-edit-012345678901234567890','test-event','trip','editor');
select pg_temp.check_true((select count(*) = 0 from public.event_people('test-event')), 'empty participant list');
do $$ begin
 begin
  insert into public.event_invites(token,item_id,scope,role) values ('invalid-target-012345678901234','test-hotel','event','viewer');
  raise exception 'FAILED: owner can create an event invite for a non-event';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.check_true(public.event_invite_info('event-view-01234567890123456789')->>'title' = 'Concert','anonymous invitation preview');
select pg_temp.check_true(public.event_invite_info('event-view-01234567890123456789')->>'trip_id' is null,'event preview hides trip id');
select pg_temp.check_true(public.event_invite_info('invalid') is null,'unknown invitation');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select public.join_event('event-view-01234567890123456789');
select public.join_event('event-view-01234567890123456789');
select pg_temp.check_true((select count(*) = 1 from public.event_members),'joining is idempotent');
select pg_temp.check_true((select count(*) = 0 from public.trip_members),'event invite does not join trip');
select pg_temp.check_true((select count(*) = 2 from public.records),'only event and its file are readable');
select pg_temp.check_true((select count(*) = 1 from storage.objects),'only event file is readable');
select pg_temp.check_true(jsonb_array_length(public.my_events()) = 1,'event appears in guest list');
do $$ declare n int; begin
 update public.records set data='{}' where id='test-event'; get diagnostics n=row_count;
 perform pg_temp.check_true(n=0,'event guest cannot edit');
 delete from storage.objects; get diagnostics n=row_count;
 perform pg_temp.check_true(n=0,'event guest cannot delete files');
 begin
  insert into public.event_invites(token,item_id,scope,role) values ('forged-012345678901234567890','test-event','trip','editor');
  raise exception 'FAILED: guest can invite';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.event_members(owner_id,item_id,user_id) values ('10000000-0000-0000-0000-000000000001','test-hotel',auth.uid());
  raise exception 'FAILED: guest can forge membership';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select pg_temp.check_true((select count(*) = 0 from public.records),'stranger cannot read event');
select pg_temp.check_true((select count(*) = 0 from storage.objects),'stranger cannot read event file');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select pg_temp.check_true((select count(*) = 1 from public.event_people('test-event')),'owner sees participants');
update public.event_invites set revoked_at=now() where scope='event';
select pg_temp.check_true(public.event_invite_info('event-view-01234567890123456789') is null,'revoked preview is hidden');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
 begin perform public.join_event('event-view-01234567890123456789'); raise exception 'FAILED: revoked invite accepted';
 exception when raise_exception then if sqlerrm <> 'invite not found' then raise; end if; end;
end $$;
select pg_temp.check_true((select count(*) = 2 from public.records),'revoking link keeps existing member');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
delete from public.event_members where item_id='test-event';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select pg_temp.check_true((select count(*) = 0 from public.records),'removing guest closes event access');
select pg_temp.check_true((select count(*) = 0 from storage.objects),'removing guest closes file access');
select public.join_event('trip-edit-012345678901234567890');
select pg_temp.check_true((select role='editor' from public.trip_members),'trip invite grants editor role');
select pg_temp.check_true((select count(*) = 5 from public.records),'trip invite exposes trip and its items/files only');
select pg_temp.check_true((select count(*) = 2 from storage.objects),'trip invite exposes trip files only');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select pg_temp.check_true((select scope='trip' and role='editor' from public.event_people('test-event')),'owner sees full-trip access');
update public.records set deleted=true where id='test-event';
select pg_temp.check_true((select count(*) = 0 from public.event_members),'deleting event removes memberships');
select pg_temp.check_true((select count(*) = 0 from public.event_invites where revoked_at is null),'deleting event revokes invites');
select pg_temp.check_true((select count(*) = 1 from public.trip_members),'trip membership remains independent');
rollback;
