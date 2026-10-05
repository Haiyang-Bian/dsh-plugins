const { test } = require('node:test')
const assert = require('node:assert/strict')
const load = require('./load.cjs')
const m = load('metrics'), { dashboardSchema, filterSchema } = load('contracts')
const event = (seq, type, data = {}, time = seq * 1000 + 1000) => ({ seq, type, data, time })
const usage = { inputTokens: 100, outputTokens: 40, cacheReadTokens: 20, cacheWriteTokens: 5, reasoningTokens: 12 }
const meta = { id: 'a', workspace: '/workspace', category: 'conversation', inherited: 0 }
const status = { state: 'ready', totalSessions: 1, readSessions: 1, failedSessions: 0, storage: 'durable', error: null, startedAt: 1, updatedAt: 1 }
const fold = events => m.fold(m.emptyRecord(), events.map(m.sanitizeEvent).filter(Boolean), meta)
test('content, tools, replay envelopes and keys never enter statistics metadata', () => {
  const e = m.sanitizeEvent(event(1, 'assistant/message', { message: { content: 'SECRET', source: { provider: 'p', model: 'm', replayState: 'SECRET', arbitrary: 'SECRET' } }, stream: [{ time: 1, type: 'chunk', chunk: { type: 'text-delta', delta: 'SECRET' } }], usage }))
  assert.ok(!JSON.stringify(e).includes('SECRET'))
  assert.equal(m.sanitizeEvent(event(2, 'tool/result', { content: 'SECRET' })), null)
  assert.ok(!JSON.stringify(m.sanitizeEvent(event(3, 'request/header', { header: { config: { provider: 'p', model: 'm', apiKey: 'SECRET' } } }))).includes('SECRET'))
})
test('latest usage snapshot is counted once, reasoning is not added to total', () => {
  const record = fold([event(0, 'assistant/message', { usage: { inputTokens: 1, outputTokens: 1 }, stream: [
    { type: 'chunk', time: 1, chunk: { type: 'usage', usage: { inputTokens: 3, outputTokens: 2 } } },
    { type: 'chunk', time: 2, chunk: { type: 'usage', usage } },
  ] })])
  assert.equal(record.facts[0].usage.total, 165); assert.equal(record.facts[0].usage.reasoning, 12)
})
test('duplicate events and inherited fork prefix do not inflate usage', () => {
  const e = m.sanitizeEvent(event(5, 'assistant/message', { usage }))
  const record = m.fold(m.emptyRecord(), [e, e], { ...meta, inherited: 5 })
  assert.equal(record.facts.length, 1)
  assert.equal(m.fold(record, [e], meta).facts.length, 1)
  assert.equal(m.fold(m.emptyRecord(), [e], { ...meta, inherited: 6 }).facts.length, 0)
})
test('user inputs, entered Agent turns and model retry attempts remain distinct', () => {
  const record = fold([event(0, 'request/header', { header: { config: { provider: 'p', model: 'm' } } }),
    event(1, 'user/message', { message: { source: { kind: 'user' } } }), event(2, 'user/message', { message: { source: { kind: 'injection' } } }),
    event(3, 'turn/start', { turn: 1 }), event(4, 'step/start', { turn: 1 }),
    event(5, 'assistant/attempt', { stream: [{ type: 'chunk', time: 4, chunk: { type: 'finish', reason: { kind: 'error' } } }] }),
    event(6, 'assistant/message', { usage }), event(7, 'step/start', { turn: 1 }), event(8, 'assistant/message', { usage })])
  const t = m.summarize(record.facts, { timezone: 'UTC' }, status).totals
  assert.equal(t.inputs, 1); assert.equal(t.turns, 1); assert.equal(t.calls, 3); assert.equal(t.failed, 1); assert.equal(t.unknown, 1)
  assert.equal(t.timedCalls, 2)
})
test('cancelled settlements and abrupt abort without a finish chunk are classified', () => {
  const record = fold([event(0, 'turn/start', { turn: 1 }), event(1, 'step/start', { turn: 1 }), event(2, 'assistant/attempt', { stream: [] }), event(3, 'turn/end', { turn: 1, reason: { kind: 'aborted' } }),
    event(4, 'assistant/attempt', { stream: [{ type: 'chunk', time: 4, chunk: { type: 'finish', reason: { kind: 'aborted' } } }] })])
  assert.deepEqual(record.facts.filter(f => f.kind === 'call').map(f => f.outcome), ['cancelled', 'cancelled'])
})
test('invalid usage and unknown durations remain unknown, never fabricated zero', () => {
  assert.equal(m.reportedUsage({ inputTokens: NaN, outputTokens: 4 }), null)
  assert.equal(m.reportedUsage({ outputTokens: 4 }), null)
  const f = fold([event(0, 'assistant/message', {})]).facts[0]
  assert.equal(f.usage, null); assert.equal(f.durationMs, null)
})
test('workspace, provider/model and category filter token records independently', () => {
  const f = fold([event(0, 'assistant/message', { usage, message: { source: { provider: 'p', model: 'm' } } })]).facts[0]
  const facts = [f, { ...f, category: 'subagent', workspace: '/other', model: 'n' }]
  assert.equal(m.summarize(facts, { workspace: '/workspace', model: m.modelKey('p', 'm'), timezone: 'UTC' }, status).totals.calls, 1)
  assert.equal(m.summarize(facts, { category: 'subagent', timezone: 'UTC' }, status).totals.total, 165)
})
test('local date boundaries and DST use Intl timezone without UTC day drift', () => {
  const f = fold([event(0, 'assistant/message', { usage }, Date.parse('2026-03-08T07:30:00Z'))]).facts[0]
  const shanghai = m.summarize([f], { timezone: 'Asia/Shanghai', from: f.time, to: f.time + 1 }, status)
  const la = m.summarize([f], { timezone: 'America/Los_Angeles', from: f.time, to: f.time + 1 }, status)
  assert.equal(shanghai.daily[0].day, '2026-03-08'); assert.equal(la.daily[0].day, '2026-03-07')
  assert.equal(la.heatmap.length, 84); assert.equal(la.heatmap.filter(r => r.inRange).length, 1)
  assert.ok(dashboardSchema.safeParse(la).success)
  assert.equal(m.summarize([f], { timezone: 'UTC', to: f.time }, status).totals.calls, 0)
  assert.throws(() => m.summarize([], { timezone: 'invalid' }, status))
})
test('date validation, gap filling and exports retain coverage metadata', () => {
  assert.equal(filterSchema.safeParse({ from: 2, to: 1 }).success, false)
  const data = m.summarize([], { timezone: 'UTC', from: 0, to: 3 * 86400000 }, status)
  assert.equal(data.daily.length, 3)
  assert.equal(JSON.parse(m.exportDashboard(data, 'json').text).status.storage, 'durable')
  assert.ok(m.exportDashboard(data, 'csv').text.includes('date,input,output'))
})
