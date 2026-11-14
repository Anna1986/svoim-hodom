import { useSyncExternalStore } from 'react'
import { CATEGORIES, type Category, type Item, type Trip } from './db'
import { matchAirport, matchStation, prettyStation } from './stations'

/* ---------- Какие карты открывать: Яндекс или Google ---------- */

export type MapProvider = 'yandex' | 'google'
const PROVIDER_KEY = 'map:provider'
const providerListeners = new Set<() => void>()

export function getMapProvider(): MapProvider {
  try {
    return localStorage.getItem(PROVIDER_KEY) === 'google' ? 'google' : 'yandex'
  } catch {
    return 'yandex'
  }
}

export function setMapProvider(p: MapProvider) {
  try { localStorage.setItem(PROVIDER_KEY, p) } catch { /* приватный режим */ }
  providerListeners.forEach((l) => l())
}

export function useMapProvider(): MapProvider {
  return useSyncExternalStore(
    (l) => { providerListeners.add(l); return () => providerListeners.delete(l) },
    getMapProvider,
  )
}

export const PROVIDER_LABEL: Record<MapProvider, string> = { yandex: 'Яндекс Картах', google: 'Google Картах' }

export type LatLng = [number, number]

export function pointUrl(p: MapProvider, [lat, lng]: LatLng): string {
  return p === 'yandex'
    ? `https://yandex.ru/maps/?ll=${lng},${lat}&z=16&pt=${lng},${lat}`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

export function routeUrl(p: MapProvider, pts: LatLng[]): string {
  if (p === 'yandex') {
    return `https://yandex.ru/maps/?rtext=${pts.map(([a, b]) => `${a},${b}`).join('~')}&rtt=mt`
  }
  const s = ([a, b]: LatLng) => `${a},${b}`
  const mid = pts.slice(1, -1)
  return `https://www.google.com/maps/dir/?api=1&origin=${s(pts[0])}&destination=${s(pts[pts.length - 1])}` +
    (mid.length ? `&waypoints=${encodeURIComponent(mid.map(s).join('|'))}` : '')
}

/* ---------- Геокодирование (OpenStreetMap Nominatim) ---------- */

// Ответы кэшируем на устройстве: адрес ищется один раз. 0 — «не нашли».
const CACHE_KEY = 'geo:v1'
let cache: Record<string, LatLng | 0> | null = null

function loadCache() {
  if (!cache) {
    try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { cache = {} }
  }
  return cache!
}

function saveCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch { /* переполнено — не страшно */ }
}

// Nominatim разрешает не больше одного запроса в секунду.
let queue: Promise<unknown> = Promise.resolve()
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function geocodeOnce(q: string): Promise<LatLng | null> {
  const key = q.trim().toLowerCase()
  const c = loadCache()
  if (key in c) return c[key] || null
  const run = queue.then(async () => {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ru&q=${encodeURIComponent(q)}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error('geocode ' + res.status)
    const data = (await res.json()) as { lat: string; lon: string }[]
    await pause(1100)
    return data[0] ? ([+data[0].lat, +data[0].lon] as LatLng) : null
  })
  queue = run.catch(() => pause(1100))
  const found = await run // сетевую ошибку не кэшируем — попробуем в следующий раз
  c[key] = found ?? 0
  saveCache()
  return found
}

/** Ищет место: сначала вместе с городом поездки, потом само по себе. */
export async function locate(text: string, context: string): Promise<LatLng | null> {
  const t = text.trim()
  if (!t) return null
  const ctx = context.trim()
  if (ctx && !t.toLowerCase().includes(ctx.toLowerCase())) {
    const hit = await geocodeOnce(`${t}, ${ctx}`)
    if (hit) return hit
  }
  return geocodeOnce(t)
}

/* ---------- Поиск мест при вводе адреса ---------- */

export interface PlaceHit { title: string; subtitle: string; text: string; ll: LatLng }

const uniq = (hits: PlaceHit[]) => hits.filter((h, i) => hits.findIndex((x) => x.text === h.text) === i)

/** Подсказки по мере ввода (сервис Photon на данных OpenStreetMap). near — искать ближе к этой точке. */
export async function suggestPlaces(q: string, near: LatLng | null, signal?: AbortSignal): Promise<PlaceHit[]> {
  const url = `https://photon.komoot.io/api/?limit=6&q=${encodeURIComponent(q)}` + (near ? `&lat=${near[0]}&lon=${near[1]}` : '')
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('suggest ' + res.status)
  const data = (await res.json()) as { features?: { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | undefined> }[] }
  const hits: PlaceHit[] = []
  for (const f of data.features ?? []) {
    const c = f.geometry?.coordinates
    const p = f.properties ?? {}
    if (!c) continue
    const street = [p.street, p.housenumber].filter(Boolean).join(', ')
    const city = p.city || p.town || p.village || p.county || p.state || ''
    const parts = [p.name, street, city !== p.name ? city : ''].filter(Boolean) as string[]
    if (!parts.length) continue
    const rest = [...parts.slice(1), p.country && p.country !== city ? p.country : ''].filter(Boolean).join(', ')
    hits.push({ title: parts[0], subtitle: rest, text: parts.join(', '), ll: [c[1], c[0]] })
  }
  return uniq(hits)
}

/** Поиск по кнопке (Nominatim) — когда подсказки ничего не нашли. */
export async function searchPlaces(q: string, context: string): Promise<PlaceHit[]> {
  const ask = async (text: string): Promise<PlaceHit[]> => {
    const run = queue.then(async () => {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=ru&q=${encodeURIComponent(text)}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error('search ' + res.status)
      const data = (await res.json()) as { lat: string; lon: string; name?: string; display_name: string }[]
      await pause(1100)
      return data.map((d) => {
        const parts = d.display_name.split(', ')
        const title = d.name || parts[0]
        const rest = parts.filter((x) => x !== title && !/^\d{5,6}$/.test(x)).slice(0, 4)
        return { title, subtitle: rest.join(', '), text: [title, ...rest.slice(0, 3)].join(', '), ll: [+d.lat, +d.lon] as LatLng }
      })
    })
    queue = run.catch(() => pause(1100))
    return run
  }
  const ctx = context.trim()
  let hits = await ask(q)
  if (!hits.length && ctx && !q.toLowerCase().includes(ctx.toLowerCase())) hits = await ask(`${q}, ${ctx}`)
  return uniq(hits)
}

/* ---------- Точки поездки ---------- */

export interface MapStop {
  key: string
  item: Item
  category: Category
  role: string // «Вылет», «Заселение», «Экскурсия»…
  query: string // что ищем
  context: string // город поездки — уточнение для поиска
  dates: string[] // в какие дни показывать
  time: string
  pairKey?: string // точка «откуда» для линии перелёта/переезда
  known?: LatLng // координаты известны заранее (вокзал, аэропорт)
}

function daysBetween(a: string, b: string): string[] {
  if (!a) return []
  if (!b || b <= a) return [a]
  const out: string[] = []
  const d = new Date(a + 'T00:00:00')
  const end = new Date(b + 'T00:00:00')
  while (d <= end && out.length < 60) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function buildStops(trip: Trip, items: Item[]): MapStop[] {
  const ctx = trip.destination || trip.title
  const stops: MapStop[] = []
  for (const item of items) {
    const cfg = CATEGORIES[item.category]
    if (!cfg.inPlan || (!cfg.place && !cfg.placeTo)) continue
    const start = item.startDate
    const end = item.endDate || item.startDate
    if (item.category === 'flight' || item.category === 'transport') {
      // вокзалы и аэропорты: сначала по своей таблице, иначе ищем «<город>, вокзал/аэропорт»
      const flight = item.category === 'flight'
      const spot = (raw: string) => {
        const k = flight ? matchAirport(raw) : matchStation(raw)
        return { query: k?.label ?? (flight ? raw : prettyStation(raw)), context: flight ? 'аэропорт' : 'вокзал', known: k?.ll }
      }
      if (item.place) stops.push({ key: item.id + ':from', item, category: item.category, role: cfg.start, ...spot(item.place), dates: start ? [start] : [], time: item.startTime })
      if (item.placeTo) stops.push({ key: item.id + ':to', item, category: item.category, role: cfg.end, ...spot(item.placeTo), dates: end ? [end] : [], time: item.endTime, pairKey: item.place ? item.id + ':from' : undefined })
      continue
    }
    if (item.category === 'car') {
      if (item.place) stops.push({ key: item.id + ':from', item, category: 'car', role: cfg.start, query: item.place, context: ctx, known: item.placeLL, dates: start ? [start] : [], time: item.startTime })
      if (item.placeTo && item.placeTo !== item.place) stops.push({ key: item.id + ':to', item, category: 'car', role: cfg.end, query: item.placeTo, context: ctx, known: item.placeToLL, dates: end ? [end] : [], time: item.endTime })
      continue
    }
    // жильё, события, другое: адрес, а если его нет — название (только вместе с городом поездки)
    const query = item.place || (ctx ? item.title : '')
    if (!query) continue
    const role = item.category === 'hotel' ? 'Жильё' : item.eventType ? '' : cfg.one
    stops.push({
      key: item.id, item, category: item.category, role, query, context: ctx, known: item.place ? item.placeLL : undefined,
      dates: item.category === 'hotel' ? daysBetween(start, end) : start ? [start] : [],
      time: item.category === 'hotel' ? '' : item.startTime,
    })
  }
  return stops
}

/** Порядок точек в течение дня: по времени; жильё — с утра, а в день заселения — по времени заселения. */
export function orderForDay(stops: MapStop[], date: string): MapStop[] {
  const t = (s: MapStop) =>
    s.category === 'hotel' ? (s.item.startDate === date ? s.item.startTime || '15:00' : '00:00') : s.time || '99:99'
  return stops.filter((s) => s.dates.includes(date)).sort((a, b) => t(a).localeCompare(t(b)))
}
