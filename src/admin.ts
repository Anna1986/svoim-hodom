import { supabase } from './supabase'
import { syncNow } from './sync'
import type { Item, Trip } from './db'

/* ---------- Учёт посещений: случайный номер браузера, без связи с аккаунтом ---------- */

export function trackVisit() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem('visit:day') === today) return
    let id = localStorage.getItem('visit:id')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('visit:id', id) }
    supabase.rpc('track_visit', { p_visitor: id }).then(({ error }) => {
      if (!error) localStorage.setItem('visit:day', today)
    })
  } catch { /* без статистики приложение работает так же */ }
}

/* ---------- Администратор ---------- */

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin')
  return !error && data === true
}

export interface Stats {
  visitors_today: number; visitors_7d: number; visitors_30d: number; visitors_total: number
  visits_by_day: { day: string; n: number }[]
  users_total: number; users_7d: number; users_active_7d: number
  trips_total: number; trips_7d: number; items_total: number; files_total: number; shares_active: number
}

export async function adminStats(): Promise<Stats> {
  const { data, error } = await supabase.rpc('admin_stats')
  if (error) throw error
  return data as Stats
}

export interface SupportRequest { user_id: string; email: string; name: string; expires_at: string; note: string; created_at: string }

export async function supportList(): Promise<SupportRequest[]> {
  const { data, error } = await supabase.rpc('admin_support_list')
  if (error) throw error
  return (data ?? []) as SupportRequest[]
}

export async function userTrips(userId: string): Promise<{ trips: Trip[]; items: Item[] }> {
  const { data, error } = await supabase.rpc('admin_user_records', { p_user: userId })
  if (error) throw error
  const rows = (data ?? []) as { kind: string; data: Trip | Item }[]
  return {
    trips: rows.filter((r) => r.kind === 'trip').map((r) => r.data as Trip),
    items: rows.filter((r) => r.kind === 'item').map((r) => r.data as Item),
  }
}

/* ---------- Доступ поддержки — открывает сам пользователь ---------- */

export interface Grant { expires_at: string; note: string }

export async function myGrant(): Promise<Grant | null> {
  const { data, error } = await supabase.from('support_grants').select('expires_at, note').gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error) throw error
  return data
}

export async function openSupport(hours: number, note: string): Promise<string> {
  await syncNow() // поддержка увидит то, что уже в облаке
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return 'Войдите в аккаунт'
  const { error } = await supabase.from('support_grants').upsert({
    user_id: u.user.id, expires_at: new Date(Date.now() + hours * 3600e3).toISOString(), note: note.trim(), created_at: new Date().toISOString(),
  })
  return error ? 'Не получилось открыть доступ. Проверьте интернет.' : ''
}

export async function closeSupport(): Promise<string> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return ''
  const { error } = await supabase.from('support_grants').delete().eq('user_id', u.user.id)
  return error ? 'Не получилось закрыть доступ. Проверьте интернет.' : ''
}

export async function myAccessLog(): Promise<string[]> {
  const { data } = await supabase.from('support_access_log').select('at').order('at', { ascending: false }).limit(10)
  return (data ?? []).map((r: { at: string }) => r.at)
}

/* ---------- Сообщения в поддержку ---------- */

export async function sendSupportMessage(text: string): Promise<string> {
  const { error } = await supabase.from('support_messages').insert({ text: text.trim().slice(0, 4000) })
  return error ? (navigator.onLine ? 'Не получилось отправить. Попробуйте ещё раз.' : 'Нужен интернет, чтобы отправить сообщение.') : ''
}

export interface SupportMessage { id: number; user_id: string; email: string; name: string; text: string; created_at: string; done_at: string | null }

export async function adminMessages(): Promise<SupportMessage[]> {
  const { data, error } = await supabase.rpc('admin_messages')
  if (error) throw error
  return (data ?? []) as SupportMessage[]
}

export async function adminMessageDone(id: number, done: boolean) {
  const { error } = await supabase.rpc('admin_message_done', { p_id: id, p_done: done })
  if (error) throw error
}
