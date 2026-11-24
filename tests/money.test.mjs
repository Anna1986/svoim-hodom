import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTicketPrice, priceInput, formatTicketPrice } from '../src/money.ts'

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
