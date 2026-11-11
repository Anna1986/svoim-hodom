import { supabase } from './supabase'

export interface Place { code: string; name: string; country: string }

export interface Deal {
  destination: string
  city: string
  country: string
  price: number
  departure_at: string
  return_at: string
  transfers: number
  return_transfers: number
  airline: string
  link: string
}

export class ExploreError extends Error {
  constructor(public code: 'login' | 'no_token' | 'bad_token' | 'network' | 'other', message: string) { super(message) }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data: s } = await supabase.auth.getSession()
  if (!s.session) throw new ExploreError('login', 'Войдите в профиль, чтобы смотреть подборку направлений')
  const { data, error } = await supabase.functions.invoke('flights', { body })
  if (error) {
    // У ошибок функции тело лежит в error.context (Response)
    let payload: { error?: string } | null = null
    try { payload = await (error as { context?: Response }).context?.json() ?? null } catch { /* нет тела */ }
    const code = payload?.error
    if (code === 'no_token') throw new ExploreError('no_token', 'Подключение к Авиасейлс ещё не настроено')
    if (code === 'bad_token') throw new ExploreError('bad_token', 'Ключ Travelpayouts не подошёл — проверьте его в настройках Supabase')
    if (!navigator.onLine) throw new ExploreError('network', 'Нет интернета')
    throw new ExploreError('other', code || error.message || 'Не удалось получить данные')
  }
  return data as T
}

export async function searchPlaces(term: string): Promise<Place[]> {
  const r = await call<{ places: Place[] }>({ action: 'places', term })
  return r.places
}

export async function exploreDeals(origin: string, month: string, roundtrip: boolean, direct: boolean): Promise<Deal[]> {
  const r = await call<{ items: Deal[] }>({ action: 'explore', origin, month, roundtrip, direct })
  return r.items
}

/* ---------- Город вылета: на устройстве и в аккаунте ---------- */

const HOME_KEY = 'explore:home'

export function getHome(): Place | null {
  try { return JSON.parse(localStorage.getItem(HOME_KEY) || 'null') } catch { return null }
}

export async function loadHome(): Promise<Place | null> {
  const local = getHome()
  if (local) return local
  const { data } = await supabase.auth.getSession()
  const remote = data.session?.user.user_metadata?.home_city as Place | undefined
  if (remote?.code) { localStorage.setItem(HOME_KEY, JSON.stringify(remote)); return remote }
  return null
}

export async function setHome(p: Place) {
  localStorage.setItem(HOME_KEY, JSON.stringify(p))
  const { data } = await supabase.auth.getSession()
  if (data.session) await supabase.auth.updateUser({ data: { home_city: p } }).catch(() => {})
}
