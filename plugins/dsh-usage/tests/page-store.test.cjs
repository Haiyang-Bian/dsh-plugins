const { test } = require('node:test')
const assert = require('node:assert/strict')
const { PageStore } = require('./load.cjs')('page-store')
test('late old query cannot replace newer filters; dispose aborts subscriptions', async () => {
  const pending = [], signals = []
  const store = new PageStore({ query: (_filter, signal) => { signals.push(signal); return new Promise(resolve => pending.push(resolve)) } }, { timezone: 'UTC' })
  let notifications = 0; store.subscribe(() => notifications++)
  const first = store.refresh(); store.setFilter({ timezone: 'UTC', category: 'subagent' })
  pending[1]({ ok: true, value: { id: 'new' } }); await new Promise(resolve => setImmediate(resolve))
  pending[0]({ ok: true, value: { id: 'old' } }); await first
  assert.equal(store.getSnapshot().data.id, 'new'); assert.equal(signals[0].aborted, true)
  const last = store.refresh(); store.dispose(); const count = notifications
  pending[2]({ ok: true, value: { id: 'disposed' } }); await last
  assert.equal(notifications, count); assert.equal(signals[2].aborted, true)
})
test('connection failure is visible and successful refresh clears it', async () => {
  let fail = true
  const store = new PageStore({ query: async () => fail ? { ok: false, error: Error('offline') } : { ok: true, value: {} } }, { timezone: 'UTC' })
  await store.refresh(); assert.ok(store.getSnapshot().error); fail = false; await store.refresh(); assert.equal(store.getSnapshot().error, null); store.dispose()
})
