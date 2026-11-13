-- Администрирование: общая статистика без доступа к данным и доступ поддержки только с разрешения пользователя.

-- Кто администратор. Политик нет — из приложения таблицу не прочитать и не изменить.
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security;

-- Посещения: случайный номер браузера на день, без связи с аккаунтом. Читать напрямую нельзя никому.
create table if not exists public.visits (
  day date not null default current_date,
  visitor uuid not null,
  primary key (day, visitor)
);
alter table public.visits enable row level security;

create or replace function public.track_visit(p_visitor uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.visits(day, visitor) values (current_date, p_visitor) on conflict do nothing;
$$;
revoke all on function public.track_visit(uuid) from public;
grant execute on function public.track_visit(uuid) to anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Только числа: ни имён, ни почт, ни содержимого поездок.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare week_ms bigint := (extract(epoch from now() - interval '7 days') * 1000)::bigint;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'visitors_today', (select count(*) from public.visits where day = current_date),
    'visitors_7d', (select count(distinct visitor) from public.visits where day > current_date - 7),
    'visitors_30d', (select count(distinct visitor) from public.visits where day > current_date - 30),
    'visitors_total', (select count(distinct visitor) from public.visits),
    'visits_by_day', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'n', n) order by day)
        from (select day, count(*) n from public.visits where day > current_date - 30 group by day) t), '[]'::jsonb),
    'users_total', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_active_7d', (select count(distinct user_id) from public.records where server_updated_at > now() - interval '7 days'),
    'trips_total', (select count(*) from public.records where kind = 'trip' and not deleted),
    'trips_7d', (select count(*) from public.records where kind = 'trip' and not deleted and coalesce((data->>'createdAt')::bigint, 0) > week_ms),
    'items_total', (select count(*) from public.records where kind = 'item' and not deleted),
    'files_total', (select count(*) from public.records where kind = 'attachment' and not deleted),
    'shares_active', (select count(*) from public.shares where revoked_at is null)
  );
end $$;
revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;

-- Доступ поддержки: пользователь сам открывает его на время и может закрыть.
create table if not exists public.support_grants (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  expires_at timestamptz not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.support_grants enable row level security;
drop policy if exists "own grant" on public.support_grants;
create policy "own grant" on public.support_grants for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and expires_at <= now() + interval '7 days');

-- Журнал: пользователь видит, когда поддержка открывала его данные.
create table if not exists public.support_access_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  admin_id uuid not null,
  at timestamptz not null default now()
);
alter table public.support_access_log enable row level security;
drop policy if exists "own log" on public.support_access_log;
create policy "own log" on public.support_access_log for select to authenticated
  using (user_id = (select auth.uid()));
create index if not exists support_access_log_user on public.support_access_log(user_id, at desc);

-- Список тех, кто сейчас открыл доступ (только они видны администратору).
create or replace function public.admin_support_list()
returns table(user_id uuid, email text, name text, expires_at timestamptz, note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select g.user_id, u.email::text, coalesce(u.raw_user_meta_data->>'name', '')::text, g.expires_at, g.note, g.created_at
    from public.support_grants g join auth.users u on u.id = g.user_id
    where g.expires_at > now() order by g.created_at desc;
end $$;
revoke all on function public.admin_support_list() from public;
grant execute on function public.admin_support_list() to authenticated;

-- Поездки и брони пользователя — только при открытом доступе; каждый просмотр пишется в журнал.
-- Личные документы (паспорта и т. п.) и файлы не отдаются.
create or replace function public.admin_user_records(p_user uuid)
returns table(kind text, id text, data jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not exists(select 1 from public.support_grants g where g.user_id = p_user and g.expires_at > now()) then
    raise exception 'no access';
  end if;
  insert into public.support_access_log(user_id, admin_id) values (p_user, auth.uid());
  return query
    select r.kind::text, r.id::text, r.data from public.records r
    where r.user_id = p_user and not r.deleted and r.kind in ('trip', 'item');
end $$;
revoke all on function public.admin_user_records(uuid) from public;
grant execute on function public.admin_user_records(uuid) to authenticated;
