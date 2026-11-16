import { supabase } from './supabase'
import { syncNow } from './sync'
import type { Attachment, Item } from './db'
import type { Role } from './access'

export type InviteScope = 'event' | 'trip'
export interface EventPerson { user_id: string; name: string; scope: InviteScope; role: Role }
export interface EventInviteInfo {
  item_id: string; trip_id: string | null; title: string; owner_name: string;
  scope: InviteScope; role: Role; own: boolean; joined: boolean;
}
export interface GuestEvent { owner_id: string; item: Item }
export type EventFile = Omit<Attachment, 'blob'> & { url: string }

function fail(message: string): Error { return new Error(navigator.onLine ? message : 'Нужен интернет') }

export async function eventPeople(itemId: string): Promise<EventPerson[]> {
  const { data, error } = await supabase.rpc('event_people', { p_item: itemId })
  if (error) throw fail('Не получилось загрузить участников события. Попробуйте позже.')
  return data ?? []
}

export async function createEventInvite(itemId: string, scope: InviteScope, role: Role): Promise<string> {
  await syncNow()
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const { error } = await supabase.from('event_invites').insert({
    token, item_id: itemId, scope, role: scope === 'event' ? 'viewer' : role,
  })
  if (error) throw fail('Не получилось создать приглашение. Проверьте, что событие сохранено в облаке, и попробуйте позже.')
  return `${location.origin}${location.pathname}#/event-join/${token}`
}

export async function eventInvitesExist(itemId: string): Promise<boolean> {
  const { data, error } = await supabase.from('event_invites').select('token').eq('item_id', itemId).is('revoked_at', null).limit(1)
  if (error) throw fail('Не получилось загрузить приглашения.')
  return !!data?.length
}

export async function revokeEventInvites(itemId: string) {
  const { error } = await supabase.from('event_invites').update({ revoked_at: new Date().toISOString() })
    .eq('item_id', itemId).is('revoked_at', null)
  if (error) throw fail('Не получилось отозвать приглашения.')
}

export async function removeEventMember(ownerId: string, itemId: string, userId: string) {
  const { data, error } = await supabase.from('event_members').delete()
    .eq('owner_id', ownerId).eq('item_id', itemId).eq('user_id', userId).select('user_id')
  if (error || !data?.length) throw fail('Не получилось убрать участника события.')
}

export async function eventInviteInfo(token: string): Promise<EventInviteInfo | null> {
  const { data, error } = await supabase.rpc('event_invite_info', { p_token: token })
  if (error) throw fail('Не получилось открыть приглашение. Попробуйте позже.')
  return data
}

export async function joinEvent(token: string): Promise<{ item_id: string; owner_id: string; trip_id: string | null; scope: InviteScope; own: boolean }> {
  const { data, error } = await supabase.rpc('join_event', { p_token: token })
  if (error) throw fail(/invite not found/.test(error.message) ? 'Приглашение больше не действует.' : 'Не получилось присоединиться к событию.')
  if (data.scope === 'trip' || data.own) await syncNow()
  return data
}

export async function myEvents(): Promise<GuestEvent[]> {
  const { data, error } = await supabase.rpc('my_events')
  if (error) throw fail('Не получилось загрузить приглашённые события.')
  return data ?? []
}

export async function fetchGuestEvent(ownerId: string, itemId: string): Promise<{ item: Item; files: EventFile[] } | null> {
  const { data, error } = await supabase.from('records').select('data').eq('user_id', ownerId)
    .eq('id', itemId).eq('kind', 'item').eq('deleted', false).maybeSingle()
  if (error) throw fail('Не получилось открыть событие.')
  if (!data) return null
  const { data: rows, error: fileError } = await supabase.from('records').select('id, data').eq('user_id', ownerId)
    .eq('kind', 'attachment').eq('deleted', false).eq('data->>ownerType', 'item').eq('data->>ownerId', itemId)
  if (fileError) throw fail('Не получилось загрузить файлы события.')
  const files = await Promise.all((rows ?? []).map(async (r) => {
    const { data: signed, error: signError } = await supabase.storage.from('files').createSignedUrl(`${ownerId}/${r.id}`, 3600)
    if (signError) throw fail('Не получилось открыть файл события. Попробуйте обновить страницу.')
    return { ...r.data, url: signed.signedUrl } as EventFile
  }))
  return { item: data.data as Item, files }
}

const PENDING_EVENT = 'event-join:pending'
export function pendingEventInvite(): string | null { try { return localStorage.getItem(PENDING_EVENT) } catch { return null } }
export function setPendingEventInvite(token: string | null) {
  try { if (token) localStorage.setItem(PENDING_EVENT, token); else localStorage.removeItem(PENDING_EVENT) } catch { /* private mode */ }
}
