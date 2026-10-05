import type { Category, Dashboard, Fact, Filter, RecordData, Status, Totals } from './contracts'
import { filterSchema, usageSchema } from './contracts'

type Bag = { [key: string]: unknown }
const bag = (value: unknown): Bag => value !== null && typeof value === 'object' ? value as Bag : {}
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
const string = (value: unknown) => typeof value === 'string' ? value : ''
export interface EventMeta { seq: number; time: number; type: string; data: Bag }
export interface SessionMeta { id: string; workspace: string; category: Category; inherited: number }
export function sessionMeta(header: unknown, inherited = 0): SessionMeta {
  const h = bag(header)
  return { id: string(h.id), workspace: string(h.cwd) || '未归属',
    category: h.origin === 'subagent' || h.parentSession !== undefined ? 'subagent' : 'conversation', inherited }
}
export function reportedUsage(raw: unknown): Fact['usage'] {
  const u = bag(raw)
  const input = number(u.inputTokens), output = number(u.outputTokens)
  if (input === null || output === null) return null
  const cacheRead = number(u.cacheReadTokens) ?? 0, cacheWrite = number(u.cacheWriteTokens) ?? 0
  return usageSchema.parse({ input, output, cacheRead, cacheWrite,
    total: number(u.totalTokens) ?? input + output + cacheRead + cacheWrite,
    reasoning: number(u.reasoningTokens) })
}
// Strip content before buffering or awaiting any I/O. Only metadata crosses this boundary.
export function sanitizeEvent(raw: unknown): EventMeta | null {
  const e = bag(raw), d = bag(e.data), type = string(e.type)
  if (!['user/message', 'turn/start', 'turn/end', 'step/start', 'request/header', 'request/context', 'assistant/attempt', 'assistant/message'].includes(type)) return null
  const data: Bag = { turn: d.turn }
  if (type === 'turn/end') data.reason = string(bag(d.reason).kind)
  if (type === 'user/message' || type === 'assistant/message') data.source = { ...bag(bag(d.message).source), replayState: undefined }
  if (type === 'request/header') {
    const c = bag(bag(d.header).config); data.provider = c.provider; data.model = c.model
  }
  if (type === 'request/context') { data.provider = d.provider; data.model = d.model }
  if (type.startsWith('assistant/')) {
    data.usage = reportedUsage(d.usage)
    data.interrupted = d.interrupted === true
    data.stream = Array.isArray(d.stream) ? d.stream.map(record => {
      const r = bag(record), chunk = bag(r.chunk)
      return { time: number(r.time), type: string(chunk.type), usage: chunk.type === 'usage' ? reportedUsage(chunk.usage) : null,
        reason: chunk.type === 'finish' ? string(bag(chunk.reason).kind) || string(chunk.reason) : '', error: chunk.type === 'error' }
    }) : []
  }
  // Source is whitelisted too: developer/message producers may carry arbitrary content.
  const s = bag(data.source)
  if (data.source) data.source = { kind: string(s.kind), provider: string(s.provider), model: string(s.model) }
  if (number(e.seq) === null || number(e.time) === null) return null
  return { seq: e.seq as number, time: e.time as number, type, data }
}
export const emptyRecord = (): RecordData => ({ cursor: -1, facts: [], provider: '', model: '', turn: null, started: null, lastTurn: null, pendingAttempt: null })
export function fold(record: RecordData, events: EventMeta[], meta: SessionMeta): RecordData {
  const next = { ...record, facts: [...record.facts] }
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    if (e.seq <= next.cursor || e.seq < meta.inherited) continue
    next.cursor = e.seq
    const d = e.data, source = bag(d.source)
    const base: Fact = { id: `${meta.id}:${e.seq}`, time: e.time, kind: 'call', workspace: meta.workspace,
      category: meta.category, provider: next.provider, model: next.model, outcome: null, usage: null, durationMs: null }
    if (e.type === 'request/header' || e.type === 'request/context') {
      next.provider = string(d.provider) || next.provider; next.model = string(d.model) || next.model
      if (e.type === 'request/header') next.started = e.time
    } else if (e.type === 'user/message' && source.kind === 'user') {
      next.facts.push({ ...base, kind: 'input' })
    } else if (e.type === 'turn/start') {
      next.turn = number(d.turn)
    } else if (e.type === 'turn/end') {
      if (next.pendingAttempt && d.reason === 'aborted') next.facts = next.facts.map(f => f.id === next.pendingAttempt ? { ...f, outcome: 'cancelled' } : f)
      next.pendingAttempt = null
    } else if (e.type === 'step/start') {
      next.started = e.time
      const turn = number(d.turn) ?? next.turn
      if (turn !== null && turn !== next.lastTurn) {
        next.facts.push({ ...base, kind: 'turn' }); next.lastTurn = turn
      }
    } else if (e.type.startsWith('assistant/')) {
      const stream = d.stream as Array<{ time: number | null; type: string; usage: Fact['usage']; reason: string; error: boolean }>
      const usage = [...stream].reverse().find(r => r.usage !== null)?.usage ?? d.usage as Fact['usage'] ?? null
      const finish = [...stream].reverse().find(r => r.type === 'finish')?.reason
      const cancelled = d.interrupted === true || finish === 'abort' || finish === 'aborted' || finish === 'cancelled'
      const failed = stream.some(r => r.error) || finish === 'error' || e.type === 'assistant/attempt'
      next.facts.push({ ...base, provider: string(source.provider) || next.provider || '未知', model: string(source.model) || next.model || '未知',
        usage, outcome: cancelled ? 'cancelled' : failed ? 'failed' : 'success',
        durationMs: next.started === null ? null : Math.max(0, e.time - next.started) })
      next.started = null
      next.pendingAttempt = e.type === 'assistant/attempt' && !finish ? base.id : null
    }
  }
  return next
}
export const modelKey = (provider: string, model: string) => JSON.stringify([provider, model])
export const zero = (): Totals => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, inputs: 0, turns: 0, calls: 0, unknown: 0, success: 0, failed: 0, cancelled: 0, durationMs: 0, timedCalls: 0 })
function add(t: Totals, f: Fact) {
  if (f.kind === 'input') { t.inputs++; return }
  if (f.kind === 'turn') { t.turns++; return }
  t.calls++
  if (f.outcome) t[f.outcome]++
  if (f.usage === null) t.unknown++
  else for (const k of ['input', 'output', 'cacheRead', 'cacheWrite', 'total'] as const) t[k] += f.usage[k]
  if (f.durationMs !== null) { t.durationMs += f.durationMs; t.timedCalls++ }
}
export function summarize(facts: Iterable<Fact>, raw: Filter, status: Status): Dashboard {
  const filter = filterSchema.parse(raw)
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: filter.timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const dayOf = (time: number) => {
    const p = formatter.formatToParts(time)
    const get = (type: string) => p.find(p => p.type === type)!.value
    return `${get('year')}-${get('month')}-${get('day')}`
  }
  const rows = [...facts], selected = rows.filter(f => (filter.from === undefined || f.time >= filter.from) && (filter.to === undefined || f.time < filter.to)
    && (!filter.workspace || f.workspace === filter.workspace) && (!filter.category || f.category === filter.category)
    && (!filter.model || f.kind !== 'call' || modelKey(f.provider, f.model) === filter.model))
  const totals = zero(), days = new Map<string, Totals>(), models = new Map<string, Dashboard['models'][number]>()
  for (const f of selected) {
    add(totals, f); const day = dayOf(f.time); if (!days.has(day)) days.set(day, zero()); add(days.get(day)!, f)
    if (f.kind === 'call') {
      const key = modelKey(f.provider, f.model)
      if (!models.has(key)) models.set(key, { key, provider: f.provider, model: f.model, totals: zero() })
      add(models.get(key)!.totals, f)
    }
  }
  const end = dayOf((filter.to ?? Date.now() + 1) - 1), endUTC = Date.parse(end + 'T00:00:00Z')
  const fromDay = filter.from === undefined ? '' : dayOf(filter.from)
  const heatmap = Array.from({ length: 84 }, (_, i) => {
    const day = new Date(endUTC - (83 - i) * 86400000).toISOString().slice(0, 10)
    return { day, calls: days.get(day)?.calls ?? 0, total: days.get(day)?.total ?? 0, inRange: !fromDay || day >= fromDay }
  })
  // Fill calendar gaps; large all-history ranges keep only the existing daily rows.
  const startDay = fromDay || [...days.keys()].sort()[0] || end
  if ((endUTC - Date.parse(startDay)) / 86400000 <= 3660) for (let date = Date.parse(startDay); date <= endUTC; date += 86400000) {
    const key = new Date(date).toISOString().slice(0, 10); if (!days.has(key)) days.set(key, zero())
  }
  const options = new Map<string, string>()
  for (const f of rows) if (f.kind === 'call') options.set(modelKey(f.provider, f.model), `${f.provider} / ${f.model}`)
  return { schemaVersion: 1, timezone: filter.timezone, totals, daily: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, totals]) => ({ day, totals })),
    models: [...models.values()].sort((a, b) => b.totals.total - a.totals.total), heatmap,
    workspaces: [...new Set(rows.map(f => f.workspace))].sort(), modelOptions: [...options].map(([key, label]) => ({ key, label })), status: { ...status } }
}
export function exportDashboard(data: Dashboard, format: 'csv' | 'json') {
  const filename = `dsh-usage-${new Date().toISOString().slice(0, 10)}.${format}`
  if (format === 'json') return { filename, mime: 'application/json', text: JSON.stringify(data, null, 2) }
  const headers = ['date', ...Object.keys(zero())]
  const text = [headers.join(','), ...data.daily.map(row => [row.day, ...Object.values(row.totals)].join(','))].join('\r\n')
  return { filename, mime: 'text/csv;charset=utf-8', text: '\ufeff' + text }
}
