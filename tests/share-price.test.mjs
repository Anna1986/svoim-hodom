import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'

test('share endpoint hides price for plan-only links and retains it with details', async () => {
  let details = false, handler
  const price = { amountMinor: 123450, currency: 'RUB' }
  const item = { id: 'ticket', tripId: 'trip', ticketPrice: price, notes: 'private', bookingRef: 'PNR', link: 'https://example.com' }
  const admin = {
    from(table) {
      let kind
      const q = {
        select() { return q }, eq(key, value) { if (key === 'kind') kind = value; return q }, in() { return q },
        maybeSingle: async () => ({ data: table === 'shares' ? { user_id: 'owner', trip_id: 'trip', include_details: details } : { data: { id: 'trip', notes: 'secret' } } }),
        then(resolve) { return Promise.resolve({ data: kind === 'item' ? [{ data: item }] : [] }).then(resolve) },
      }
      return q
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: { name: 'Owner' } } } }) } },
  }
  let source = readFileSync(new URL('../supabase/functions/share/index.ts', import.meta.url), 'utf8')
  source = source.replace(/^import .*;\n/gm, '')
  vm.runInNewContext(stripTypeScriptTypes(source), {
    createClient: () => admin, Deno: { env: { get: () => 'fixture' }, serve: (fn) => { handler = fn } }, Response,
  })
  const request = () => new Request('https://example.test/share', { method: 'POST', body: JSON.stringify({ token: 'test-token-01234567890123456789' }) })
  const plan = await (await handler(request())).json()
  assert.equal(Object.hasOwn(plan.items[0], 'ticketPrice'), false)
  assert.equal(plan.items[0].notes, '')
  assert.equal(item.ticketPrice, price, 'response sanitization must not mutate stored data')
  details = true
  const full = await (await handler(request())).json()
  assert.deepEqual(full.items[0].ticketPrice, price)
})
