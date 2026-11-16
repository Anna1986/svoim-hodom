-- Invitations from an event can grant access to that event or the entire trip.
-- Event-only guests read records and files directly; they never receive the trip.
create table if not exists public.event_members (
  owner_id uuid not null references auth.users on delete cascade,
  item_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (owner_id, item_id, user_id)
);
create index if not exists event_members_user on public.event_members(user_id);
alter table public.event_members enable row level security;
grant select, delete on public.event_members to authenticated;
create policy "event members select" on public.event_members for select to authenticated
  using (owner_id = (select auth.uid()) or user_id = (select auth.uid()));
create policy "event members delete" on public.event_members for delete to authenticated
  using (owner_id = (select auth.uid()) or user_id = (select auth.uid()));

create table if not exists public.event_invites (
  token text primary key check (length(token) >= 24),
  owner_id uuid not null references auth.users on delete cascade default auth.uid(),
  item_id text not null,
  scope text not null check (scope in ('event', 'trip')),
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (scope = 'trip' or role = 'viewer')
);
create index if not exists event_invites_owner_item on public.event_invites(owner_id, item_id);
alter table public.event_invites enable row level security;
grant select, insert, update, delete on public.event_invites to authenticated;
create policy "event invites own" on public.event_invites for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.records r where r.user_id = (select auth.uid())
      and r.id = item_id and r.kind = 'item' and r.data->>'category' = 'voucher' and not r.deleted
  ));

create or replace function private.event_access(p_owner uuid, p_item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_members m join public.records r
      on r.user_id = m.owner_id and r.id = m.item_id and r.kind = 'item'
    where m.owner_id = p_owner and m.item_id = p_item and m.user_id = (select auth.uid())
      and not r.deleted and r.data->>'category' = 'voucher'
  );
$$;
revoke all on function private.event_access(uuid, text) from public;
grant execute on function private.event_access(uuid, text) to authenticated;

create policy "records select event member" on public.records for select to authenticated
  using (not deleted and (
    (kind = 'item' and private.event_access(user_id, id)) or
    (kind = 'attachment' and data->>'ownerType' = 'item' and private.event_access(user_id, data->>'ownerId'))
  ));

create or replace function private.event_file_access(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.records r
    where r.kind = 'attachment' and not r.deleted and r.data->>'ownerType' = 'item'
      and r.user_id::text = (storage.foldername(p_name))[1] and r.id = storage.filename(p_name)
      and private.event_access(r.user_id, r.data->>'ownerId'));
$$;
revoke all on function private.event_file_access(text) from public;
grant execute on function private.event_file_access(text) to authenticated;
create policy "files select event member" on storage.objects for select to authenticated
  using (bucket_id = 'files' and private.event_file_access(name));

create or replace function public.event_invite_info(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare inv public.event_invites; ev public.records; uid uuid := (select auth.uid());
begin
  select * into inv from public.event_invites where token = p_token and revoked_at is null;
  if not found then return null; end if;
  select * into ev from public.records where user_id = inv.owner_id and id = inv.item_id
    and kind = 'item' and data->>'category' = 'voucher' and not deleted;
  if not found or not exists (select 1 from public.records t
    where t.user_id = inv.owner_id and t.id = ev.trip_id and t.kind = 'trip' and not t.deleted)
    then return null; end if;
  return jsonb_build_object(
    'item_id', inv.item_id, 'trip_id', case when inv.scope = 'trip' or uid = inv.owner_id then ev.trip_id else null end,
    'scope', inv.scope, 'role', inv.role, 'title', ev.data->>'title',
    'owner_name', (select coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)) from auth.users u where u.id = inv.owner_id),
    'own', coalesce(uid = inv.owner_id, false),
    'joined', uid is not null and exists (select 1 from public.event_members m
      where m.owner_id = inv.owner_id and m.item_id = inv.item_id and m.user_id = uid)
      and (inv.scope = 'event' or private.trip_role(inv.owner_id, ev.trip_id) is not null)
  );
end $$;
revoke all on function public.event_invite_info(text) from public;
grant execute on function public.event_invite_info(text) to anon, authenticated;

create or replace function public.join_event(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare inv public.event_invites; ev public.records; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into inv from public.event_invites where token = p_token and revoked_at is null for share;
  if not found then raise exception 'invite not found'; end if;
  select * into ev from public.records where user_id = inv.owner_id and id = inv.item_id
    and kind = 'item' and data->>'category' = 'voucher' and not deleted for share;
  if not found or not exists (select 1 from public.records t where t.user_id = inv.owner_id
    and t.id = ev.trip_id and t.kind = 'trip' and not t.deleted) then raise exception 'invite not found'; end if;
  if uid <> inv.owner_id then
    insert into public.event_members (owner_id, item_id, user_id) values (inv.owner_id, inv.item_id, uid)
      on conflict do nothing;
    if inv.scope = 'trip' then
      insert into public.trip_members as tm (owner_id, trip_id, user_id, role) values (inv.owner_id, ev.trip_id, uid, inv.role)
        on conflict (owner_id, trip_id, user_id) do update
          set role = case when excluded.role = 'editor' then 'editor' else tm.role end;
    end if;
  end if;
  return jsonb_build_object('item_id', inv.item_id, 'scope', inv.scope,
    'trip_id', case when inv.scope = 'trip' or uid = inv.owner_id then ev.trip_id else null end,
    'owner_id', inv.owner_id, 'own', uid = inv.owner_id);
end $$;
revoke all on function public.join_event(text) from public, anon;
grant execute on function public.join_event(text) to authenticated;

create or replace function public.event_people(p_item text)
returns table(user_id uuid, name text, scope text, role text)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); ev public.records;
begin
  select * into ev from public.records r where r.user_id = uid and r.id = p_item and r.kind = 'item' and not r.deleted;
  if uid is null or not found then raise exception 'forbidden'; end if;
  return query select u.id, coalesce(nullif(u.raw_user_meta_data->>'name', ''), u.email)::text,
    case when tm.role is null then 'event' else 'trip' end, coalesce(tm.role, 'viewer')
    from public.event_members m join auth.users u on u.id = m.user_id
    left join public.trip_members tm on tm.owner_id = m.owner_id and tm.trip_id = ev.trip_id and tm.user_id = m.user_id
    where m.owner_id = uid and m.item_id = p_item order by m.joined_at;
end $$;
revoke all on function public.event_people(text) from public, anon;
grant execute on function public.event_people(text) to authenticated;

create or replace function public.my_events() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('owner_id', m.owner_id, 'item', r.data)
    order by r.data->>'startDate', r.data->>'startTime'), '[]'::jsonb)
  from public.event_members m join public.records r on r.user_id = m.owner_id and r.id = m.item_id and r.kind = 'item'
  where m.user_id = (select auth.uid()) and not r.deleted and r.data->>'category' = 'voucher';
$$;
revoke all on function public.my_events() from public, anon;
grant execute on function public.my_events() to authenticated;

-- Revoke pending invitations and memberships when an event/trip is deleted
-- or an event is moved to another category/trip. Existing trip membership remains independent.
create or replace function public.records_event_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'item' and ((new.deleted and not old.deleted) or
    (old.data->>'category' = 'voucher' and (new.data->>'category' is distinct from 'voucher' or new.trip_id is distinct from old.trip_id))) then
    delete from public.event_members where owner_id = new.user_id and item_id = new.id;
    update public.event_invites set revoked_at = now() where owner_id = new.user_id and item_id = new.id and revoked_at is null;
  elsif new.kind = 'trip' and new.deleted and not old.deleted then
    delete from public.event_members m using public.records r
      where m.owner_id = new.user_id and r.user_id = m.owner_id and r.id = m.item_id and r.trip_id = new.id;
    update public.event_invites i set revoked_at = now() from public.records r
      where i.owner_id = new.user_id and r.user_id = i.owner_id and r.id = i.item_id and r.trip_id = new.id and i.revoked_at is null;
  end if;
  return null;
end $$;
revoke all on function public.records_event_deleted() from public, anon, authenticated;
create trigger records_event_deleted after update on public.records for each row execute function public.records_event_deleted();
