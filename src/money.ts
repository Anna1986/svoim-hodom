export const CURRENCIES = {
  RUB: 'RUB · Российский рубль', EUR: 'EUR · Евро', USD: 'USD · Доллар США',
  TRY: 'TRY · Турецкая лира', AED: 'AED · Дирхам ОАЭ', CNY: 'CNY · Китайский юань',
  GBP: 'GBP · Фунт стерлингов', THB: 'THB · Таиландский бат', GEL: 'GEL · Грузинский лари',
  KZT: 'KZT · Казахстанский тенге', JPY: 'JPY · Японская иена',
} as const
export type Currency = keyof typeof CURRENCIES
export interface TicketPrice { amountMinor: number; currency: Currency }

export function hasTicketPrice(category: string): boolean {
  return ['flight', 'transport', 'voucher'].includes(category)
}

export function isCurrency(value: string): value is Currency {
  return Object.hasOwn(CURRENCIES, value)
}

const decimals = (currency: Currency) => currency === 'JPY' ? 0 : 2

/** Parse decimal input without floating point rounding. Empty means unspecified. */
export function parseTicketPrice(input: string, currency: Currency): TicketPrice | undefined {
  const raw = input.trim().replace(/[ \u00a0\u202f]/g, '')
  if (!raw) return undefined
  const places = decimals(currency)
  const pattern = places ? /^\d+(?:[.,]\d{1,2})?$/ : /^\d+$/
  if (!pattern.test(raw)) throw new Error(places
    ? 'Укажите стоимость числом от 0, не более двух знаков после запятой.'
    : 'Укажите стоимость в иенах целым числом от 0.')
  const [whole, fraction = ''] = raw.split(/[.,]/)
  const amountMinor = Number(whole + fraction.padEnd(places, '0'))
  if (!Number.isSafeInteger(amountMinor)) throw new Error('Слишком большая стоимость.')
  return { amountMinor, currency }
}

export function priceInput(price?: TicketPrice): string {
  if (!price || !isCurrency(price.currency) || !Number.isSafeInteger(price.amountMinor) || price.amountMinor < 0) return ''
  const places = decimals(price.currency)
  if (!places) return String(price.amountMinor)
  return `${Math.floor(price.amountMinor / 100)}.${String(price.amountMinor % 100).padStart(2, '0')}`
}

export function formatTicketPrice(price?: TicketPrice): string {
  if (priceInput(price) === '') return ''
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: price!.currency })
    .format(price!.amountMinor / 10 ** decimals(price!.currency))
}
