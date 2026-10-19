import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { isAgentLoopRequest } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-typert-registry'
import { hostContribution, recordSchema } from './contracts'
import type { Filter, RecordData } from './contracts'
import { Collector } from './collector'

export const name = 'dsh-usage'
export const inject = ['sessionQuery', 'storageDomain', 'typert', 'llm']
// Domain names permit underscores, whereas package and panel IDs permit hyphens.
// DSH 0.2.1 uses Zod 4.4 in storage and 4.6 in Typert. Both accept this
// schema at runtime; bridge the SDK's recursive Zod type at this boundary.
type StorageRecordSchema = Parameters<typeof domainTable<string, RecordData>>[0]
export const domainSpec = defineDomain({ name: 'dsh_usage', version: 1, layout: 'per-record', tables: { sessions: domainTable<string, RecordData>(recordSchema as unknown as StorageRecordSchema) } })
class UsageService extends TypertRemoteService {
  constructor(ctx: Context, readonly collector: Collector) { super(ctx, 'dshUsage') }
  query(filter: Filter, signal?: AbortSignal) { return this.collector.query(filter, signal) }
  export(filter: Filter, format: 'csv' | 'json', signal?: AbortSignal) { return this.collector.export(filter, format, signal) }
}
export function apply(ctx: Context) {
  return ctx.effect(() => {
    const collector = new Collector(ctx.sessionQuery, () => ctx.storageDomain.open(domainSpec))
    const releases: Array<() => unknown> = []
    const close = async () => {
      for (const release of releases.splice(0).reverse()) await release()
      await collector.close()
    }
    try {
      new UsageService(ctx, collector)
      releases.push(ctx.typert.register(hostContribution))
      releases.push(ctx.on('session/event', (session, event) => collector.ingest(session.header, session.inheritedEventCount, event)))
      releases.push(ctx.on('llm/stream', (options, next) => collector.observe(options, next, isAgentLoopRequest(options)) as ReturnType<typeof next>))
    } catch (error) { void close(); throw error }
    return close
  }, 'dsh-usage: collector')
}
