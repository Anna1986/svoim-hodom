-- Участники поездки: владелец приглашает ссылкой, участник видит поездку у себя и (если редактор) меняет её.
-- Записи остаются у владельца (records.user_id = владелец); участник получает доступ через trip_members.

create schema if not exists private;
grant usage on schema private to authenticated;

-- К какой поездке относится запись (сохраняется и на «удалённых» записях).
alter table public.records add column if not exists trip_id text;
create index if not exists records_user_trip_idx on public.records(user_id, trip_id);

create or replace function public.records_touch() returns trigger
language plpgsql set search_path to '' as $$
begin
  new.server_updated_at := clock_timestamp();
  if new.kind = 'trip' then
    new.trip_id := new.id;
  elsif new.kind = 'item' then
    if new.data ? 'tripId' then new.trip_id := new.data->>'tripId';
    elsif tg_op = 'UPDATE' then new.trip_id := old.trip_id; end if;
  elsif new.kind = 'attachment' then
    if new.data->>'ownerType' = 'doc' then
      new.trip_id := null; -- файлы личных документов никогда не общие
    elsif new.data->>'ownerType' = 'item' then
      new.trip_id := coalesce(
        (select r.trip_id from public.records r where r.user_id = new.user_id and r.id = new.data->>'ownerId' and r.kind = 'item'),
        new.trip_id);
    elsif tg_op = 'UPDATE' then new.trip_id := old.trip_id; end if;
  else
    new.trip_id := null;
  end if;
  return new;
end $$;

-- Заполняем trip_id у существующих записей
update public.records set trip_id = id where kind = 'trip' and trip_id is null;
update public.records set trip_id = data->>'tripId' where kind = 'item' and data ? 'tripId' and trip_id is null;
update public.records a set trip_id = i.trip_id from public.records i
  where a.kind = 'attachment' and a.data->>'ownerType' = 'item' and i.user_id = a.user_id and i.id = a.data->>'ownerId' and i.kind = 'item' and a.trip_id is null;

create table if not exists public.trip_members (
  owner_id uuid not null references auth.users on delete cascade,
  trip_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (owner_id, trip_id, user_id)
);
create index if not exists trip_members_user on public.trip_members(user_id);
alter table public.trip_members enable row level security;
create policy "members select" on public.trip_members for select to authenticated
  using (owner_id = (select auth.uid()) or user_id = (select auth.uid()));
create policy "members update by owner" on public.trip_members for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "members delete by owner or self" on public.trip_members for delete to authenticated
  using (owner_id = (select auth.uid()) or user_id = (select auth.uid()));

create table if not exists public.trip_invites (
  token text primary key,
  owner_id uuid not null references auth.users on delete cascade default auth.uid(),
  trip_id text not null,
  role text not null check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists trip_invites_owner_trip on public.trip_invites(owner_id, trip_id);
alter table public.trip_invites enable row level security;
create policy "invites own" on public.trip_invites for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Роль текущего пользователя в чужой поездке (null — не участник)
create or replace function private.trip_role(p_owner uuid, p_trip text) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.trip_members m
  where m.owner_id = p_owner and m.trip_id = p_trip and m.user_id = (select auth.uid());
$$;
revoke all on function private.trip_role(uuid, text) from public;
grant execute on function private.trip_role(uuid, text) to authenticated;

-- Роль по пути файла «<владелец>/<id файла>»
create or replace function private.file_role(p_name text) returns text
language sql stable security definer set search_path = '' as $$
  select private.trip_role(r.user_id, r.trip_id) from public.records r
  where r.kind = 'attachment' and r.trip_id is not null
    and r.user_id::text = (storage.foldername(p_name))[1] and r.id = storage.filename(p_name);
$$;
revoke all on function private.file_role(text) from public;
grant execute on function private.file_role(text) to authenticated;

-- Записи: участник читает, редактор меняет брони и файлы (и саму поездку, но не удаляет её)
create policy "records select member" on public.records for select to authenticated
  using (trip_id is not null and private.trip_role(user_id, trip_id) is not null);
create policy "records insert editor" on public.records for insert to authenticated
  with check (kind in ('item', 'attachment') and trip_id is not null and private.trip_role(user_id, trip_id) = 'editor');
create policy "records update editor" on public.records for update to authenticated
  using (kind in ('trip', 'item', 'attachment') and trip_id is not null and private.trip_role(user_id, trip_id) = 'editor')
  with check (kind in ('trip', 'item', 'attachment') and trip_id is not null and private.trip_role(user_id, trip_id) = 'editor'
    and not (kind = 'trip' and deleted));

-- Файлы
create policy "files select member" on storage.objects for select to authenticated
  using (bucket_id = 'files' and private.file_role(name) is not null);
create policy "files insert editor" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and private.file_role(name) = 'editor');
create policy "files update editor" on storage.objects for update to authenticated
  using (bucket_id = 'files' and private.file_role(name) = 'editor')
  with check (bucket_id = 'files' and private.file_role(name) = 'editor');
create policy "files delete editor" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and private.file_role(name) = 'editor');

-- Поездку удалили — участники и приглашения больше не нужны
create or replace function public.records_trip_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'trip' and new.deleted and not old.deleted then
    delete from public.trip_members where owner_id = new.user_id and trip_id = new.id;
    update public.trip_invites set revoked_at = now() where owner_id = new.user_id and trip_id = new.id and revoked_at is null;
  end if;
  return null;
end $$;
revoke all on function public.records_trip_deleted() from public, anon, authenticated;
drop trigger if exists records_trip_deleted on public.records;
create trigger records_trip_deleted after update on public.records for each row execute function public.records_trip_deleted();

-- Что за приглашение (видно по ссылке ещё до входа)
create or replace function public.invite_info(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare inv public.trip_invites; uid uuid := (select auth.uid());
begin
  select * into inv from public.trip_invites where token = p_token and revoked_at is null;
  if not found then return null; end if;
  return jsonb_build_object(
    'trip_id', inv.trip_id,
    'role', inv.role,
    'title', (select r.data->>'title' from public.records r where r.user_id = inv.owner_id and r.id = inv.trip_id and r.kind = 'trip' and not r.deleted),
    'owner_name', (select coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)) from auth.users u where u.id = inv.owner_id),
    'own', uid is not null and uid = inv.owner_id,
    'joined', uid is not null and exists(select 1 from public.trip_members m where m.owner_id = inv.owner_id and m.trip_id = inv.trip_id and m.user_id = uid)
  );
end $$;
revoke all on function public.invite_info(text) from public;
grant execute on function public.invite_info(text) to anon, authenticated;

create or replace function public.join_trip(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare inv public.trip_invites; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into inv from public.trip_invites where token = p_token and revoked_at is null;
  if not found then raise exception 'invite not found'; end if;
  if inv.owner_id = uid then return inv.trip_id; end if;
  if not exists(select 1 from public.records r where r.user_id = inv.owner_id and r.id = inv.trip_id and r.kind = 'trip' and not r.deleted) then
    raise exception 'invite not found';
  end if;
  insert into public.trip_members as tm (owner_id, trip_id, user_id, role) values (inv.owner_id, inv.trip_id, uid, inv.role)
    on conflict (owner_id, trip_id, user_id) do update set role = case when excluded.role = 'editor' then 'editor' else tm.role end;
  return inv.trip_id;
end $$;
revoke all on function public.join_trip(text) from public, anon;
grant execute on function public.join_trip(text) to authenticated;

-- Кто в поездке: видно владельцу и участникам
create or replace function public.trip_people(p_owner uuid, p_trip text)
returns table(user_id uuid, name text, role text)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or not (uid = p_owner or private.trip_role(p_owner, p_trip) is not null) then
    raise exception 'forbidden';
  end if;
  return query
    select u.id, coalesce(nullif(u.raw_user_meta_data->>'name', ''), u.email)::text, 'owner'::text
      from auth.users u where u.id = p_owner
    union all
    select u.id, coalesce(nullif(u.raw_user_meta_data->>'name', ''), u.email)::text, m.role
      from public.trip_members m join auth.users u on u.id = m.user_id
      where m.owner_id = p_owner and m.trip_id = p_trip;
end $$;
revoke all on function public.trip_people(uuid, text) from public, anon;
grant execute on function public.trip_people(uuid, text) to authenticated;
