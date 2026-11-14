-- Сообщения в поддержку: пользователь пишет из профиля, администратор видит их на странице «Администрирование».
create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  text text not null check (char_length(text) between 1 and 4000),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.support_messages enable row level security;
create policy "own messages insert" on public.support_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and done_at is null);
create policy "own messages select" on public.support_messages for select to authenticated
  using (user_id = (select auth.uid()));
create index if not exists support_messages_user on public.support_messages(user_id, created_at desc);
-- функции admin_messages() и admin_message_done(id, done) — только для администратора (см. базу)

-- Переписка: ответы администратора в той же таблице
alter table public.support_messages add column if not exists from_admin boolean not null default false;
alter table public.support_messages add column if not exists read_at timestamptz;
drop policy if exists "own messages insert" on public.support_messages;
create policy "own messages insert" on public.support_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and not from_admin and done_at is null and read_at is null);
-- функции: support_mark_read() — пользователь прочитал ответы;
-- admin_threads(), admin_thread(user), admin_reply(user, text) — только для администратора (см. базу)
