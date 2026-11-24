export const CURRENCIES = {
  RUB: 'RUB · Российский рубль', EUR: 'EUR · Евро', USD: 'USD · Доллар США',
  TRY: 'TRY · Турецкая лира', AED: 'AED · Дирхам ОАЭ', CNY: 'CNY · Китайский юань',
  GBP: 'GBP · Фунт стерлингов', THB: 'THB · Таиландский бат', GEL: 'GEL · Грузинский лари',
  KZT: 'KZT · Казахстанский тенге', JPY: 'JPY · Японская иена',
} as const
export type Currency = keyof typeof CURRENCIES
export interface TicketPrice { amountMinor: number; currency: Currency }

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
  return formatMoneyTotal({ amountMinor: BigInt(price!.amountMinor), currency: price!.currency })
}

export interface MoneyTotal { amountMinor: bigint; currency: Currency }

/** Format exact totals even when the sum exceeds the safe integer range. */
export function formatMoneyTotal(total: MoneyTotal): string {
  const places = decimals(total.currency)
  const factor = 10n ** BigInt(places)
  const fraction = String(total.amountMinor % factor).padStart(places, '0')
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: total.currency })
    .formatToParts(total.amountMinor / factor)
    .map((part) => part.type === 'fraction' ? fraction : part.value).join('')
}

interface BudgetItem { tripId: string; category: string; ticketPrice?: TicketPrice }

/** Recalculate from current records, counting each stay/booking once, by currency. */
export function tripBudget<T extends BudgetItem>(tripId: string, items: readonly T[]) {
  const groups = new Map<string, { items: T[]; amounts: Map<Currency, bigint> }>()
  const amounts = new Map<Currency, bigint>()
  let missingCount = 0
  const totals = (values: Map<Currency, bigint>): MoneyTotal[] => [...values]
    .sort(([a], [b]) => a.localeCompare(b)).map(([currency, amountMinor]) => ({ currency, amountMinor }))
  for (const item of items) {
    if (item.tripId !== tripId) continue
    let group = groups.get(item.category)
    if (!group) { group = { items: [], amounts: new Map() }; groups.set(item.category, group) }
    group.items.push(item)
    if (priceInput(item.ticketPrice) === '') { missingCount++; continue }
    const { currency, amountMinor } = item.ticketPrice!
    const value = BigInt(amountMinor)
    group.amounts.set(currency, (group.amounts.get(currency) ?? 0n) + value)
    amounts.set(currency, (amounts.get(currency) ?? 0n) + value)
  }
  return {
    groups: [...groups].map(([category, group]) => ({ category, items: group.items, totals: totals(group.amounts) })),
    totals: totals(amounts), missingCount,
  }
}
