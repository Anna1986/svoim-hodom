/**
 * «Куда поехать» без внешних API: собственная подборка направлений
 * и прямые ссылки на поиск Авиасейлс (без партнёрского кода).
 */
import { supabase } from './supabase'
import type { CoverKey } from './covers'

export interface Place { code: string; name: string; country: string }

/** Города вылета (IATA-код города). */
export const HOME_CITIES: Place[] = [
  ['MOW', 'Москва'], ['LED', 'Санкт-Петербург'], ['KUF', 'Самара'], ['KZN', 'Казань'], ['SVX', 'Екатеринбург'],
  ['OVB', 'Новосибирск'], ['GOJ', 'Нижний Новгород'], ['UFA', 'Уфа'], ['PEE', 'Пермь'], ['KRR', 'Краснодар'],
  ['AER', 'Сочи'], ['ROV', 'Ростов-на-Дону'], ['VOG', 'Волгоград'], ['RTW', 'Саратов'], ['REN', 'Оренбург'],
  ['ULV', 'Ульяновск'], ['CEK', 'Челябинск'], ['TJM', 'Тюмень'], ['OMS', 'Омск'], ['KJA', 'Красноярск'],
  ['IKT', 'Иркутск'], ['VVO', 'Владивосток'], ['KHV', 'Хабаровск'], ['KGD', 'Калининград'], ['MRV', 'Минеральные Воды'],
  ['MCX', 'Махачкала'], ['MMK', 'Мурманск'], ['ARH', 'Архангельск'],
  ['MSQ', 'Минск'], ['ALA', 'Алматы'], ['NQZ', 'Астана'], ['TAS', 'Ташкент'], ['EVN', 'Ереван'], ['TBS', 'Тбилиси'], ['GYD', 'Баку'],
].map(([code, name]) => ({ code, name, country: '' }))

export type Mood = 'sea' | 'city' | 'nature' | 'tropics' | 'russia'

export const MOODS: { key: Mood; label: string }[] = [
  { key: 'sea', label: 'Море и пляж' },
  { key: 'city', label: 'Города' },
  { key: 'nature', label: 'Горы и природа' },
  { key: 'tropics', label: 'Тропики' },
  { key: 'russia', label: 'По России' },
]

export interface Destination {
  code: string
  city: string
  country: string
  cover: CoverKey
  moods: Mood[]
  blurb: string
}

const d = (code: string, city: string, country: string, cover: CoverKey, moods: Mood[], blurb: string): Destination =>
  ({ code, city, country, cover, moods, blurb })

export const DESTINATIONS: Destination[] = [
  d('IST', 'Стамбул', 'Турция', 'istanbul', ['city'], 'Босфор, мечети, базары и уличная еда'),
  d('AYT', 'Анталья', 'Турция', 'beach', ['sea'], 'Тёплое море, всё включено и древние города рядом'),
  d('TBS', 'Тбилиси', 'Грузия', 'mountains', ['city', 'nature'], 'Старый город, серные бани, горы в часе езды'),
  d('EVN', 'Ереван', 'Армения', 'mountains', ['city', 'nature'], 'Розовый город с видом на Арарат'),
  d('GYD', 'Баку', 'Азербайджан', 'istanbul', ['city', 'sea'], 'Старая крепость и небоскрёбы у Каспия'),
  d('DXB', 'Дубай', 'ОАЭ', 'moscow', ['city', 'sea'], 'Небоскрёбы, пляжи и солнце даже зимой'),
  d('HRG', 'Хургада', 'Египет', 'beach', ['sea'], 'Красное море, рифы и снорклинг'),
  d('SSH', 'Шарм-эль-Шейх', 'Египет', 'beach', ['sea'], 'Кораллы, дайвинг и тёплая зима'),
  d('TIV', 'Тиват', 'Черногория', 'amalfi', ['sea', 'nature'], 'Бока-Которская бухта и горы над морем'),
  d('BEG', 'Белград', 'Сербия', 'paris', ['city'], 'Европейский город без визы, кафаны и Дунай'),
  d('MLE', 'Мальдивы', 'Мальдивы', 'tropics', ['tropics', 'sea'], 'Бирюзовые лагуны и виллы над водой'),
  d('HKT', 'Пхукет', 'Таиланд', 'tropics', ['tropics', 'sea'], 'Пляжи, острова и тайская кухня'),
  d('CXR', 'Нячанг', 'Вьетнам', 'tropics', ['tropics', 'sea'], 'Длинный городской пляж и острова'),
  d('DPS', 'Бали', 'Индонезия', 'tropics', ['tropics', 'nature'], 'Рисовые террасы, храмы и сёрфинг'),
  d('CMB', 'Шри-Ланка', 'Шри-Ланка', 'tropics', ['tropics', 'nature'], 'Чайные плантации, слоны и океан'),
  d('SYX', 'Хайнань', 'Китай', 'tropics', ['tropics', 'sea'], 'Китайские тропики с мягким климатом'),
  d('ALA', 'Алматы', 'Казахстан', 'mountains', ['city', 'nature'], 'Город у подножия гор, Медео и Чимбулак'),
  d('TAS', 'Ташкент', 'Узбекистан', 'istanbul', ['city'], 'Плов, базары и дорога в Самарканд'),
  d('LED', 'Санкт-Петербург', 'Россия', 'paris', ['city', 'russia'], 'Эрмитаж, каналы и белые ночи'),
  d('MOW', 'Москва', 'Россия', 'moscow', ['city', 'russia'], 'Музеи, театры и Москва-Сити'),
  d('KZN', 'Казань', 'Россия', 'istanbul', ['city', 'russia'], 'Кремль, чак-чак и Волга'),
  d('KGD', 'Калининград', 'Россия', 'paris', ['city', 'sea', 'russia'], 'Немецкая архитектура и Балтийское море'),
  d('AER', 'Сочи', 'Россия', 'amalfi', ['sea', 'nature', 'russia'], 'Море летом и Красная Поляна зимой'),
  d('MRV', 'Минеральные Воды', 'Россия', 'mountains', ['nature', 'russia'], 'Кавказские курорты, Эльбрус и Домбай'),
  d('IKT', 'Иркутск', 'Россия', 'mountains', ['nature', 'russia'], 'Байкал: лёд зимой, походы летом'),
  d('MMK', 'Мурманск', 'Россия', 'mountains', ['nature', 'russia'], 'Северное сияние и Териберка'),
  d('MCX', 'Махачкала', 'Россия', 'mountains', ['nature', 'sea', 'russia'], 'Сулакский каньон и Каспий'),
  d('RGK', 'Горно-Алтайск', 'Россия', 'mountains', ['nature', 'russia'], 'Алтай: Чуйский тракт и горные озёра'),
]

/* ---------- Ссылки на Авиасейлс ---------- */

const ddmm = (iso: string) => iso.slice(8, 10) + iso.slice(5, 7)

/** Поиск на Авиасейлс: /search/KUF1512IST22121 — откуда, дата туда, куда, дата обратно, пассажиры. */
export function aviasalesSearch(origin: string, dest: string, depart: string, ret: string, passengers = 1): string {
  return `https://www.aviasales.ru/search/${origin}${ddmm(depart)}${dest}${ret ? ddmm(ret) : ''}${passengers}`
}

export function aviasalesHot(origin: string): string {
  return `https://www.aviasales.ru/hottickets/${origin.toLowerCase()}`
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
