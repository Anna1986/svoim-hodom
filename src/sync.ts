/**
 * Синхронизация между устройствами.
 *
 * Данные по-прежнему живут в IndexedDB (приложение работает офлайн).
 * Каждое локальное изменение попадает в «исходящие» (outbox, localStorage),
 * а при наличии сети отправляется в Supabase. Затем забираются изменения
 * с других устройств — всё, что изменилось на сервере после прошлой синхронизации.
 * Если у записи есть неотправленное локальное изменение, побеждает локальное.
 */
import Dexie, { type Table, type Transaction } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db, type Attachment } from './db'
import { readForeign, readShared, writeForeign, writeShared, type SharedMap } from './access'
import { appRootUrl, FILES_BUCKET, supabase } from './supabase'

type Kind = 'trip' | 'item' | 'doc' | 'attachment'
const KINDS: Kind[] = ['trip', 'item', 'doc', 'attachment']
const TABLES = { trip: db.trips, item: db.items, doc: db.docs, attachment: db.attachments } as const
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (k: Kind) => TABLES[k] as unknown as Table<any, string>

interface Row {
  user_id: string
  trip_id: string | null
  id: string
  kind: Kind
  data: Record<string, unknown>
  updated_at: number
  deleted: boolean
  server_updated_at: string
}

/* ---------------- Состояние для интерфейса ---------------- */

export interface SyncState {
  ready: boolean
  user: { id: string; email: string; name: string } | null
  syncing: boolean
  lastSync: number | null
  error: string
  pending: number
}

let state: SyncState = { ready: false, user: null, syncing: false, lastSync: null, error: '', pending: 0 }
const listeners = new Set<() => void>()

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => state,
  )
}

/* ---------------- Исходящие изменения ---------------- */

type Outbox = Record<string, { kind: Kind; v: number }>
const OUTBOX = 'sync:outbox'

function readOutbox(): Outbox {
  try { return JSON.parse(localStorage.getItem(OUTBOX) || '{}') } catch { return {} }
}
function writeOutbox(o: Outbox) {
  localStorage.setItem(OUTBOX, JSON.stringify(o))
  setState({ pending: Object.keys(o).length })
}
let counter = 0
function enqueue(kind: Kind, id: string) {
  const o = readOutbox()
  o[id] = { kind, v: Date.now() * 1000 + (counter++ % 1000) }
  writeOutbox(o)
  scheduleSync(1500)
}
function dequeue(id: string, v: number) {
  const o = readOutbox()
  if (o[id]?.v === v) { delete o[id]; writeOutbox(o) }
}

// Все изменения в базе, кроме пришедших с сервера, попадают в исходящие.
type Tx = Transaction & { __remote?: boolean }
for (const kind of KINDS) {
  const t = table(kind)
  t.hook('creating', (_key, obj, tx) => { if (!(tx as Tx).__remote) enqueue(kind, obj.id) })
  t.hook('updating', (_mods, key, _obj, tx) => { if (!(tx as Tx).__remote) enqueue(kind, String(key)) })
  t.hook('deleting', (key, _obj, tx) => { if (!(tx as Tx).__remote) enqueue(kind, String(key)) })
}

/* ---------------- Запуск синхронизации ---------------- */

let timer: ReturnType<typeof setTimeout> | undefined
let running: Promise<void> | null = null
let again = false

export function scheduleSync(delay = 0) {
  clearTimeout(timer)
  timer = setTimeout(() => { void syncNow() }, delay)
}

export function syncNow(): Promise<void> {
  if (running) { again = true; return running }
  running = doSync().finally(() => {
    running = null
    if (again) { again = false; scheduleSync(500) }
  })
  return running
}

async function doSync() {
  const user = state.user
  if (!user || !navigator.onLine) return
  setState({ syncing: true, error: '' })
  try {
    seedOnce(user.id)
    await refreshMemberships(user.id)
    await push(user.id)
    await fetchJoined(user.id)
    await pull(user.id)
    await retryDownloads(user.id)
    setState({ lastSync: Date.now() })
  } catch (e) {
    console.error('sync', e)
    setState({ error: humanError(e) })
  } finally {
    setState({ syncing: false })
  }
}

/** При первом входе на устройстве отправляем всё, что уже было введено. */
function seedOnce(uid: string) {
  const key = `sync:seeded:${uid}`
  if (localStorage.getItem(key)) return
  localStorage.setItem(key, '1')
  void (async () => {
    for (const kind of KINDS) {
      const ids = (await table(kind).toCollection().primaryKeys()) as string[]
      ids.forEach((id) => enqueue(kind, id))
    }
  })()
}

/* ---------------- Общие поездки ---------------- */

const FETCH = (uid: string) => `sync:fetch:${uid}`
function readFetch(uid: string): string[] {
  try { return JSON.parse(localStorage.getItem(FETCH(uid)) || '[]') } catch { return [] }
}

/** Узнаём, в каких чужих поездках мы участвуем; потерянные убираем с устройства, новые — ставим на загрузку. */
async function refreshMemberships(uid: string) {
  const { data, error } = await supabase.from('trip_members').select('owner_id, trip_id, role').eq('user_id', uid)
  if (error) throw error
  const prev = readShared(uid)
  const next: SharedMap = {}
  for (const m of (data ?? []) as { owner_id: string; trip_id: string; role: 'editor' | 'viewer' }[]) {
    next[m.trip_id] = { owner: m.owner_id, role: m.role }
  }
  for (const tripId of Object.keys(prev)) if (!next[tripId]) await purgeTrip(uid, tripId)
  const added = Object.keys(next).filter((t) => !prev[t])
  if (added.length) localStorage.setItem(FETCH(uid), JSON.stringify([...new Set([...readFetch(uid), ...added])]))
  writeShared(uid, next)
}

/** Доступ к чужой поездке закрыт — убираем её с этого устройства (на сервер ничего не отправляем). */
async function purgeTrip(uid: string, tripId: string) {
  const foreign = { ...readForeign(uid) }
  const ids = new Set<string>([tripId])
  await db.transaction('rw', db.trips, db.items, db.attachments, async () => {
    ;(Dexie.currentTransaction as Tx).__remote = true
    const itemIds = (await db.items.where('tripId').equals(tripId).primaryKeys()) as string[]
    if (itemIds.length) {
      const attIds = (await db.attachments.where('ownerId').anyOf(itemIds).primaryKeys()) as string[]
      attIds.forEach((i) => ids.add(i))
      await db.attachments.bulkDelete(attIds)
    }
    itemIds.forEach((i) => ids.add(i))
    await db.items.bulkDelete(itemIds)
    await db.trips.delete(tripId)
  })
  for (const [id, t] of Object.entries(foreign)) if (t === tripId) { ids.add(id); delete foreign[id] }
  writeForeign(uid, foreign)
  const o = readOutbox()
  let changed = false
  ids.forEach((id) => { if (o[id]) { delete o[id]; changed = true } })
  if (changed) writeOutbox(o)
}

/** Загружаем целиком поездки, к которым только что присоединились (они старше курсора синхронизации). */
async function fetchJoined(uid: string) {
  for (const tripId of readFetch(uid)) {
    const sh = readShared(uid)[tripId]
    if (sh) {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from('records').select(COLS)
          .eq('user_id', sh.owner).eq('trip_id', tripId).order('id').range(from, from + PAGE - 1)
        if (error) throw error
        const rows = (data ?? []) as Row[]
        await receive(uid, rows)
        if (rows.length < PAGE) break
      }
    }
    localStorage.setItem(FETCH(uid), JSON.stringify(readFetch(uid).filter((t) => t !== tripId)))
  }
}

/* ---------------- Отправка ---------------- */

/** К какой поездке относится запись (null — ни к какой: личный документ и его файлы). */
async function tripOf(kind: Kind, id: string, local: Record<string, unknown> | undefined, foreign: Record<string, string>): Promise<string | null> {
  if (kind === 'trip') return id
  if (kind === 'item') return (local?.tripId as string | undefined) ?? foreign[id] ?? null
  if (kind === 'attachment') {
    if (local?.ownerType === 'item') {
      const item = await db.items.get(local.ownerId as string)
      return item?.tripId ?? foreign[id] ?? null
    }
    return local ? null : foreign[id] ?? null
  }
  return null
}

async function push(uid: string) {
  const outbox = readOutbox()
  const shared = readShared(uid)
  const foreign = { ...readForeign(uid) }
  const unreadable: string[] = []
  try {
    for (const [id, { kind, v }] of Object.entries(outbox)) {
      const local = await table(kind).get(id)
      const tripId = await tripOf(kind, id, local, foreign)
      const sh = tripId ? shared[tripId] : undefined
      // Чужая запись: без права менять (или доступ уже закрыт) ничего не отправляем
      if ((!sh && foreign[id]) || sh?.role === 'viewer' || (sh && kind === 'trip' && !local)) { dequeue(id, v); continue }
      const owner = sh?.owner ?? uid
      const path = `${owner}/${id}`
      if (local) {
        let data = local
        let file: Blob | null = null
        if (kind === 'attachment') {
          const { blob, ...meta } = local as Attachment
          // Читаем файл заранее: в Safari сохранённый файл иногда оказывается пустым или недоступным.
          // Такой файл пропускаем, чтобы он не мешал отправке остального.
          let body: ArrayBuffer | null = null
          try { body = await blob.arrayBuffer() } catch { body = null }
          if (!body || body.byteLength === 0) { unreadable.push(meta.name); continue }
          file = new Blob([body], { type: meta.mime || 'application/octet-stream' })
          data = meta
        }
        const upload = async () => {
          if (!file) return
          const up = await supabase.storage.from(FILES_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
          if (up.error) throw up.error
        }
        const updated_at = data.updatedAt ?? data.createdAt ?? Date.now()
        if (sh && kind === 'trip') {
          // чужую поездку можно только изменить (не создать и не удалить)
          const { error } = await supabase.from('records').update({ data, updated_at }).eq('user_id', owner).eq('id', id)
          if (error) throw error
        } else {
          // свой файл — сначала файл, потом запись; чужой — наоборот: право на файл появляется вместе с записью
          if (!sh) await upload()
          const { error } = await supabase.from('records').upsert({ user_id: owner, id, kind, data, deleted: false, updated_at, trip_id: tripId })
          if (error) throw error
          if (sh) await upload()
        }
        if (sh && tripId) foreign[id] = tripId
      } else {
        if (kind === 'attachment') await supabase.storage.from(FILES_BUCKET).remove([path])
        if (sh) {
          const { error } = await supabase.from('records').update({ data: {}, deleted: true, updated_at: Date.now() }).eq('user_id', owner).eq('id', id)
          if (error) throw error
          delete foreign[id]
        } else {
          const { error } = await supabase.from('records').upsert({ user_id: uid, id, kind, data: {}, deleted: true, updated_at: Date.now() })
          if (error) throw error
        }
      }
      dequeue(id, v)
    }
  } finally {
    writeForeign(uid, foreign)
  }
  if (unreadable.length) {
    throw new Error(`Файл «${unreadable.join('», «')}» не отправился: на этом устройстве он пустой. Удалите его в записи и прикрепите заново.`)
  }
}

/* ---------------- Получение ---------------- */

const PAGE = 500
const COLS = 'user_id, trip_id, id, kind, data, updated_at, deleted, server_updated_at'
const RETRY = 'sync:retry'

function readRetry(): string[] {
  try { return JSON.parse(localStorage.getItem(RETRY) || '[]') } catch { return [] }
}
function writeRetry(ids: string[]) {
  localStorage.setItem(RETRY, JSON.stringify([...new Set(ids)]))
}

async function download(owner: string, id: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(FILES_BUCKET).download(`${owner}/${id}`)
  return error ? null : data
}

async function applyRows(uid: string, rows: Row[], blobs: Map<string, Blob>) {
  // Чужие записи: запоминаем, к какой поездке они относятся; без доступа к поездке — пропускаем
  const shared = readShared(uid)
  const foreign = { ...readForeign(uid) }
  rows = rows.filter((r) => r.user_id === uid || (r.trip_id && shared[r.trip_id]))
  for (const r of rows) {
    if (r.user_id === uid) continue
    if (r.deleted) delete foreign[r.id]
    else foreign[r.id] = r.trip_id!
  }
  writeForeign(uid, foreign)
  await db.transaction('rw', db.trips, db.items, db.docs, db.attachments, async () => {
    ;(Dexie.currentTransaction as Tx).__remote = true
    const outbox = readOutbox()
    for (const row of rows) {
      if (outbox[row.id]) continue // есть неотправленное локальное изменение — оно важнее
      const t = table(row.kind)
      if (row.deleted) {
        await t.delete(row.id)
      } else if (row.kind === 'attachment') {
        const blob = blobs.get(row.id)
        if (blob) await t.put({ ...row.data, blob })
      } else {
        await t.put(row.data)
      }
    }
  })
}

/** Принимаем записи с сервера: файлы скачиваем заранее — внутри транзакции IndexedDB сеть недоступна. */
async function receive(uid: string, rows: Row[]) {
  if (!rows.length) return
  const blobs = new Map<string, Blob>()
  const failed: string[] = []
  for (const r of rows) {
    if (r.kind !== 'attachment' || r.deleted) continue
    const have = await db.attachments.get(r.id)
    if (have) { blobs.set(r.id, have.blob); continue }
    const blob = await download(r.user_id, r.id)
    if (blob) blobs.set(r.id, blob)
    else failed.push(r.id)
  }
  if (failed.length) writeRetry([...readRetry(), ...failed])
  await applyRows(uid, rows, blobs)
}

async function pull(uid: string) {
  const cursorKey = `sync:cursor:${uid}`
  for (;;) {
    const cursor = localStorage.getItem(cursorKey) || '1970-01-01T00:00:00Z'
    const { data, error } = await supabase
      .from('records')
      .select(COLS)
      .gt('server_updated_at', cursor)
      .order('server_updated_at', { ascending: true })
      .limit(PAGE)
    if (error) throw error
    const rows = (data ?? []) as Row[]
    if (!rows.length) return
    await receive(uid, rows)
    localStorage.setItem(cursorKey, rows[rows.length - 1].server_updated_at)
    if (rows.length < PAGE) return
  }
}

/** Файлы, которые не удалось скачать раньше. */
async function retryDownloads(uid: string) {
  const ids = readRetry()
  if (!ids.length) return
  const left: string[] = []
  for (const id of ids) {
    const { data } = await supabase.from('records').select(COLS).eq('id', id).limit(1)
    const row = ((data ?? []) as Row[])[0]
    if (!row || row.deleted) continue
    const blob = await download(row.user_id, id)
    if (blob) await applyRows(uid, [row], new Map([[id, blob]]))
    else left.push(id)
  }
  writeRetry(left)
}

/* ---------------- Вход ---------------- */

function humanError(e: unknown): string {
  const msg = (e as { message?: string })?.message || String(e)
  if (/invalid login credentials/i.test(msg)) return 'Неверная почта или пароль'
  if (/email not confirmed/i.test(msg)) return 'Почта не подтверждена — откройте письмо от Supabase и нажмите ссылку'
  if (/already registered/i.test(msg)) return 'Такой пользователь уже есть — просто войдите'
  if (/password should be at least/i.test(msg)) return 'Пароль должен быть не короче 6 символов'
  if (/rate limit/i.test(msg)) return 'Слишком много попыток, подождите немного'
  if (/failed to fetch|network/i.test(msg)) return 'Нет связи с сервером'
  if (/no content provided/i.test(msg)) return 'Не получилось отправить файл: он пустой. Удалите его в записи и прикрепите заново.'
  return msg
}

export async function signIn(email: string, password: string): Promise<string> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? humanError(error) : ''
}

/** Проверка надёжности пароля (защита от утёкших паролей в Supabase — только на платном тарифе). */
const COMMON = ['12345678', '123456789', '1234567890', 'qwerty123', 'password', 'password1', 'qwertyui', '11111111', '00000000', '87654321', 'iloveyou', 'йцукенгш', 'qwe12345', 'abc12345']
export function passwordProblem(p: string): string {
  if (p.length < 8) return 'Пароль должен быть не короче 8 символов'
  if (!/\d/.test(p) || !/[a-zа-яё]/i.test(p)) return 'В пароле нужны и буквы, и цифры'
  if (COMMON.includes(p.toLowerCase()) || /^(.)\1+$/.test(p)) return 'Этот пароль слишком простой — его легко подобрать'
  return ''
}

export async function signUp(email: string, password: string): Promise<{ error: string; needsConfirm: boolean }> {
  const weak = passwordProblem(password)
  if (weak) return { error: weak, needsConfirm: false }
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: location.href.split('#')[0] },
  })
  if (error) return { error: humanError(error), needsConfirm: false }
  return { error: '', needsConfirm: !data.session }
}

export async function updateName(name: string): Promise<string> {
  const { data, error } = await supabase.auth.updateUser({ data: { name } })
  if (error) return humanError(error)
  if (data.user && state.user) setState({ user: { ...state.user, name: String(data.user.user_metadata?.name ?? '') } })
  return ''
}

export async function sendPasswordReset(email: string): Promise<string> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appRootUrl() })
  return error ? humanError(error) : ''
}

export async function signOut() {
  await supabase.auth.signOut()
}

let started = false
export function initSync() {
  if (started) return
  started = true
  setState({ pending: Object.keys(readOutbox()).length })

  supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user
    const prev = state.user?.id
    setState({ ready: true, user: u ? { id: u.id, email: u.email ?? '', name: String(u.user_metadata?.name ?? '') } : null })
    if (u && u.id !== prev) scheduleSync(0)
  })

  window.addEventListener('online', () => scheduleSync(0))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(0)
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') scheduleSync(0)
  }, 60_000)
}
