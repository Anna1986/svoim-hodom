import { supabase } from './supabase'
import { syncNow } from './sync'
import type { Item, Trip } from './db'

export interface ShareLink {
  token: string
  trip_id: string
  include_details: boolean
  created_at: string
}

export interface SharedFile { id: string; ownerId: string; name: string; mime: string; size: number; url: string }

export interface SharedTrip {
  trip: Trip
  items: Item[]
  files: SharedFile[]
  details: boolean
  ownerName: string
}

export function shareUrl(token: string): string {
  return `${location.origin}${location.pathname}#/s/${token}`
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createShare(tripId: string, includeDetails: boolean): Promise<string> {
  // Сначала отправляем последние изменения, чтобы по ссылке была актуальная версия
  await syncNow()
  const token = randomToken()
  const { error } = await supabase.from('shares').insert({ token, trip_id: tripId, include_details: includeDetails })
  if (error) throw new Error(error.message)
  return token
}

export async function listShares(tripId: string): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('shares')
    .select('token, trip_id, include_details, created_at')
    .eq('trip_id', tripId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function revokeShare(token: string) {
  const { error } = await supabase.from('shares').update({ revoked_at: new Date().toISOString() }).eq('token', token)
  if (error) throw new Error(error.message)
}

export async function fetchShared(token: string): Promise<SharedTrip | null> {
  const { data, error } = await supabase.functions.invoke('share', { body: { token } })
  if (error) {
    const status = (error as { context?: Response }).context?.status
    if (status === 404) return null
    throw new Error(navigator.onLine ? 'Не удалось открыть поездку' : 'Нет интернета')
  }
  return data as SharedTrip
}
