import { supabase } from './supabase'
import { syncNow, useSyncState } from './sync'
import { useSharedMap, type Role } from './access'

/** Доступ текущего пользователя к поездке: своя или чужая, можно ли менять. */
export interface TripAccess { ownerId: string | null; role: 'owner' | Role; shared: boolean; canEdit: boolean }

export function useTripAccess(tripId: string | undefined): TripAccess {
  const s = useSyncState()
  const map = useSharedMap(s.user?.id)
  const sh = tripId ? map[tripId] : undefined
  if (sh) return { ownerId: sh.owner, role: sh.role, shared: true, canEdit: sh.role === 'editor' }
  return { ownerId: s.user?.id ?? null, role: 'owner', shared: false, canEdit: true }
}

export function useSharedTrips() {
  const s = useSyncState()
  return useSharedMap(s.user?.id)
}

export const ROLE_LABEL: Record<'owner' | Role, string> = { owner: 'владелец', editor: 'может менять', viewer: 'только смотрит' }

/* ---------- Участники ---------- */

export interface Person { user_id: string; name: string; role: 'owner' | Role }

const online = (msg: string) => (navigator.onLine ? msg : 'Нужен интернет')

export async function listPeople(ownerId: string, tripId: string): Promise<Person[]> {
  const { data, error } = await supabase.rpc('trip_people', { p_owner: ownerId, p_trip: tripId })
  if (error) throw new Error(online('Не получилось загрузить участников'))
  return (data ?? []) as Person[]
}

export async function setMemberRole(tripId: string, userId: string, role: Role) {
  const { data, error } = await supabase.from('trip_members').update({ role }).eq('trip_id', tripId).eq('user_id', userId).select('user_id')
  if (error || !data?.length) throw new Error(online('Не получилось изменить права'))
}

export async function removeMember(tripId: string, userId: string) {
  await supabase.auth.getSession()
  const { data, error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId).select('user_id')
  if (error || !data?.length) throw new Error(online('Не получилось убрать участника'))
}

/** Участник сам выходит из чужой поездки — она исчезает с его устройств. */
export async function leaveTrip(tripId: string) {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) throw new Error('Войдите в аккаунт')
  await removeMember(tripId, u.user.id)
  await syncNow()
}

/* ---------- Приглашения ---------- */

export function inviteUrl(token: string): string {
  return `${location.origin}${location.pathname}#/join/${token}`
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Ссылка-приглашение с нужной ролью: берём действующую или создаём новую. */
export async function getInvite(tripId: string, role: Role): Promise<string> {
  await syncNow() // поездка должна быть в облаке, иначе по ссылке её не найти
  const { data } = await supabase.from('trip_invites').select('token').eq('trip_id', tripId).eq('role', role).is('revoked_at', null).limit(1)
  if (data?.[0]) return data[0].token
  const token = randomToken()
  const { error } = await supabase.from('trip_invites').insert({ token, trip_id: tripId, role })
  if (error) throw new Error(online('Не получилось создать приглашение'))
  return token
}

export async function hasInvites(tripId: string): Promise<boolean> {
  const { data } = await supabase.from('trip_invites').select('token').eq('trip_id', tripId).is('revoked_at', null).limit(1)
  return !!data?.length
}

/** Отзываем все ссылки-приглашения поездки: по ним больше не присоединиться (участники остаются). */
export async function revokeInvites(tripId: string) {
  await supabase.auth.getSession()
  const { error } = await supabase.from('trip_invites').update({ revoked_at: new Date().toISOString() }).eq('trip_id', tripId).is('revoked_at', null)
  if (error) throw new Error(online('Не получилось отозвать ссылки'))
}

export interface InviteInfo { trip_id: string; role: Role; title: string | null; owner_name: string | null; own: boolean; joined: boolean }

export async function inviteInfo(token: string): Promise<InviteInfo | null> {
  const { data, error } = await supabase.rpc('invite_info', { p_token: token })
  if (error) throw new Error(online('Не получилось открыть приглашение'))
  return data as InviteInfo | null
}

export async function joinTrip(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_trip', { p_token: token })
  if (error) throw new Error(/invite not found/.test(error.message) ? 'Приглашение больше не действует' : online('Не получилось присоединиться'))
  await syncNow()
  return data as string
}

/* Приглашение, открытое до входа в аккаунт: вернёмся к нему после входа */
const PENDING = 'join:pending'
export const pendingInvite = () => { try { return localStorage.getItem(PENDING) } catch { return null } }
export const setPendingInvite = (t: string | null) => { try { if (t) localStorage.setItem(PENDING, t); else localStorage.removeItem(PENDING) } catch { /* */ } }
