import type { Fact, Filter, RecordData, Status } from './contracts'
import { emptyRecord, exportDashboard, fold, reportedUsage, sanitizeEvent, sessionMeta, summarize } from './metrics'
import type { EventMeta, SessionMeta } from './metrics'

export interface Table {
  entries(): IterableIterator<[string, RecordData]>
  put(key: string, value: RecordData): Promise<void>
}
export interface Source {
  listSessions(signal?: AbortSignal): Promise<Array<{ header: { id: string } }>>
  readSession(id: string): Promise<{ session: unknown; events: unknown[]; inheritedEventCount: number }>
}
export interface Domain { table(name: string): Table; close(): Promise<void> }
export class Collector {
  readonly status: Status = { state: 'backfill', totalSessions: 0, readSessions: 0, failedSessions: 0, storage: 'memory', error: null, startedAt: Date.now(), updatedAt: Date.now() }
  private records = new Map<string, RecordData>()
  private loaded = new Map<string, Promise<void>>()
  private metadata = new Map<string, SessionMeta>()
  private dirty = new Set<string>()
  private chain: Promise<void> = Promise.resolve()
  private domain?: Domain
  private active = true
  private abort = new AbortController()
  private pending = 0
  private jobs = new Set<Promise<unknown>>()
  private closing?: Promise<void>
  readonly ready: Promise<void>
  readonly backfill: Promise<void>
  constructor(private source: Source, open: () => Promise<Domain>, private warn: (message: string) => void = console.warn) {
    this.ready = open().then(domain => {
      this.domain = domain; this.records = new Map(domain.table('sessions').entries()); this.status.storage = 'durable'
    }).catch(() => this.fail('统计存储不可用；当前数据仅保存在内存中。'))
    this.backfill = this.ready.then(async () => {
      if (!this.active) return
      try {
        const sessions = await this.source.listSessions(this.abort.signal); this.status.totalSessions = sessions.length
        for (const { header } of sessions) { if (!this.active) break; await this.ensureLoaded(header.id) }
      } catch { if (this.active) this.fail('无法列出历史会话；实时采集仍在进行。') }
      if (this.active) this.status.state = this.status.error ? 'degraded' : 'ready'
    })
  }
  private fail(message: string) { this.status.error = message; this.status.state = 'degraded'; this.warn('[dsh-usage] ' + message) }
  private enqueue(fn: () => Promise<void>) {
    const operation = this.chain.then(fn)
    this.chain = operation.catch(() => this.fail('统计处理失败；部分数据可能尚未保存。'))
    return this.chain
  }
  private ensureLoaded(id: string): Promise<void> {
    const existing = this.loaded.get(id); if (existing) return existing
    const loading = this.ready.then(async () => {
      try {
        const read = await this.source.readSession(id)
        const meta = sessionMeta(read.session, read.inheritedEventCount); this.metadata.set(id, meta)
        const events = read.events.map(sanitizeEvent).filter((e): e is EventMeta => e !== null)
        await this.enqueue(() => this.merge(id, events, meta))
        this.status.readSessions++
      } catch { if (this.active) { this.status.failedSessions++; this.fail('部分历史会话不可读取；其用量暂未覆盖。') } }
    })
    this.loaded.set(id, loading); return loading
  }
  ingest(header: unknown, inherited: number, raw: unknown) {
    if (!this.active) return
    const event = sanitizeEvent(raw); if (!event) return
    const meta = sessionMeta(header, inherited)
    if (this.pending >= 1000) { this.fail('采集队列已满；历史可回填，未保存的辅助用量可能丢失。'); return }
    this.pending++
    const job = this.ensureLoaded(meta.id).then(() => {
      return this.enqueue(() => this.merge(meta.id, [event], meta))
    }).finally(() => { this.pending--; this.jobs.delete(job) })
    this.jobs.add(job)
  }
  private async merge(id: string, events: EventMeta[], meta: SessionMeta) {
    const before = this.records.get(id) ?? emptyRecord(), after = fold(before, events, meta)
    if (after.cursor === before.cursor) return
    this.records.set(id, after); this.dirty.add(id); await this.persist(id)
  }
  private async persist(id: string) {
    if (!this.domain) {
      // A failed open must not turn into unbounded in-memory telemetry.
      let count = 0
      for (const [key, record] of [...this.records].reverse()) {
        const available = Math.max(0, 10000 - count); count += record.facts.length
        if (record.facts.length > available) this.records.set(key, { ...record, facts: available === 0 ? [] : record.facts.slice(-available) })
      }
      return
    }
    try { await this.domain.table('sessions').put(id, this.records.get(id)!); this.dirty.delete(id); this.status.updatedAt = Date.now() }
    catch { this.status.storage = 'memory'; this.fail('统计写入失败；内存数据仍可查看和导出，将继续尝试保存。') }
  }
  observe(options: { provider: string; model: string; sessionId?: string; purpose?: string; signal?: AbortSignal }, next: () => AsyncIterable<unknown>, isLoop: boolean): AsyncIterable<unknown> {
    if (isLoop || !this.active) return next()
    const owner = this
    return { async *[Symbol.asyncIterator]() {
      const started = Date.now(), id = 'aux:' + crypto.randomUUID()
      let usage: Fact['usage'] = null, outcome: Fact['outcome'] = 'cancelled'
      try {
        for await (const chunk of next()) {
          const c = chunk as { type?: string; usage?: unknown; reason?: { kind: string } }
          if (c.type === 'usage') usage = reportedUsage(c.usage)
          if (c.type === 'finish') outcome = ['abort', 'aborted', 'cancelled'].includes(c.reason?.kind ?? '') ? 'cancelled' : c.reason?.kind === 'error' ? 'failed' : 'success'
          if (c.type === 'error') outcome = 'failed'
          yield chunk
        }
        if (outcome === 'cancelled' && !options.signal?.aborted) outcome = 'success'
      } catch (error) { outcome = options.signal?.aborted ? 'cancelled' : 'failed'; throw error }
      finally {
        if (owner.active) {
          const time = Date.now()
          const category = options.purpose === 'session-title' || options.purpose === 'compaction' ? options.purpose : 'auxiliary'
          const fact: Fact = { id, time, kind: 'call', category, workspace: owner.metadata.get(options.sessionId ?? '')?.workspace ?? '未归属',
            provider: options.provider, model: options.model, outcome, usage, durationMs: time - started }
          const job = owner.ready.then(() => owner.enqueue(async () => {
            owner.records.set(id, { ...emptyRecord(), facts: [fact] }); owner.dirty.add(id); await owner.persist(id)
          })).finally(() => owner.jobs.delete(job))
          owner.jobs.add(job)
        }
      }
    } }
  }
  async query(filter: Filter, signal?: AbortSignal) {
    signal?.throwIfAborted(); await this.ready; await Promise.all(this.jobs); await this.chain
    await this.enqueue(async () => { for (const id of this.dirty) await this.persist(id) })
    signal?.throwIfAborted()
    return summarize([...this.records.values()].flatMap(record => record.facts), filter, this.status)
  }
  async export(filter: Filter, format: 'csv' | 'json', signal?: AbortSignal) { return exportDashboard(await this.query(filter, signal), format) }
  close(): Promise<void> {
    if (this.closing) return this.closing
    this.active = false; this.abort.abort()
    return this.closing = (async () => {
      await this.backfill; await Promise.all(this.loaded.values()); await Promise.all(this.jobs); await this.ready; await this.chain
      for (const id of this.dirty) await this.persist(id)
      await this.domain?.close(); this.status.state = 'closed'
    })()
  }
}
