import type * as React from 'react'
import type { PropsRuntime, SlotCore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { remoteContribution } from './contracts'
import { createDashboard } from './dashboard'
import type { UsageRemote } from './page-store'
import { css } from './styles'
export interface ClientContext {
  slots: { register: SlotCore['register']; inject(name: 'main' | 'sidebar.panellist', callback: () => () => void): () => void | Promise<void> }
  layout: ILayout
  remote: { $mount(contribution: typeof remoteContribution): Promise<() => Promise<void>>; dshUsage: UsageRemote }
  connection?: { state: { subscribe(fn: () => void): () => void } }
  inject(dependencies: string[], callback: (ctx: ClientContext) => () => void | Promise<void>): { dispose(): Promise<void> }
  effect(callback: () => (() => void | Promise<void>), label?: string): unknown
}
declare global { interface Window { __ModuleLoader__: { load(entry: { id: string; factory(require: (id: 'react') => typeof React): { name: string; inject: string[]; apply(ctx: ClientContext): Promise<void> } }): void } } }
window.__ModuleLoader__.load({ id: 'dsh-usage', factory(require) {
  const R = require('react'), h = R.createElement
  function Icon({ size }: PropsRuntime<'sidebar.panellist'>) {
    return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'M4 3v17h17M8 16v-4m5 4V9m5 7V5M7 8l6-3 5-2' }))
  }
  return { name: 'dsh-usage', inject: ['slots', 'layout', 'remote', 'connection'], async apply(ctx) {
    const releases: Array<() => unknown> = []; let disposal: Promise<void> | undefined, closed = false
    const dispose = () => disposal ??= (async () => {
      closed = true
      if (ctx.layout.panelInfo.getSnapshot().activePanelId === 'dsh-usage') ctx.layout.selectPanel(null)
      for (const release of releases.splice(0).reverse()) {
        try { await release() } catch { console.warn('[dsh-usage] client cleanup failed') }
      }
    })()
    ctx.effect(() => dispose, 'dsh-usage: client cleanup')
    try {
      const unmount = await ctx.remote.$mount(remoteContribution)
      if (closed) { await unmount(); return }
      releases.push(unmount)
      const style = document.createElement('style'); style.dataset.dshUsage = 'style'; style.textContent = css; document.head.append(style); releases.push(() => style.remove())
      // $mount creates a separately injected Cordis namespace Service.
      const namespace = ctx.inject(['remote.dshUsage'], child => {
        const Dashboard = createDashboard(R, child.remote.dshUsage, child.connection?.state)
        const main = child.slots.inject('main', () => child.slots.register({ name: 'main', key: 'dsh-usage' }, Dashboard))
        const sidebar = child.slots.inject('sidebar.panellist', () => child.slots.register({ name: 'sidebar.panellist', id: 'dsh-usage', order: 30, label: '统计数据' }, Icon))
        return async () => {
          if (child.layout.panelInfo.getSnapshot().activePanelId === 'dsh-usage') child.layout.selectPanel(null)
          await sidebar(); await main()
        }
      })
      releases.push(() => namespace.dispose())
    } catch (error) { await dispose(); throw error }
  } }
} })
