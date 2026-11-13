import type { Category, EventType, Item } from './db'
import { AIRLINES, AIRPORTS } from './airports'
import { prettyStation } from './stations'

/**
 * Распознавание билетов и броней по тексту файла.
 * Работает на устройстве, без интернета и внешних сервисов: ищет даты, время,
 * номера рейсов и поездов, коды аэропортов, номера броней и адреса по подписям.
 */

export type ParsedFields = Partial<Pick<Item,
  'title' | 'place' | 'placeTo' | 'startDate' | 'startTime' | 'endDate' | 'endTime' | 'bookingRef' | 'notes' | 'eventType'>>

export interface ParsedTicket {
  category: Category
  fields: ParsedFields
}

/* ---------- Даты и время ---------- */

const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'ма', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function monthIndex(word: string): number {
  const w = word.toLowerCase()
  const en = EN_MONTHS.indexOf(w.slice(0, 3))
  if (en >= 0) return en + 1
  if (/^ма[йяе]/.test(w)) return 5
  const ru = RU_MONTHS.findIndex((m) => m !== 'ма' && w.startsWith(m))
  return ru >= 0 ? ru + 1 : 0
}

const pad = (n: number) => String(n).padStart(2, '0')

function iso(y: number, m: number, d: number, today: Date): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  if (!y) {
    // года нет — ближайшая такая дата, не раньше чем месяц назад
    y = today.getFullYear()
    const candidate = new Date(y, m - 1, d)
    if (candidate.getTime() < today.getTime() - 30 * 864e5) y += 1
  } else if (y < 100) y += 2000
  const dt = new Date(y, m - 1, d)
  if (dt.getMonth() !== m - 1) return null
  // даты рождения, сроки паспорта и т. п. отбрасываем
  if (dt.getTime() < today.getTime() - 400 * 864e5 || dt.getTime() > today.getTime() + 3 * 365 * 864e5) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

export interface FoundDate { date: string; time: string; index: number; before: string }

const MON_RU = '(янв|фев|мар|апр|ма[йяе]|июн|июл|авг|сен|окт|ноя|дек)[а-яё]*\\.?'
const MON_EN = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?'
const TIME = /(?:^|[^\d])([01]?\d|2[0-3])[:ч]\s?([0-5]\d)(?!\d)/

// Даты рядом с такими словами — не про поездку (оформление, оплата, рождение…)
const NOT_TRIP = /оформ|выдан|выписан|продаж|оплат|рожд|birth|issue|expir|действ|покупк|создан|печат|printed|бронирования от|заказ от|отмен|cancel|дата заказа|order date|до \d|until/i

export function findDates(text: string, today = new Date()): FoundDate[] {
  const out: FoundDate[] = []
  const patterns: [RegExp, (m: RegExpExecArray) => [number, number, number]][] = [
    [/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g, (m) => [+m[1], +m[2], +m[3]]],
    [/(?<![\d.])(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?![\d])/g, (m) => [+m[3], +m[2], +m[1]]],
    [new RegExp(`(?<!\\d)(\\d{1,2})\\s*${MON_RU}(?:,?\\s*(\\d{4}))?`, 'gi'), (m) => [+(m[3] ?? 0), monthIndex(m[2]), +m[1]]],
    [new RegExp(`(?<!\\d)(\\d{1,2})\\s*-?${MON_EN}(?:-?(\\d{2})(?![\\d:])|,?\\s+(\\d{4})(?![\\d:]))?`, 'gi'), (m) => [+(m[3] ?? m[4] ?? 0), monthIndex(m[2]), +m[1]]],
    [new RegExp(`\\b${MON_EN}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'gi'), (m) => [+m[3], monthIndex(m[1]), +m[2]]],
    // «25.11 07:50» — день и месяц без года, только если сразу после идёт время
    [/(?<![\d.])(\d{1,2})\.(\d{2})(?![.\d])(?=\s*(?:в\s*)?\d{1,2}:\d{2})/g, (m) => [0, +m[2], +m[1]]],
  ]
  for (const [re, pick] of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const [y, mo, d] = pick(m)
      const date = iso(y, mo, d, today)
      if (!date) continue
      const end = m.index + m[0].length
      const after = text.slice(end, end + 22)
      const t = after.match(TIME) ?? text.slice(Math.max(0, m.index - 12), m.index).match(TIME)
      const before = text.slice(Math.max(0, m.index - 60), m.index)
      out.push({ date, time: t ? `${pad(+t[1])}:${t[2]}` : '', index: m.index, before })
    }
  }
  out.sort((a, b) => a.index - b.index)
  // одна и та же дата, найденная разными шаблонами
  const uniq = out.filter((d, i) => !out.some((o, j) => j < i && Math.abs(o.index - d.index) < 4))
  return uniq.filter((d) => !NOT_TRIP.test(lastLine(d.before)))
}

const lastLine = (s: string) => s.split('\n').slice(-2).join(' ').slice(-45)

/* ---------- Подписи «Название: значение» ---------- */

function labelValue(text: string, labels: string, value = '([^\\n]{2,90})'): string {
  const re = new RegExp(`(?:${labels})\\s*(?:[:№#]|\\(?[a-z ]*\\)?:)?\\s*${value}`, 'i')
  const m = text.match(re)
  return m ? m[1].trim().replace(/\s{2,}/g, ' ').replace(/[,;.]$/, '') : ''
}

const REF_LABELS =
  'код (?:брони(?:рования)?|бронирования)|номер (?:брони(?:рования)?|бронирования|заказа|подтверждения|бронь)|бронирование\\s*№|№ (?:брони|заказа)|' +
  'pnr|booking (?:ref(?:erence)?|code|number|id)|confirmation (?:number|code|no\\.?)|reservation (?:number|code)|record locator|order (?:number|no\\.?|id)'

function bookingRef(text: string): string {
  const v = labelValue(text, REF_LABELS, '([A-ZА-Я0-9][A-ZА-Я0-9.\\-]{3,24})')
  return /\d|^[A-Z]{5,6}$/.test(v) ? v : ''
}

/* ---------- Определение вида записи ---------- */

const KINDS: [Category, RegExp][] = [
  ['flight', /авиа|рейс|аэропорт|airport|flight|boarding|посадочн|маршрутн(?:ая|ой) квитанци|itinerary|багаж|baggage|авиакомпан|airline|терминал|terminal|выход на посадку|gate/gi],
  ['transport', /поезд|вагон|ржд|train|ласточк|сапсан|автобус|bus\b|перрон|платформ|станци|вокзал|купе|плацкарт|электричк|туту|tutu/gi],
  ['hotel', /заезд|выезд|заселени|check.?in|check.?out|отел|hotel|гостиниц|ноч(?:ь|и|ей)\b|nights?\b|апартамент|apartment|хостел|hostel|островок|ostrovok|booking\.com|размещени|guest ?house|номер (?:стандарт|делюкс|с видом)/gi],
  ['car', /аренд[аы] (?:авто|автомобил|машин)|прокат|rent.?a.?car|car rental|pick.?up location|автомобиль класса|получение автомобиля|возврат автомобиля/gi],
  ['voucher', /спектакл|концерт|театр|музей|выставк|экскурси|сеанс|партер|амфитеатр|бельэтаж|ложа|ряд\s*\d|мероприяти|event|venue|афиша|kassir|ticketland|ресторан|столик/gi],
]

function guessCategory(text: string, flightNo: string, airports: string[]): Category {
  const score: Partial<Record<Category, number>> = {}
  for (const [c, re] of KINDS) score[c] = new Set((text.match(re) ?? []).map((s) => s.toLowerCase())).size
  if (flightNo) score.flight = (score.flight ?? 0) + 2
  if (airports.length >= 2) score.flight = (score.flight ?? 0) + 2
  let best: Category = 'other', max = 0
  for (const [c, n] of Object.entries(score) as [Category, number][]) if (n > max) { best = c; max = n }
  return max >= 2 ? best : max === 1 ? best : 'other'
}

/* ---------- Отдельные реквизиты ---------- */

function flightNumber(text: string): string {
  const re = /(?<![A-Z0-9])([A-Z0-9]{2})\s?-?\s?(\d{2,4})(?!\d)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (AIRLINES.has(m[1]) && /[A-Z]/.test(m[1])) return `${m[1]} ${m[2]}`
  }
  return ''
}

function airportCodes(text: string): string[] {
  const out: string[] = []
  const re = /(?<![A-Za-z])([A-Z]{3})(?![A-Za-z])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (AIRPORTS[m[1]] && out[out.length - 1] !== m[1]) out.push(m[1])
  }
  return out
}

const cityOf = (place: string) => place.split(',')[0]

function routePair(text: string): [string, string] {
  // «МОСКВА ОКТ — САНКТ-ПЕТЕРБУРГ ГЛАВН» или «Москва → Казань»
  const m = text.match(/(?:^|\n|\s)([А-ЯЁ][А-ЯЁа-яё0-9 .\-]{2,35}?)\s*(?:—|–|→|->|\s-\s)\s*([А-ЯЁ][А-ЯЁа-яё0-9 .\-]{2,35}?)(?=\s*(?:\n|$|\d|,|\())/)
  return m ? [m[1].trim(), m[2].trim()] : ['', '']
}

const FROM_LABELS = 'откуда|пункт отправления|станция отправления|отправление из|from'
const TO_LABELS = 'куда|пункт назначения|пункт прибытия|станция (?:назначения|прибытия)|to'

function seatNotes(text: string): string {
  const parts: string[] = []
  const wagon = text.match(/вагон\s*(?:№\s*)?(\d{1,2})/i)
  if (wagon) parts.push(`Вагон ${+wagon[1]}`)
  const row = text.match(/ряд\s*(?:№\s*)?(\d{1,3})/i)
  if (row) parts.push(`ряд ${row[1]}`)
  const seat = text.match(/(?:мест[оа]|seat)\s*(?:№\s*)?(\d{1,3}[A-KА-К]?)\b/i)
  if (seat) parts.push(`место ${seat[1]}`)
  const ticket = labelValue(text, 'номер (?:электронного )?билета|e-?ticket(?: number| no\\.?)?|ticket number|№ билета', '(\\d[\\d \\-]{8,20}\\d)')
  if (ticket) parts.push(`билет ${ticket}`)
  const s = parts.join(', ')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function phoneNote(text: string): string {
  const m = text.match(/(?:тел(?:ефон)?|phone)[^\d+\n]{0,12}(\+?\d[\d ()\-]{8,18}\d)/i)
  return m ? `Телефон: ${m[1].trim()}` : ''
}

function addressOf(text: string): string {
  return labelValue(text, 'адрес(?: объекта| отеля| проведения| площадки)?|address|место проведения|площадка|venue|location')
}

function guessEventType(text: string): EventType | undefined {
  const t = text.toLowerCase()
  if (/спектакл|театр|балет|опер[аы]/.test(t)) return 'theatre'
  if (/концерт|concert/.test(t)) return 'concert'
  if (/музей|выставк|галере|museum/.test(t)) return 'museum'
  if (/экскурси|tour\b/.test(t)) return 'tour'
  if (/ресторан|столик|restaurant/.test(t)) return 'restaurant'
  if (/цирк|шоу|show/.test(t)) return 'show'
  if (/матч|стадион|арена|match/.test(t)) return 'sport'
  return undefined
}

/** Первая подходящая пара «начало — конец» по подписям, иначе по порядку в тексте. */
function startEnd(dates: FoundDate[], startRe: RegExp, endRe: RegExp): [FoundDate | undefined, FoundDate | undefined] {
  if (!dates.length) return [undefined, undefined]
  const key = (d: FoundDate) => d.date + (d.time || '99:99')
  const labeledStart = dates.find((d) => startRe.test(lastLine(d.before)) && !endRe.test(lastLine(d.before)))
  const labeledEnd = dates.find((d) => endRe.test(lastLine(d.before)) && !startRe.test(lastLine(d.before)) && d !== labeledStart)
  const withTime = dates.filter((d) => d.time)
  const pool = withTime.length >= 2 ? withTime : dates
  const start = labeledStart ?? pool.find((d) => d !== labeledEnd) ?? dates[0]
  const end = labeledEnd ??
    pool.find((d) => d.index > start.index && key(d) >= key(start) && (d.date !== start.date || d.time !== start.time))
  return [start, end]
}

/* ---------- Главная функция ---------- */

export function parseTicket(raw: string, today = new Date()): ParsedTicket {
  const text = raw.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n')
  const flightNo = flightNumber(text)
  const codes = airportCodes(text)
  const category = guessCategory(text, flightNo, codes)
  const dates = findDates(text, today)
  const f: ParsedFields = {}
  const ref = bookingRef(text)
  if (ref) f.bookingRef = ref

  const setDates = (a?: FoundDate, b?: FoundDate) => {
    if (a) { f.startDate = a.date; if (a.time) f.startTime = a.time }
    if (b) { f.endDate = b.date; if (b.time) f.endTime = b.time }
  }

  if (category === 'flight') {
    const [from, to] = codes.length >= 2 ? [AIRPORTS[codes[0]], AIRPORTS[codes.find((c) => c !== codes[0])!]] : routePair(text)
    if (from) f.place = from
    if (to) f.placeTo = to
    setDates(...startEnd(dates, /вылет|departure|depart|отправлен/i, /прилёт|прилет|прибыти|arrival|arrive/i))
    f.title = [flightNo, from && to ? `${cityOf(from)} — ${cityOf(to)}` : ''].filter(Boolean).join(' ')
    const notes = seatNotes(text)
    if (notes) f.notes = notes
  } else if (category === 'transport') {
    let from = labelValue(text, FROM_LABELS), to = labelValue(text, TO_LABELS)
    if (!from || !to) [from, to] = routePair(text)
    from = from.replace(/\s*\d{1,2}[.:]\d{2}.*$/, ''); to = to.replace(/\s*\d{1,2}[.:]\d{2}.*$/, '')
    const fromCity = prettyStation(from).split(',')[0], toCity = prettyStation(to).split(',')[0]
    from = prettyStation(from); to = prettyStation(to)
    if (from) f.place = from
    if (to) f.placeTo = to
    setDates(...startEnd(dates, /отправлен|departure|отъезд/i, /прибыти|arrival/i))
    const train = text.match(/поезд\s*(?:№\s*)?(\d{1,4}\s?[А-ЯЁA-Z]{0,2})(?![а-яё])/i)
    const bus = !train && /автобус|bus\b/i.test(text)
    const what = train ? `Поезд ${train[1].replace(/\s/g, '')}` : bus ? 'Автобус' : 'Поезд'
    f.title = [what, fromCity && toCity ? `${fromCity} — ${toCity}` : ''].filter(Boolean).join(' ')
    const notes = seatNotes(text)
    if (notes) f.notes = notes
  } else if (category === 'hotel') {
    setDates(...startEnd(dates, /заезд|заселени|прибыти|check.?in|arrival/i, /выезд|отъезд|check.?out|departure/i))
    const addr = addressOf(text)
    if (addr) f.place = addr
    const name =
      labelValue(text, 'отель|гостиница|объект размещения|объект|название объекта|property|hotel name|accommodation') ||
      (text.split('\n').find((l) => /отель|hotel|гостиниц|хостел|hostel|апарт|apart|guest ?house|resort|inn\b/i.test(l) && l.length < 70 && !/брон|book|confirm|заезд|check/i.test(l)) ?? '')
    if (name) f.title = name.trim()
    const notes = phoneNote(text)
    if (notes) f.notes = notes
  } else if (category === 'car') {
    setDates(...startEnd(dates, /получени|выдач|pick.?up|начало аренды/i, /возврат|сдач|drop.?off|return|окончание аренды/i))
    const from = labelValue(text, 'место получения|пункт выдачи|получение|pick.?up location|pick.?up')
    const to = labelValue(text, 'место возврата|пункт возврата|возврат|drop.?off location|return location')
    if (from && !/^\d/.test(from)) f.place = from
    if (to && !/^\d/.test(to)) f.placeTo = to
    const company = text.match(/\b(sixt|hertz|avis|europcar|budget|enterprise|rentalcars|делимобиль|ситидрайв|каршеринг)\b/i)
    if (company) f.title = company[1].charAt(0).toUpperCase() + company[1].slice(1)
  } else {
    setDates(...startEnd(dates, /начал|дата|date|start|сеанс/i, /оконч|конец|end/i))
    const addr = addressOf(text)
    if (addr) f.place = addr
    const name = labelValue(text, 'мероприятие|событие|спектакль|концерт|экскурсия|название|event')
    if (name) f.title = name
    if (category === 'voucher') {
      const t = guessEventType(text)
      if (t) f.eventType = t
    }
    const notes = seatNotes(text)
    if (notes) f.notes = notes
  }

  if (f.endDate && f.startDate && f.endDate < f.startDate) { delete f.endDate; delete f.endTime }
  if (!f.title) delete f.title
  return { category, fields: f }
}

export const FIELD_NAMES: Record<keyof ParsedFields, string> = {
  title: 'название', place: 'откуда / адрес', placeTo: 'куда', startDate: 'дата', startTime: 'время',
  endDate: 'дата окончания', endTime: 'время окончания', bookingRef: 'номер брони', notes: 'заметки', eventType: 'вид события',
}
