import { useSyncExternalStore } from 'react'

/**
 * Общие поездки на этом устройстве: в каких чужих поездках участвует пользователь и с какой ролью.
 * Хранится в localStorage (нужно и без интернета), обновляется при каждой синхронизации.
 */
export type Role = 'editor' | 'viewer'
export interface Shared { owner: string; role: Role }
export type SharedMap = Record<string, Shared> // tripId → владелец и роль

const listeners = new Set<() => void>()
const cache = new Map<string, { raw: string; value: unknown }>()

function read<T>(key: string): T {
  const raw = localStorage.getItem(key) || '{}'
  const hit = cache.get(key)
  if (hit && hit.raw === raw) return hit.value as T
  let value: T
  try { value = JSON.parse(raw) } catch { value = {} as T }
  cache.set(key, { raw, value })
  return value
}

export const readShared = (uid: string) => read<SharedMap>(`sync:shared:${uid}`)
export function writeShared(uid: string, map: SharedMap) {
  localStorage.setItem(`sync:shared:${uid}`, JSON.stringify(map))
  listeners.forEach((l) => l())
}

/** Чужие записи на устройстве: id записи → id поездки (нужно, чтобы отправить удаление владельцу). */
export const readForeign = (uid: string) => read<Record<string, string>>(`sync:foreign:${uid}`)
export function writeForeign(uid: string, map: Record<string, string>) {
  localStorage.setItem(`sync:foreign:${uid}`, JSON.stringify(map))
}

const EMPTY: SharedMap = {}
export function useSharedMap(uid: string | undefined): SharedMap {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => (uid ? readShared(uid) : EMPTY),
  )
}
