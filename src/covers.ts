import type { Trip } from './db'
import santorini from './assets/covers/santorini.webp'
import paris from './assets/covers/paris.webp'
import tropics from './assets/covers/tropics.webp'
import istanbul from './assets/covers/istanbul.webp'
import mountains from './assets/covers/mountains.webp'
import moskva from './assets/covers/moskva.webp'
import metropolis from './assets/covers/metropolis.webp'
import coast from './assets/covers/coast.webp'
import beach from './assets/covers/beach.webp'
import saintPetersburg from './assets/covers/saint-petersburg.webp'
import london from './assets/covers/london.webp'
import shanghai from './assets/covers/shanghai.webp'
import europe from './assets/covers/europe.webp'
import newYork from './assets/covers/new-york.webp'
import america from './assets/covers/america.webp'
import china from './assets/covers/china.webp'

export type CoverKey =
  | 'santorini' | 'paris' | 'tropics' | 'istanbul' | 'mountains' | 'moskva' | 'metropolis' | 'coast' | 'beach'
  | 'saint-petersburg' | 'london' | 'shanghai' | 'europe' | 'new-york' | 'america' | 'china'

export interface Cover {
  key: CoverKey
  label: string
  src: string
  /** Какую часть картинки держать в кадре при обрезке (картинки 2:1, на широких экранах режется верх и низ). */
  position: string
}

// Рисунки цветными карандашами, 2:1. Главное — в правой половине: слева поверх обложки идёт текст.
export const COVERS: Cover[] = [
  { key: 'moskva', label: 'Москва', src: moskva, position: '50% 10%' },
  { key: 'saint-petersburg', label: 'Санкт-Петербург', src: saintPetersburg, position: '50% 10%' },
  { key: 'paris', label: 'Париж', src: paris, position: '50% 8%' },
  { key: 'london', label: 'Лондон', src: london, position: '50% 10%' },
  { key: 'europe', label: 'Европа', src: europe, position: '50% 8%' },
  { key: 'istanbul', label: 'Стамбул', src: istanbul, position: '50% 10%' },
  { key: 'santorini', label: 'Санторини', src: santorini, position: '50% 20%' },
  { key: 'coast', label: 'Побережье', src: coast, position: '50% 20%' },
  { key: 'beach', label: 'Пляж', src: beach, position: '50% 30%' },
  { key: 'tropics', label: 'Тропики', src: tropics, position: '50% 30%' },
  { key: 'mountains', label: 'Горы', src: mountains, position: '50% 15%' },
  { key: 'metropolis', label: 'Мегаполис', src: metropolis, position: '50% 10%' },
  { key: 'shanghai', label: 'Шанхай', src: shanghai, position: '50% 8%' },
  { key: 'china', label: 'Китай', src: china, position: '50% 25%' },
  { key: 'new-york', label: 'Нью-Йорк', src: newYork, position: '50% 12%' },
  { key: 'america', label: 'Америка', src: america, position: '50% 20%' },
]

const BY_KEY = Object.fromEntries(COVERS.map((c) => [c.key, c])) as Record<CoverKey, Cover>

/** Ключи прежних обложек, сохранённые в поездках: «moscow» раньше был «Мегаполисом», «amalfi» — «Побережьем». */
const LEGACY: Record<string, CoverKey> = { moscow: 'metropolis', amalfi: 'coast' }

/** Сохранённый в поездке ключ → действующий ключ обложки; пустая строка — «подбирать автоматически». */
export function savedCoverKey(cover: string | undefined): CoverKey | '' {
  const key = cover ? LEGACY[cover] ?? cover : ''
  return key && key in BY_KEY ? (key as CoverKey) : ''
}

/** Обложки без конкретного города — для поездок, направление которых не удалось узнать. */
const GENERIC: CoverKey[] = ['coast', 'mountains', 'metropolis', 'beach', 'tropics']

/**
 * Подбор обложки по направлению: ищем ключевые слова в названии и направлении.
 * Порядок важен: сначала конкретные города и курорты, потом страны и общие слова.
 */
const RULES: [CoverKey, string[]][] = [
  ['moskva', ['москв']],
  ['saint-petersburg', ['петербург', 'питер', 'спб', 'петергоф', 'царское село']],
  ['london', ['лондон', 'англи', 'великобритан', 'шотланд', 'эдинбург']],
  ['new-york', ['нью-йорк', 'нью йорк', 'манхэттен', 'манхеттен']],
  ['shanghai', ['шанха']],
  ['santorini', ['санторин', 'миконос', 'крит', 'родос', 'корфу', 'афин', 'греци', 'кипр', 'мальт']],
  ['beach', ['анталь', 'алань', 'кемер', 'белек', 'сиде', 'бодрум', 'мармарис', 'хургад', 'шарм', 'египет', 'пляж', 'анап', 'геленджик', 'евпатор']],
  ['istanbul', ['стамбул', 'босфор', 'турци', 'каппадок', 'баку', 'азербайджан', 'ташкент', 'самарканд', 'бухар', 'узбекистан', 'марокко', 'иордани']],
  ['tropics', ['мальдив', 'бали', 'индонези', 'таиланд', 'тайланд', 'пхукет', 'самуи', 'самуй', 'бангкок', 'краби', 'паттайя', 'хошимин', 'дананг', 'паттай', 'вьетнам', 'нячанг', 'фукуок', 'шри-ланк', 'шри ланк', 'гоа', 'доминикан', 'куба', 'канкун', 'мексик', 'сейшел', 'маврики', 'занзибар', 'танзани', 'филиппин', 'карибск', 'тропик', 'хайнань', 'санья', 'пунта']],
  ['china', ['китай', 'пекин', 'гонконг', 'сиань', 'гуанчжоу', 'шэньчжэнь', 'чэнду', 'харбин', 'макао']],
  ['america', ['сша', 'америк', 'лос-анджелес', 'сан-франциско', 'калифорни', 'лас-вегас', 'чикаго', 'вашингтон', 'бостон', 'майами', 'флорид']],
  ['paris', ['париж', 'франци', 'романтик', 'свадеб', 'медов']],
  ['coast', ['амальфи', 'неапол', 'сицил', 'сардин', 'капри', 'позитано', 'генуя', 'лигури', 'мальорк', 'майорк', 'тенериф', 'канар', 'хорвати', 'дубровник', 'сплит', 'черногори', 'будва', 'тиват', 'ницц', 'лазурн', 'монако', 'абхази', 'сочи', 'побереж']],
  ['mountains', ['горы', 'горах', 'горн', 'альп', 'швейцар', 'австри', 'алтай', 'кавказ', 'эльбрус', 'домбай', 'архыз', 'шерегеш', 'красная поляна', 'роза хутор', 'байкал', 'карели', 'норвег', 'исланд', 'финлянд', 'грузи', 'тбилиси', 'казбек', 'армени', 'ереван', 'киргиз', 'бишкек', 'иссык', 'казахстан', 'алмат', 'камчатк', 'мурманск', 'озер', 'поход', 'лыж']],
  ['europe', ['европ', 'итали', 'рим', 'венеци', 'флоренц', 'милан', 'испани', 'барселон', 'мадрид', 'португал', 'лиссабон', 'порту', 'прага', 'чехи', 'вена', 'будапешт', 'венгри', 'берлин', 'германи', 'мюнхен', 'амстердам', 'нидерланд', 'голланд', 'брюссел', 'бельги', 'краков', 'польш', 'варшав', 'рига', 'таллин', 'вильнюс', 'белград', 'серби', 'калининград']],
  ['metropolis', ['казан', 'екатеринбург', 'новосибирск', 'нижний', 'самар', 'дубай', 'эмират', 'оаэ', 'абу-даби', 'катар', 'доха', 'сингапур', 'токио', 'япони', 'сеул', 'коре', 'мегаполис', 'командировк', 'конференц']],
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
  // Не узнали направление — выбираем по поездке из обложек без конкретного города, чтобы они были разными.
  return GENERIC[hash(trip.id || text) % GENERIC.length]
}

export function coverFor(trip: Pick<Trip, 'id' | 'title' | 'destination'> & { cover?: string }): Cover {
  return BY_KEY[savedCoverKey(trip.cover) || autoCoverKey(trip)]
}

export function coverByKey(key: CoverKey): Cover {
  return BY_KEY[key]
}
