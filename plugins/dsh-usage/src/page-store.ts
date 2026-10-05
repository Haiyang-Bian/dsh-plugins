import type { Dashboard, ExportData, Filter } from './contracts'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
export interface UsageRemote {
  query(filter: Filter, signal?: AbortSignal): Promise<RemoteResult<Dashboard>>
  export(filter: Filter, format: 'csv' | 'json', signal?: AbortSignal): Promise<RemoteResult<ExportData>>
}
export interface PageSnapshot { data: Dashboard | null; error: string | null; loading: boolean }
export class PageStore {
  private snapshot: PageSnapshot = { data: null, error: null, loading: true }
  private listeners = new Set<() => void>()
  private controller?: AbortController
  private revision = 0
  private disposed = false
  constructor(readonly remote: UsageRemote, private filter: Filter) {}
  getSnapshot = () => this.snapshot
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private publish(snapshot: PageSnapshot) { this.snapshot = snapshot; for (const fn of this.listeners) fn() }
  setFilter(filter: Filter) { this.filter = filter; this.snapshot = { ...this.snapshot, data: null }; void this.refresh() }
  async refresh() {
    if (this.disposed) return
    this.controller?.abort(); const controller = this.controller = new AbortController(), revision = ++this.revision
    this.publish({ ...this.snapshot, loading: true })
    try {
      const result = await this.remote.query(this.filter, controller.signal)
      if (this.disposed || controller.signal.aborted || revision !== this.revision) return
      if (!result.ok) throw result.error
      this.publish({ data: result.value, error: null, loading: false })
    } catch {
      if (!this.disposed && !controller.signal.aborted && revision === this.revision) this.publish({ ...this.snapshot, error: '无法读取统计数据，请检查连接并重试。', loading: false })
    }
  }
  pause() { this.controller?.abort(); this.revision++ }
  dispose() { this.disposed = true; this.pause(); this.listeners.clear() }
}
