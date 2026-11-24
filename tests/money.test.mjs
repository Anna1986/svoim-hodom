import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTicketPrice, priceInput, formatTicketPrice, tripBudget, formatMoneyTotal } from '../src/money.ts'

test('decimal separators and grouped prices keep exact minor units', () => {
  for (const amount of ['12345.67', '12345,67', '12 345,67', '12\u202f345,67']) {
    assert.deepEqual(parseTicketPrice(amount, 'RUB'), { amountMinor: 1234567, currency: 'RUB' })
  }
  assert.equal(parseTicketPrice('0.29', 'USD').amountMinor, 29)
  assert.equal(parseTicketPrice('1.1', 'EUR').amountMinor, 110)
})
test('unspecified price differs from a free ticket', () => {
  assert.equal(parseTicketPrice(' ', 'RUB'), undefined)
  assert.equal(parseTicketPrice('0', 'RUB').amountMinor, 0)
  assert.equal(formatTicketPrice(undefined), '')
  assert.match(formatTicketPrice(parseTicketPrice('0', 'RUB')), /0,00/)
})
test('invalid amounts never silently round or become zero', () => {
  for (const amount of ['-1', '1.234', 'abc', 'NaN', 'Infinity', '1e3', '1,2.3', '9007199254740992']) {
    assert.throws(() => parseTicketPrice(amount, 'EUR'))
  }
  assert.throws(() => parseTicketPrice('1.5', 'JPY'))
})
test('currency formatting and editing preserve precision', () => {
  const price = parseTicketPrice('19.99', 'EUR')
  assert.equal(priceInput(price), '19.99')
  assert.match(formatTicketPrice(price), /19,99.*€/)
  assert.equal(priceInput(parseTicketPrice('1500', 'JPY')), '1500')
  assert.equal(formatTicketPrice({ currency: 'invalid', amountMinor: 10 }), '')
})


test('trip budget groups articles, keeps currencies separate, and excludes other trips', () => {
  const entry = (category, amount, currency = 'RUB') => ({ tripId: 'a', category, ticketPrice: parseTicketPrice(amount, currency) })
  const result = tripBudget('a', [
    entry('flight', '100.10'), entry('flight', '200.20'),
    { ...entry('hotel', '500'), startDate: '2026-12-01', endDate: '2026-12-09' },
    entry('other', '5', 'EUR'), entry('visa', '0'), entry('car', ''),
    { ...entry('flight', '99999'), tripId: 'b' },
  ])
  assert.deepEqual(result.totals, [{ currency: 'EUR', amountMinor: 500n }, { currency: 'RUB', amountMinor: 80030n }])
  assert.deepEqual(result.groups.find(g => g.category === 'flight').totals, [{ currency: 'RUB', amountMinor: 30030n }])
  assert.equal(result.missingCount, 1)
  assert.equal(result.groups.find(g => g.category === 'hotel').totals[0].amountMinor, 50000n)
  assert.equal(result.groups.find(g => g.category === 'visa').totals[0].amountMinor, 0n)
})

test('budget recalculates after edits/removal and ignores malformed prices', () => {
  const row = { tripId: 'a', category: 'other', ticketPrice: parseTicketPrice('10', 'USD') }
  assert.equal(tripBudget('a', [row]).totals[0].amountMinor, 1000n)
  assert.equal(tripBudget('a', [{ ...row, ticketPrice: parseTicketPrice('15', 'USD') }]).totals[0].amountMinor, 1500n)
  assert.deepEqual(tripBudget('a', []).totals, [])
  const invalid = tripBudget('a', [{ ...row, ticketPrice: { currency: 'RUB', amountMinor: -1 } }])
  assert.deepEqual(invalid.totals, [])
  assert.equal(invalid.missingCount, 1)
})

test('large totals retain exact cents without overflowing Number', () => {
  const row = { tripId: 'a', category: 'flight', ticketPrice: { currency: 'RUB', amountMinor: Number.MAX_SAFE_INTEGER } }
  const total = tripBudget('a', [row, row]).totals[0]
  assert.equal(total.amountMinor, 18014398509481982n)
  assert.equal(formatMoneyTotal(total).replace(/\s/g, ''), '180143985094819,82₽')
  assert.match(formatMoneyTotal({ currency: 'JPY', amountMinor: 1234n }).replace(/\s/g, ''), /^1234/)
})
