import Dexie, { type EntityTable } from 'dexie'

/* ---------------- Поездки ---------------- */

export interface Trip {
  id: string
  title: string
  destination: string
  startDate: string // YYYY-MM-DD или ''
  endDate: string
  notes: string
  cover?: string // ключ обложки; пусто — подбирается автоматически по направлению
  createdAt: number
  updatedAt: number
}

/* ---------------- Записи внутри поездки (папки) ---------------- */

export type Category =
  | 'flight'
  | 'transport'
  | 'hotel'
  | 'car'
  | 'voucher'
  | 'visa'
  | 'insurance'
  | 'route'
  | 'other'

export interface CategoryConfig {
  label: string // название папки
  one: string // одна запись
  add: string // для кнопки «Добавить …» (винительный падеж)
  icon: string
  start: string // подпись начала (Вылет, Заселение…)
  end: string // подпись окончания ('' — нет)
  place: string // подпись поля «место» ('' — нет поля)
  placeTo: string // подпись второго места ('' — нет поля)
  ref: string // подпись номера брони ('' — нет поля)
  withTime: boolean // есть ли время
  inPlan: boolean // показывать ли в плане по дням
  titlePlaceholder: string
}

export const CATEGORIES: Record<Category, CategoryConfig> = {
  flight: {
    label: 'Авиабилеты', one: 'Авиабилет', add: 'авиабилет', icon: '✈️',
    start: 'Вылет', end: 'Прилёт', place: 'Откуда', placeTo: 'Куда',
    ref: 'Номер брони (PNR)', withTime: true, inPlan: true,
    titlePlaceholder: 'Например, SU 2130 Москва — Стамбул',
  },
  transport: {
    label: 'Поезда и автобусы', one: 'Билет', add: 'билет', icon: '🚆',
    start: 'Отправление', end: 'Прибытие', place: 'Откуда', placeTo: 'Куда',
    ref: 'Номер билета', withTime: true, inPlan: true,
    titlePlaceholder: 'Например, Поезд Рим — Флоренция',
  },
  hotel: {
    label: 'Жильё', one: 'Бронь жилья', add: 'бронь жилья', icon: '🏨',
    start: 'Заселение', end: 'Выезд', place: 'Адрес', placeTo: '',
    ref: 'Номер брони', withTime: true, inPlan: true,
    titlePlaceholder: 'Например, Hotel Roma Centro',
  },
  car: {
    label: 'Аренда авто', one: 'Аренда авто', add: 'аренду авто', icon: '🚗',
    start: 'Получение', end: 'Возврат', place: 'Где получить', placeTo: 'Где вернуть',
    ref: 'Номер брони', withTime: true, inPlan: true,
    titlePlaceholder: 'Например, Sixt, Toyota Corolla',
  },
  voucher: {
    label: 'События', one: 'Событие', add: 'событие', icon: '🎟️',
    start: 'Начало', end: 'Окончание', place: 'Место или адрес', placeTo: '',
    ref: 'Номер билета или брони', withTime: true, inPlan: true,
    titlePlaceholder: 'Например, Большой театр — «Щелкунчик»',
  },
  visa: {
    label: 'Визы', one: 'Виза', add: 'визу', icon: '🛂',
    start: 'Действует с', end: 'Действует до', place: '', placeTo: '',
    ref: 'Номер визы', withTime: false, inPlan: false,
    titlePlaceholder: 'Например, Шенгенская виза',
  },
  insurance: {
    label: 'Страховки', one: 'Страховка', add: 'страховку', icon: '🛡️',
    start: 'Действует с', end: 'Действует до', place: '', placeTo: '',
    ref: 'Номер полиса', withTime: false, inPlan: false,
    titlePlaceholder: 'Например, Страховка на поездку',
  },
  route: {
    label: 'Маршруты', one: 'Маршрут', add: 'маршрут', icon: '🗺️',
    start: 'Дата', end: '', place: '', placeTo: '',
    ref: '', withTime: false, inPlan: true,
    titlePlaceholder: 'Например, Прогулка по центру',
  },
  other: {
    label: 'Другое', one: 'Запись', add: 'запись', icon: '📎',
    start: 'Дата', end: 'Дата окончания', place: 'Место', placeTo: '',
    ref: 'Номер', withTime: true, inPlan: true,
    titlePlaceholder: 'Например, Столик в ресторане',
  },
}

export const CATEGORY_ORDER = Object.keys(CATEGORIES) as Category[]

/* ---------- Виды событий ---------- */

export type EventType =
  | 'tour' | 'museum' | 'theatre' | 'concert' | 'show' | 'restaurant'
  | 'cafe' | 'bar' | 'party' | 'sport' | 'spa' | 'other'

export const EVENT_TYPES: Record<EventType, { label: string; icon: string; placeholder: string }> = {
  tour: { label: 'Экскурсия', icon: '🚶', placeholder: 'Например, Обзорная экскурсия по центру' },
  museum: { label: 'Музей', icon: '🏛️', placeholder: 'Например, Третьяковская галерея' },
  theatre: { label: 'Театр', icon: '🎭', placeholder: 'Например, Большой театр — «Щелкунчик»' },
  concert: { label: 'Концерт', icon: '🎵', placeholder: 'Например, Концерт в Зарядье' },
  show: { label: 'Шоу', icon: '🎪', placeholder: 'Например, Цирк на Цветном' },
  restaurant: { label: 'Ресторан', icon: '🍽️', placeholder: 'Например, Ужин в «Пушкине»' },
  cafe: { label: 'Кафе', icon: '☕', placeholder: 'Например, Завтрак в кофейне' },
  bar: { label: 'Бар', icon: '🍸', placeholder: 'Например, Коктейльный бар на крыше' },
  party: { label: 'Вечеринка', icon: '🎉', placeholder: 'Например, AI-Agents party' },
  sport: { label: 'Спорт', icon: '⚽', placeholder: 'Например, Матч ЦСКА — Спартак' },
  spa: { label: 'СПА', icon: '💆', placeholder: 'Например, Сандуновские бани' },
  other: { label: 'Другое', icon: '✨', placeholder: 'Например, Мастер-класс' },
}

export const EVENT_TYPE_ORDER = Object.keys(EVENT_TYPES) as EventType[]

export function eventTypeOf(item: { category: Category; eventType?: string }) {
  return item.category === 'voucher' && item.eventType && item.eventType in EVENT_TYPES
    ? EVENT_TYPES[item.eventType as EventType]
    : null
}

export interface Item {
  id: string
  tripId: string
  category: Category
  title: string
  place: string
  placeTo: string
  startDate: string
  startTime: string // HH:MM, местное время, ''
  endDate: string
  endTime: string
  bookingRef: string
  eventType?: EventType // только для событий
  link: string
  notes: string
  createdAt: number
  updatedAt: number
}

/* ---------------- Мои документы (не привязаны к поездке) ---------------- */

export type DocKind = 'intl-passport' | 'passport' | 'license' | 'insurance' | 'card' | 'other'

export const DOC_KINDS: Record<DocKind, { label: string; icon: string }> = {
  'intl-passport': { label: 'Загранпаспорт', icon: '🛂' },
  passport: { label: 'Паспорт', icon: '🪪' },
  license: { label: 'Водительские права', icon: '🚗' },
  insurance: { label: 'Страховой полис', icon: '🛡️' },
  card: { label: 'Карта лояльности', icon: '💳' },
  other: { label: 'Другой документ', icon: '📄' },
}

export interface Doc {
  id: string
  kind: DocKind
  title: string
  holder: string
  number: string
  expiryDate: string
  notes: string
  createdAt: number
  updatedAt: number
}

/* ---------------- Файлы ---------------- */

export type OwnerType = 'item' | 'doc'

export interface Attachment {
  id: string
  ownerType: OwnerType
  ownerId: string
  name: string
  mime: string
  size: number
  blob: Blob
  createdAt: number
}

/* ---------------- База ---------------- */

export const db = new Dexie('travel') as Dexie & {
  trips: EntityTable<Trip, 'id'>
  items: EntityTable<Item, 'id'>
  docs: EntityTable<Doc, 'id'>
  attachments: EntityTable<Attachment, 'id'>
}

db.version(1).stores({
  trips: 'id, startDate',
  items: 'id, tripId, category, startDate',
  docs: 'id, kind',
  attachments: 'id, ownerId',
})

export function newId(): string {
  return crypto.randomUUID()
}

export async function addAttachments(ownerType: OwnerType, ownerId: string, files: File[]) {
  const now = Date.now()
  // Копируем содержимое в память: в Safari файл из окна выбора, сохранённый как есть,
  // позже может читаться пустым.
  const blobs = await Promise.all(files.map(async (f) => new Blob([await f.arrayBuffer()], { type: f.type || 'application/octet-stream' })))
  await db.attachments.bulkAdd(
    files.map((f, i) => ({
      id: newId(),
      ownerType,
      ownerId,
      name: f.name || 'файл',
      mime: f.type || 'application/octet-stream',
      size: blobs[i].size,
      blob: blobs[i],
      createdAt: now + i,
    })),
  )
}

export async function deleteItem(id: string) {
  await db.transaction('rw', db.items, db.attachments, async () => {
    await db.attachments.where('ownerId').equals(id).delete()
    await db.items.delete(id)
  })
}

export async function deleteDoc(id: string) {
  await db.transaction('rw', db.docs, db.attachments, async () => {
    await db.attachments.where('ownerId').equals(id).delete()
    await db.docs.delete(id)
  })
}

export async function deleteTrip(id: string) {
  await db.transaction('rw', db.trips, db.items, db.attachments, async () => {
    const itemIds = (await db.items.where('tripId').equals(id).primaryKeys()) as string[]
    if (itemIds.length) await db.attachments.where('ownerId').anyOf(itemIds).delete()
    await db.items.where('tripId').equals(id).delete()
    await db.trips.delete(id)
  })
}

/** Просим браузер не удалять данные при нехватке места (важно на телефонах). */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    /* не критично */
  }
}
