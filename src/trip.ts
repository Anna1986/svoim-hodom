import { CATEGORIES, db, type Doc, type Item, type Trip } from './db'
import { daysBetween, daysUntil, days, todayISO } from './format'

export type Phase = 'current' | 'upcoming' | 'past' | 'undated'

export function tripPhase(t: Trip): Phase {
  const today = todayISO()
  const start = t.startDate || t.endDate
  const end = t.endDate || t.startDate
  if (!start) return 'undated'
  if (end < today) return 'past'
  if (start > today) return 'upcoming'
  return 'current'
}

export function tripCountdown(t: Trip): string {
  const phase = tripPhase(t)
  if (phase === 'upcoming') {
    const n = daysUntil(t.startDate || t.endDate)!
    return n === 1 ? 'завтра' : `через ${days(n)}`
  }
  if (phase === 'current') {
    if (t.startDate && t.endDate) {
      const total = daysBetween(t.startDate, t.endDate) + 1
      const day = daysBetween(t.startDate, todayISO()) + 1
      return `в пути · день ${day} из ${total}`
    }
    return 'в пути'
  }
  return ''
}

/* ---------- План по дням ---------- */

export interface PlanEvent {
  key: string
  date: string
  time: string
  timeEnd: string
  label: string
  item: Item
}

export function buildPlan(items: Item[]): { byDay: [string, PlanEvent[]][]; undated: Item[] } {
  const events: PlanEvent[] = []
  const undated: Item[] = []

  for (const item of items) {
    const cfg = CATEGORIES[item.category]
    if (!cfg.inPlan) continue
    if (!item.startDate) {
      undated.push(item)
      continue
    }
    const sameDay = !item.endDate || item.endDate === item.startDate
    if (sameDay || !cfg.end) {
      events.push({
        key: item.id,
        date: item.startDate,
        time: item.startTime,
        timeEnd: sameDay ? item.endTime : '',
        label: cfg.start === 'Дата' || cfg.start === 'Начало' ? '' : cfg.start,
        item,
      })
    } else {
      events.push({ key: item.id + ':s', date: item.startDate, time: item.startTime, timeEnd: '', label: cfg.start, item })
      events.push({ key: item.id + ':e', date: item.endDate, time: item.endTime, timeEnd: '', label: cfg.end, item })
    }
  }

  events.sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))
  const map = new Map<string, PlanEvent[]>()
  for (const e of events) {
    if (!map.has(e.date)) map.set(e.date, [])
    map.get(e.date)!.push(e)
  }
  return { byDay: [...map.entries()], undated }
}

/* ---------- Сроки действия ---------- */

export function expiryHint(expiry: string): { text: string; tone: 'ok' | 'soon' | 'late' } | null {
  const n = daysUntil(expiry)
  if (n === null) return null
  if (n < 0) return { text: 'срок истёк', tone: 'late' }
  if (n <= 180) return { text: `истекает через ${days(n)}`, tone: 'soon' }
  return null
}

/** Многие страны требуют, чтобы загранпаспорт действовал ещё ~6 месяцев после выезда. */
export function passportWarnings(trip: Trip, docs: Doc[]): string[] {
  const tripEnd = trip.endDate || trip.startDate
  if (!tripEnd) return []
  const [y, m, d] = tripEnd.split('-').map(Number)
  const limit = new Date(y, m - 1 + 6, d)
  return docs
    .filter((doc) => doc.kind === 'intl-passport' && doc.expiryDate)
    .filter((doc) => {
      const [ey, em, ed] = doc.expiryDate.split('-').map(Number)
      return new Date(ey, em - 1, ed) < limit
    })
    .map((doc) => `${doc.title || 'Загранпаспорт'}${doc.holder ? ` (${doc.holder})` : ''} действует меньше 6 месяцев после окончания поездки. Многие страны этого не допускают — проверьте требования.`)
}

/* ---------- Даты поездки по билетам ---------- */

const isTicket = (i: Item) => (i.category === 'flight' || i.category === 'transport') && Boolean(i.startDate)

/**
 * Если билеты на самолёт или поезд выходят за даты поездки, расширяем поездку:
 * начало — не позже первого отправления, конец — не раньше последнего прибытия.
 * Даты только расширяются: если билеты внутри плана, план не меняется.
 */
export function fittedDates(trip: Pick<Trip, 'startDate' | 'endDate'>, items: Item[]): { startDate: string; endDate: string } {
  const tickets = items.filter(isTicket)
  if (!tickets.length) return { startDate: trip.startDate, endDate: trip.endDate }
  const first = tickets.map((t) => t.startDate).sort()[0]
  const last = tickets.map((t) => t.endDate || t.startDate).sort().at(-1)!
  return {
    startDate: !trip.startDate || first < trip.startDate ? first : trip.startDate,
    endDate: !trip.endDate || last > trip.endDate ? last : trip.endDate,
  }
}

export async function fitTripToTickets(tripId: string) {
  const trip = await db.trips.get(tripId)
  if (!trip) return
  const items = await db.items.where('tripId').equals(tripId).toArray()
  const next = fittedDates(trip, items)
  if (next.startDate !== trip.startDate || next.endDate !== trip.endDate) {
    await db.trips.update(tripId, { ...next, updatedAt: Date.now() })
  }
}
