import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

export const categorySchema = z.enum(['conversation', 'subagent', 'session-title', 'compaction', 'auxiliary'])
export type Category = z.infer<typeof categorySchema>
const n = z.number().finite().nonnegative()
export const usageSchema = z.object({ input: n, output: n, cacheRead: n, cacheWrite: n, total: n, reasoning: n.nullable() })
export const factSchema = z.object({
  id: z.string(), time: n, kind: z.enum(['input', 'turn', 'call']),
  workspace: z.string(), category: categorySchema, provider: z.string(), model: z.string(),
  outcome: z.enum(['success', 'failed', 'cancelled']).nullable(),
  usage: usageSchema.nullable(), durationMs: n.nullable(),
})
export type Fact = z.infer<typeof factSchema>
export const recordSchema = z.object({
  cursor: z.number().int().min(-1), facts: z.array(factSchema),
  provider: z.string(), model: z.string(), turn: z.number().nullable(),
  started: z.number().nullable(), lastTurn: z.number().nullable(), pendingAttempt: z.string().nullable(),
})
export type RecordData = z.infer<typeof recordSchema>
export const filterSchema = z.object({
  from: z.number().finite().optional(), to: z.number().finite().optional(),
  timezone: z.string().max(100).default('UTC'), workspace: z.string().optional(),
  model: z.string().optional(), category: categorySchema.optional(),
}).refine(f => f.from === undefined || f.to === undefined || f.from <= f.to, 'Invalid date range')
export type Filter = z.input<typeof filterSchema>
export const totalsSchema = z.object({
  input: n, output: n, cacheRead: n, cacheWrite: n, total: n,
  inputs: n, turns: n, calls: n, unknown: n, success: n, failed: n, cancelled: n,
  durationMs: n, timedCalls: n,
})
export type Totals = z.infer<typeof totalsSchema>
export const statusSchema = z.object({
  state: z.enum(['backfill', 'ready', 'degraded', 'closed']),
  totalSessions: n, readSessions: n, failedSessions: n,
  storage: z.enum(['durable', 'memory']), error: z.string().nullable(),
  startedAt: n, updatedAt: n,
})
export type Status = z.infer<typeof statusSchema>
export const dashboardSchema = z.object({
  schemaVersion: z.literal(1), timezone: z.string(), totals: totalsSchema,
  coverage: z.object({ firstEventAt: n.nullable(), lastEventAt: n.nullable(), auxiliarySince: n }),
  daily: z.array(z.object({ day: z.string(), totals: totalsSchema })),
  models: z.array(z.object({ key: z.string(), provider: z.string(), model: z.string(), totals: totalsSchema })),
  heatmap: z.array(z.object({ day: z.string(), calls: n, total: n, inRange: z.boolean() })),
  workspaces: z.array(z.string()), modelOptions: z.array(z.object({ key: z.string(), label: z.string() })),
  status: statusSchema,
})
export type Dashboard = z.infer<typeof dashboardSchema>
export const exportSchema = z.object({ filename: z.string(), mime: z.string(), text: z.string() })
export type ExportData = z.infer<typeof exportSchema>
const codec = (typeSymbol: string, schema: z.ZodType) => ({ mode: 'strict' as const, typeSymbol: 'dsh-usage#' + typeSymbol, create: () => schema })
export const descriptors: InvocationDescriptor[] = [
  { id: 'dsh-usage#dshUsage/query', service: 'dshUsage', namespace: 'dshUsage', method: 'query', invocation: { kind: 'direct' },
    parameters: [{ name: 'filter', wire: 'filter', source: 'json', codec: codec('Filter', filterSchema) }],
    cancellation: { parameter: 'signal' }, result: codec('Dashboard', dashboardSchema) },
  { id: 'dsh-usage#dshUsage/export', service: 'dshUsage', namespace: 'dshUsage', method: 'export', invocation: { kind: 'direct' },
    parameters: [{ name: 'filter', wire: 'filter', source: 'json', codec: codec('Filter', filterSchema) },
      { name: 'format', wire: 'format', source: 'json', codec: codec('Format', z.enum(['csv', 'json'])) }],
    cancellation: { parameter: 'signal' }, result: codec('Export', exportSchema) },
]
export const remoteContribution = { package: 'dsh-usage', descriptors }
export const hostContribution = { package: 'dsh-usage', face: 'host' as const, schemas: [], model: { services: [], events: [], objects: [] }, invocations: descriptors }
