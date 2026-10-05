const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Collector } = require('./load.cjs')('collector')
const usage = { inputTokens: 10, outputTokens: 5 }
const e = (seq, type, data = {}) => ({ seq, type, time: Date.now(), data })
const message = seq => e(seq, 'assistant/message', { usage, message: { source: { provider: 'p', model: 'm' } } })
function fixture(initial = [message(0)]) {
  const saved = new Map(); let fail = false, closed = 0
  const source = { listSessions: async () => [{ header: { id: 'a' } }], readSession: async () => ({ session: { id: 'a', cwd: '/a' }, inheritedEventCount: 0, events: initial }) }
  const domain = { table: () => ({ entries: () => saved.entries(), put: async (key, value) => { if (fail) throw Error('disk'); saved.set(key, structuredClone(value)) } }), close: async () => { closed++ } }
  const open = async () => domain
  return { saved, source, open, domain, setFail: value => { fail = value }, closed: () => closed }
}
const filter = { timezone: 'UTC' }
test('backfill, live race, repeated enable and deleted sessions keep exact counts', async () => {
  const f = fixture(); let release; const original = f.source.readSession
  f.source.readSession = async id => { await new Promise(resolve => { release = resolve }); return original(id) }
  const c = new Collector(f.source, f.open, () => {})
  c.ingest({ id: 'a', cwd: '/a' }, 0, message(1))
  await new Promise(resolve => setImmediate(resolve)); release()
  await c.backfill; assert.equal((await c.query(filter)).totals.calls, 2)
  c.ingest({ id: 'a', cwd: '/a' }, 0, message(1)); assert.equal((await c.query(filter)).totals.calls, 2)
  await c.close(); f.source.listSessions = async () => []
  const next = new Collector(f.source, f.open, () => {}); await next.backfill
  assert.equal((await next.query(filter)).totals.calls, 2); await next.close()
})
test('export flush and concurrent close are serialized and idempotent', async () => {
  const f = fixture(), c = new Collector(f.source, f.open, () => {}); await c.backfill
  c.ingest({ id: 'a', cwd: '/a' }, 0, message(1))
  const [exported] = await Promise.all([c.export(filter, 'json'), c.close(), c.close()])
  assert.equal(JSON.parse(exported.text).totals.calls, 2); assert.equal(f.closed(), 1)
})
test('write errors preserve memory and export; retry saves without duplicates', async () => {
  const f = fixture(), c = new Collector(f.source, f.open, () => {}); await c.backfill; f.setFail(true)
  c.ingest({ id: 'a' }, 0, message(1)); const data = await c.query(filter)
  assert.equal(data.totals.calls, 2); assert.equal(data.status.storage, 'memory'); assert.equal(JSON.parse((await c.export(filter, 'json')).text).totals.calls, 2)
  f.setFail(false); await c.query(filter); await c.close()
  assert.equal(f.saved.get('a').facts.length, 2)
})
test('failed storage open supports bounded memory export without breaking requests', async () => {
  const f = fixture(Array.from({ length: 10005 }, (_, i) => message(i)))
  const c = new Collector(f.source, async () => { throw Error('disabled') }, () => {}); await c.backfill
  const data = await c.query(filter); assert.equal(data.status.storage, 'memory'); assert.equal(data.totals.calls, 10000)
  assert.equal(JSON.parse((await c.export(filter, 'json')).text).totals.calls, 10000); await c.close()
})
test('unreadable history is reported without blocking live collection', async () => {
  const f = fixture(); f.source.readSession = async () => { throw Error('missing') }
  const c = new Collector(f.source, f.open, () => {}); await c.backfill
  c.ingest({ id: 'a' }, 0, message(0)); const data = await c.query(filter)
  assert.equal(data.totals.calls, 1); assert.equal(data.status.failedSessions, 1); await c.close()
})
test('auxiliary observer preserves chunks, usage, purpose and thrown errors', async () => {
  const f = fixture([]), c = new Collector(f.source, f.open, () => {}); await c.backfill
  const chunks = [{ type: 'usage', usage }, { type: 'finish', reason: { kind: 'stop' } }]
  const options = { provider: 'p', model: 'm', purpose: 'session-title', sessionId: 'a' }
  const got = []; for await (const chunk of c.observe(options, async function* () { yield* chunks }, false)) got.push(chunk)
  assert.deepEqual(got, chunks)
  const data = await c.query({ ...filter, category: 'session-title' }); assert.equal(data.totals.total, 15); assert.deepEqual(data.workspaces, ['/a'])
  const error = Error('original'); await assert.rejects(async () => { for await (const _ of c.observe({ provider: 'p', model: 'm' }, async function* () { throw error }, false)) {} }, error)
  assert.equal((await c.query(filter)).totals.failed, 1); await c.close()
})
test('marked loop requests pass through and do not count auxiliary usage', async () => {
  const f = fixture([]), c = new Collector(f.source, f.open, () => {}); await c.backfill
  const stream = { async *[Symbol.asyncIterator]() { yield { type: 'usage', usage } } }
  assert.equal(c.observe({ provider: 'p', model: 'm' }, () => stream, true), stream)
  assert.equal((await c.query(filter)).totals.calls, 0); await c.close()
})
test('consumer cancellation closes the source iterator and records partial usage', async () => {
  const f = fixture([]), c = new Collector(f.source, f.open, () => {}); await c.backfill; let returned = false
  for await (const _ of c.observe({ provider: 'p', model: 'm' }, async function* () { try { yield { type: 'usage', usage }; yield { type: 'text-delta', delta: 'SECRET' } } finally { returned = true } }, false)) break
  assert.ok(returned); const data = await c.query(filter); assert.equal(data.totals.cancelled, 1); assert.equal(data.totals.total, 15); await c.close()
})
test('late stream settlement after unload cannot write into another activation', async () => {
  const f = fixture([]), c = new Collector(f.source, f.open, () => {}); await c.backfill
  let release; const iterator = c.observe({ provider: 'p', model: 'm' }, async function* () { yield { type: 'usage', usage }; await new Promise(resolve => { release = resolve }); yield { type: 'finish', reason: { kind: 'stop' } } }, false)[Symbol.asyncIterator]()
  await iterator.next(); const pending = iterator.next(); await new Promise(resolve => setImmediate(resolve)); await c.close()
  const next = new Collector(f.source, f.open, () => {}); await next.backfill; release(); await pending; await iterator.next()
  assert.equal((await next.query(filter)).totals.calls, 0); await next.close()
})
test('aborted queries reject and unload during slow initialization closes the acquired handle', async () => {
  const f = fixture(), abort = new AbortController(); abort.abort()
  let release; const c = new Collector(f.source, () => new Promise(resolve => { release = () => resolve(f.domain) }), () => {})
  await assert.rejects(() => c.query(filter, abort.signal)); const closing = c.close(); release(); await closing
  assert.equal(f.closed(), 1)
})
