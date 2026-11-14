import { useSyncExternalStore } from 'react'
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

/* ---------- Переписка с поддержкой ---------- */

export interface ChatMessage { id: number; text: string; from_admin: boolean; created_at: string; read_at: string | null }

const offline = (msg: string) => (navigator.onLine ? msg : 'Нужен интернет.')

export async function myMessages(): Promise<ChatMessage[]> {
  const { data, error } = await supabase.from('support_messages').select('id, text, from_admin, created_at, read_at').order('id', { ascending: false }).limit(100)
  if (error) throw new Error(offline('Не получилось загрузить переписку.'))
  return ((data ?? []) as ChatMessage[]).reverse()
}

export async function sendSupportMessage(text: string): Promise<string> {
  const { error } = await supabase.from('support_messages').insert({ text: text.trim().slice(0, 4000) })
  return error ? offline('Не получилось отправить. Попробуйте ещё раз.') : ''
}

/** Пользователь прочитал ответы поддержки. */
export async function markSupportRead() {
  await supabase.rpc('support_mark_read')
  setUnread(0)
}

/* Непрочитанные ответы поддержки — точка на «Профиле» */
let unread = 0
const unreadListeners = new Set<() => void>()
function setUnread(n: number) { if (n !== unread) { unread = n; unreadListeners.forEach((l) => l()) } }

export async function refreshSupportUnread() {
  const { data: s } = await supabase.auth.getSession()
  if (!s.session || !navigator.onLine) return
  const { count, error } = await supabase.from('support_messages').select('id', { count: 'exact', head: true }).eq('from_admin', true).is('read_at', null)
  if (!error) setUnread(count ?? 0)
}

export function useSupportUnread(): number {
  return useSyncExternalStore((cb) => { unreadListeners.add(cb); return () => unreadListeners.delete(cb) }, () => unread)
}

let watching = false
export function watchSupport() {
  if (watching) return
  watching = true
  supabase.auth.onAuthStateChange((_e, session) => { if (session) void refreshSupportUnread(); else setUnread(0) })
  setInterval(() => { if (document.visibilityState === 'visible') void refreshSupportUnread() }, 60_000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refreshSupportUnread() })
}

/* Администратор */

export interface Thread { user_id: string; email: string; name: string; last_text: string; last_at: string; last_from_admin: boolean; unread: number }

export async function adminThreads(): Promise<Thread[]> {
  const { data, error } = await supabase.rpc('admin_threads')
  if (error) throw error
  return (data ?? []) as Thread[]
}

export async function adminThread(userId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc('admin_thread', { p_user: userId })
  if (error) throw new Error(offline('Не получилось загрузить переписку.'))
  return (data ?? []) as ChatMessage[]
}

export async function adminReply(userId: string, text: string): Promise<string> {
  const { error } = await supabase.rpc('admin_reply', { p_user: userId, p_text: text })
  return error ? offline('Не получилось отправить. Попробуйте ещё раз.') : ''
}
