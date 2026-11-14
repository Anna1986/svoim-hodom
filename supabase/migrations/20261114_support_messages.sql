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
