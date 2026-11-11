import type { Trip } from './db'
import santorini from './assets/covers/santorini.webp'
import paris from './assets/covers/paris.webp'
import tropics from './assets/covers/tropics.webp'
import istanbul from './assets/covers/istanbul.webp'
import mountains from './assets/covers/mountains.webp'
import moscow from './assets/covers/moscow.webp'
import amalfi from './assets/covers/amalfi.webp'
import beach from './assets/covers/beach.webp'

export type CoverKey = 'santorini' | 'paris' | 'tropics' | 'istanbul' | 'mountains' | 'moscow' | 'amalfi' | 'beach'

export interface Cover {
  key: CoverKey
  label: string
  src: string
  /** Какую часть картинки держать в кадре при обрезке (главное — справа, слева текст). */
  position: string
}

export const COVERS: Cover[] = [
  { key: 'santorini', label: 'Санторини', src: santorini, position: '85% 50%' },
  { key: 'paris', label: 'Париж', src: paris, position: '70% 50%' },
  { key: 'tropics', label: 'Тропики', src: tropics, position: '75% 50%' },
  { key: 'istanbul', label: 'Стамбул', src: istanbul, position: '60% 50%' },
  { key: 'mountains', label: 'Горы', src: mountains, position: '45% 50%' },
  { key: 'moscow', label: 'Мегаполис', src: moscow, position: '65% 50%' },
  { key: 'amalfi', label: 'Побережье', src: amalfi, position: '70% 50%' },
  { key: 'beach', label: 'Пляж', src: beach, position: '85% 50%' },
]

const BY_KEY = Object.fromEntries(COVERS.map((c) => [c.key, c])) as Record<CoverKey, Cover>

/**
 * Подбор обложки по направлению: ищем ключевые слова в названии и направлении.
 * Порядок важен: сначала конкретные курорты, потом страны и общие слова.
 */
const RULES: [CoverKey, string[]][] = [
  ['santorini', ['санторин', 'миконос', 'крит', 'родос', 'корфу', 'афин', 'греци', 'кипр', 'мальт']],
  ['beach', ['анталь', 'алань', 'кемер', 'белек', 'сиде', 'бодрум', 'мармарис', 'хургад', 'шарм', 'египет', 'пляж', 'анап', 'геленджик', 'евпатор']],
  ['istanbul', ['стамбул', 'босфор', 'турци', 'каппадок', 'баку', 'азербайджан', 'ташкент', 'самарканд', 'бухар', 'узбекистан', 'марокко', 'иордани']],
  ['tropics', ['мальдив', 'бали', 'индонези', 'таиланд', 'тайланд', 'пхукет', 'самуи', 'самуй', 'бангкок', 'краби', 'паттайя', 'хошимин', 'дананг', 'паттай', 'вьетнам', 'нячанг', 'фукуок', 'шри-ланк', 'шри ланк', 'гоа', 'доминикан', 'куба', 'канкун', 'мексик', 'сейшел', 'маврики', 'занзибар', 'танзани', 'филиппин', 'карибск', 'тропик', 'хайнань', 'пунта']],
  ['amalfi', ['амальфи', 'итали', 'рим', 'неапол', 'сицил', 'сардин', 'капри', 'позитано', 'генуя', 'лигури', 'венеци', 'флоренц', 'испани', 'барселон', 'мальорк', 'майорк', 'тенериф', 'канар', 'португал', 'лиссабон', 'порту', 'хорвати', 'дубровник', 'сплит', 'черногори', 'будва', 'ницц', 'лазурн', 'монако', 'абхази', 'сочи']],
  ['mountains', ['горы', 'горах', 'горн', 'альп', 'швейцар', 'австри', 'алтай', 'кавказ', 'эльбрус', 'домбай', 'архыз', 'шерегеш', 'красная поляна', 'роза хутор', 'байкал', 'карели', 'норвег', 'исланд', 'финлянд', 'грузи', 'тбилиси', 'казбек', 'армени', 'ереван', 'киргиз', 'бишкек', 'иссык', 'казахстан', 'алмат', 'камчатк', 'мурманск', 'озер', 'поход', 'лыж']],
  ['paris', ['париж', 'франци', 'прага', 'чехи', 'вена', 'будапешт', 'венгри', 'лондон', 'англи', 'берлин', 'германи', 'мюнхен', 'амстердам', 'брюссел', 'бельги', 'краков', 'польш', 'рига', 'таллин', 'вильнюс', 'европ', 'романтик', 'свадеб', 'медов']],
  ['moscow', ['москв', 'петербург', 'питер', 'спб', 'казан', 'екатеринбург', 'новосибирск', 'нижний', 'самар', 'дубай', 'эмират', 'оаэ', 'абу-даби', 'катар', 'доха', 'сингапур', 'токио', 'япони', 'сеул', 'коре', 'шанха', 'пекин', 'китай', 'гонконг', 'нью-йорк', 'сша', 'америк', 'командировк', 'конференц']],
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function autoCoverKey(trip: Pick<Trip, 'id' | 'title' | 'destination'>): CoverKey {
  const text = `${trip.destination} ${trip.title}`.toLowerCase().replace(/ё/g, 'е')
  for (const [key, words] of RULES) {
    if (words.some((w) => text.includes(w))) return key
  }
  // Не узнали направление — выбираем по поездке, чтобы обложки были разными.
  return COVERS[hash(trip.id || text) % COVERS.length].key
}

export function coverFor(trip: Pick<Trip, 'id' | 'title' | 'destination'> & { cover?: string }): Cover {
  const key = trip.cover && trip.cover in BY_KEY ? (trip.cover as CoverKey) : autoCoverKey(trip)
  return BY_KEY[key]
}

export function coverByKey(key: CoverKey): Cover {
  return BY_KEY[key]
}
