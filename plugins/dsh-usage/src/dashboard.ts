import type * as React from 'react'
import type { Dashboard, Filter, Totals } from './contracts'
import type { UsageRemote } from './page-store'
import { PageStore } from './page-store'

const colors = ['var(--usage-accent)', '#439d89', '#9d82c5', '#d29a56']
const tokenKeys = ['input', 'output', 'cacheRead', 'cacheWrite'] as const
const tokenLabels = ['输入', '输出', '缓存读取', '缓存写入']
const categories = [['', '全部请求'], ['conversation', '普通对话'], ['subagent', '子 Agent'], ['session-title', '标题生成'], ['compaction', '上下文压缩'], ['auxiliary', '其他辅助']]
const fmt = (value: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1, notation: value >= 100000 ? 'compact' : 'standard' }).format(value)
const percentage = (n: number, total: number) => total ? (100 * n / total).toFixed(1) + '%' : '—'
export function dateFilter(preset: string, customFrom: string, customTo: string): Filter {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const end = new Date(); end.setHours(24, 0, 0, 0)
  if (preset === 'all') return { timezone }
  if (preset === 'custom') {
    const from = customFrom ? new Date(customFrom + 'T00:00:00').getTime() : undefined
    const to = customTo ? new Date(customTo + 'T00:00:00').getTime() : undefined
    const last = to === undefined ? undefined : new Date(to); last?.setDate(last.getDate() + 1)
    return { timezone, from, to: last?.getTime() }
  }
  const start = new Date(end); start.setDate(start.getDate() - Number(preset))
  return { timezone, from: start.getTime(), to: end.getTime() }
}
export function createDashboard(R: typeof React, remote: UsageRemote, connection?: { subscribe(fn: () => void): () => void }) {
  const h = R.createElement
  const title = (text: string) => h('title', null, text)
  const table = (headers: string[], rows: Array<Array<string | number>>) => h('details', null, h('summary', null, '查看数据表'), h('div', { className: 'table-wrap', tabIndex: 0 }, h('table', null,
    h('thead', null, h('tr', null, ...headers.map((text, i) => h('th', { key: i, scope: 'col' }, text)))),
    h('tbody', null, ...rows.map((row, i) => h('tr', { key: i }, ...row.map((cell, j) => h('td', { key: j }, cell))))))))
  const legend = (labels: string[]) => h('div', { className: 'legend' }, ...labels.map((label, i) => h('span', { key: label }, h('i', { style: { background: colors[i] } }), label)))
  const card = (name: string, children: React.ReactNode, wide = false) => h('section', { className: 'card' + (wide ? ' wide' : ''), 'aria-label': name }, h('h2', null, name), children)
  function trend(data: Dashboard, tokens: boolean) {
    const daily = data.daily, max = Math.max(1, ...daily.map(row => tokens ? tokenKeys.reduce((sum, key) => sum + row.totals[key], 0) : Math.max(row.totals.calls, row.totals.inputs, row.totals.turns)))
    const x = (i: number) => 45 + (i + .5) * 500 / Math.max(1, daily.length), y = (value: number) => 175 - value / max * 140
    const elements: React.ReactNode[] = []
    for (let i = 0; i < 4; i++) {
      const yy = y(max * i / 3); elements.push(h('line', { key: 'grid' + i, x1: 45, x2: 550, y1: yy, y2: yy, className: 'chart-grid' }), h('text', { key: 'label' + i, x: 39, y: yy + 4, textAnchor: 'end' }, fmt(max * i / 3)))
    }
    if (tokens) daily.forEach((row, i) => {
      let base = 0
      tokenKeys.forEach((key, k) => { const value = row.totals[key]; if (value) elements.push(h('rect', { key: `${i}:${k}`, x: x(i) - 200 / daily.length, y: y(base + value), width: Math.max(1, 400 / daily.length), height: value / max * 140, fill: colors[k], tabIndex: 0, role: 'img', 'aria-label': `${row.day} ${tokenLabels[k]} ${value}` }, title(`${row.day} · ${tokenLabels[k]} ${fmt(value)}`))); base += value })
    })
    else (['inputs', 'turns', 'calls'] as const).forEach((key, k) => elements.push(h('polyline', { key, points: daily.map((row, i) => `${x(i)},${y(row.totals[key])}`).join(' '), fill: 'none', stroke: colors[k], strokeWidth: 2.5 }, title(['用户输入', 'Agent 轮数', '模型调用'][k]))))
    if (daily.length) elements.push(h('text', { key: 'start', x: 45, y: 198 }, daily[0].day), h('text', { key: 'end', x: 545, y: 198, textAnchor: 'end' }, daily.at(-1)!.day))
    return h(R.Fragment, null, h('svg', { viewBox: '0 0 570 210', role: 'img', 'aria-label': tokens ? '每日 token 堆叠柱状图' : '每日输入、轮数与调用折线图' }, ...elements), legend(tokens ? tokenLabels : ['用户输入', 'Agent 轮数', '模型调用']),
      table(tokens ? ['日期', ...tokenLabels] : ['日期', '用户输入', 'Agent 轮数', '模型调用'], daily.map(row => [row.day, ...(tokens ? tokenKeys.map(k => row.totals[k]) : [row.totals.inputs, row.totals.turns, row.totals.calls])])))
  }
  function ranking(data: Dashboard) {
    const rows = data.models.slice(0, 10), max = Math.max(1, ...rows.map(row => row.totals.total))
    return h(R.Fragment, null, h('svg', { viewBox: `0 0 550 ${Math.max(90, rows.length * 35 + 10)}`, role: 'img', 'aria-label': '模型已报告 token 排行' }, ...rows.flatMap((row, i) => [
      h('text', { key: 'label' + i, x: 0, y: i * 35 + 20 }, row.model.length > 23 ? row.model.slice(0, 21) + '…' : row.model),
      h('rect', { key: 'bar' + i, x: 170, y: i * 35 + 5, width: 310 * row.totals.total / max, height: 20, rx: 5, fill: colors[0], tabIndex: 0, role: 'img', 'aria-label': `${row.provider}/${row.model} ${row.totals.total} token` }, title(`${row.provider} / ${row.model} · ${fmt(row.totals.total)} token`)),
      h('text', { key: 'value' + i, x: 540, y: i * 35 + 20, textAnchor: 'end' }, fmt(row.totals.total)),
    ])), table(['提供方', '模型', 'Token', '调用', '用量未知'], data.models.map(row => [row.provider, row.model, row.totals.total, row.totals.calls, row.totals.unknown])))
  }
  function composition(t: Totals) {
    const total = tokenKeys.reduce((sum, k) => sum + t[k], 0); let offset = 0
    return h(R.Fragment, null, h('div', { className: 'donut' }, h('svg', { viewBox: '0 0 180 180', role: 'img', 'aria-label': '已报告 token 构成' }, h('circle', { cx: 90, cy: 90, r: 62, fill: 'none', stroke: 'var(--usage-border)', strokeWidth: 22 }), ...tokenKeys.map((key, i) => {
      const percent = total ? 100 * t[key] / total : 0, start = offset; offset += percent
      return h('circle', { key, cx: 90, cy: 90, r: 62, pathLength: 100, fill: 'none', stroke: colors[i], strokeWidth: 22, strokeDasharray: `${percent} ${100 - percent}`, strokeDashoffset: -start, transform: 'rotate(-90 90 90)' }, title(`${tokenLabels[i]} ${percentage(t[key], total)}`))
    }), h('text', { x: 90, y: 94, textAnchor: 'middle', style: { fontSize: 20 } }, fmt(total))), h('div', { className: 'legend' }, ...tokenKeys.map((key, i) => h('span', { key }, h('i', { style: { background: colors[i] } }), tokenLabels[i], ' ', percentage(t[key], total))))), table(['构成', 'Token'], tokenKeys.map((key, i) => [tokenLabels[i], t[key]])))
  }
  function heatmap(data: Dashboard) {
    const max = Math.max(1, ...data.heatmap.map(row => row.calls))
    return h(R.Fragment, null, h('svg', { viewBox: '0 0 570 158', role: 'img', 'aria-label': '最近十二周每日调用活动热力图' }, ...data.heatmap.map((row, i) => h('rect', {
      key: row.day, x: 45 + Math.floor(i / 7) * 39, y: 8 + i % 7 * 18, width: 34, height: 14, rx: 3, className: 'heat-cell', tabIndex: 0, role: 'img',
      fill: row.inRange && row.calls ? colors[0] : 'var(--usage-border)', fillOpacity: row.inRange ? row.calls ? .25 + .75 * row.calls / max : .4 : .12,
      'aria-label': `${row.day}：${row.inRange ? row.calls + ' 次调用' : '筛选范围外'}`,
    }, title(`${row.day} · ${row.inRange ? fmt(row.calls) + ' 次调用 / ' + fmt(row.total) + ' token' : '筛选范围外'}`))), h('text', { x: 45, y: 151 }, data.heatmap[0].day), h('text', { x: 510, y: 151, textAnchor: 'end' }, data.heatmap.at(-1)!.day)),
      table(['日期', '调用', 'Token'], data.heatmap.filter(row => row.inRange).map(row => [row.day, row.calls, row.total])))
  }
  function performance(data: Dashboard) {
    const rows = data.models.slice(0, 10), average = (t: Totals) => t.timedCalls ? t.durationMs / t.timedCalls / 1000 : 0
    const max = Math.max(1, ...rows.map(row => average(row.totals)))
    return h(R.Fragment, null, h('svg', { viewBox: `0 0 550 ${Math.max(85, rows.length * 39 + 25)}`, role: 'img', 'aria-label': '各模型平均记录耗时与失败比例' },
      h('text', { x: 180, y: 12 }, '平均耗时（秒）'), h('text', { x: 420, y: 12 }, '失败率'), ...rows.flatMap((row, i) => [
        h('text', { key: 'label' + i, x: 0, y: i * 39 + 39 }, row.model.slice(0, 21)),
        h('rect', { key: 'latency' + i, x: 170, y: i * 39 + 24, width: 180 * average(row.totals) / max, height: 18, rx: 4, fill: colors[1] }, title(`${average(row.totals).toFixed(1)} 秒；${row.totals.timedCalls} 个有耗时样本`)),
        h('text', { key: 'latency-value' + i, x: 395, y: i * 39 + 38, textAnchor: 'end' }, row.totals.timedCalls ? average(row.totals).toFixed(1) + 's' : '—'),
        h('rect', { key: 'failure' + i, x: 420, y: i * 39 + 24, width: 70 * row.totals.failed / Math.max(1, row.totals.calls), height: 18, rx: 4, fill: colors[3] }),
        h('text', { key: 'failure-value' + i, x: 550, y: i * 39 + 38, textAnchor: 'end' }, percentage(row.totals.failed, row.totals.calls)),
      ])), table(['提供方 / 模型', '平均耗时（秒）', '耗时样本', '成功', '失败', '取消'], data.models.map(row => [row.provider + ' / ' + row.model, row.totals.timedCalls ? average(row.totals).toFixed(2) : '—', row.totals.timedCalls, row.totals.success, row.totals.failed, row.totals.cancelled])))
  }
  return function UsageDashboard() {
    const [preset, setPreset] = R.useState('30'), [from, setFrom] = R.useState(''), [to, setTo] = R.useState(''), [workspace, setWorkspace] = R.useState(''), [model, setModel] = R.useState(''), [category, setCategory] = R.useState('')
    const filter = R.useMemo(() => ({ ...dateFilter(preset, from, to), workspace: workspace || undefined, model: model || undefined, category: category || undefined }) as Filter, [preset, from, to, workspace, model, category])
    const store = R.useMemo(() => new PageStore(remote, filter), [])
    const snapshot = R.useSyncExternalStore(store.subscribe, store.getSnapshot)
    const [exportError, setExportError] = R.useState(''), [exporting, setExporting] = R.useState(false)
    const exportAbort = R.useRef<AbortController>()
    R.useEffect(() => { store.setFilter(filter) }, [filter, store])
    R.useEffect(() => {
      let timer: ReturnType<typeof setInterval> | undefined
      const update = () => { if (timer) clearInterval(timer); timer = undefined; if (document.hidden) store.pause(); else { void store.refresh(); timer = setInterval(() => void store.refresh(), 3000) } }
      document.addEventListener('visibilitychange', update); const off = connection?.subscribe(() => { if (!document.hidden) void store.refresh() }); update()
      return () => { if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', update); off?.(); store.dispose(); exportAbort.current?.abort() }
    }, [store])
    const data = snapshot.data
    const options = (rows: string[][]) => rows.map(([value, label]) => h('option', { key: value, value }, label))
    const select = (label: string, value: string, set: (value: string) => void, rows: string[][]) => h('label', null, label, h('select', { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set(e.target.value) }, ...options(rows)))
    async function download(format: 'csv' | 'json') {
      setExporting(true); setExportError(''); const controller = exportAbort.current = new AbortController()
      try {
        const result = await remote.export(filter, format, controller.signal); if (controller.signal.aborted) return; if (!result.ok) throw result.error
        const url = URL.createObjectURL(new Blob([result.value.text], { type: result.value.mime })); const link = document.createElement('a'); link.href = url; link.download = result.value.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0)
      } catch { if (!controller.signal.aborted) setExportError('导出失败，请重试。') }
      finally { if (!controller.signal.aborted) setExporting(false) }
    }
    return h('div', { className: 'dsh-usage', 'data-dsh-usage': true },
      h('header', null, h('div', null, h('h1', null, '统计数据'), h('p', null, '了解你的模型使用与对话活动')), h('div', { className: 'toolbar' }, h('button', { onClick: () => void store.refresh() }, '刷新'), ...(['csv', 'json'] as const).map(format => h('button', { key: format, disabled: !data || exporting, onClick: () => void download(format) }, '导出 ' + format.toUpperCase())))),
      h('div', { className: 'filters' }, select('日期范围', preset, setPreset, [['1', '今天'], ['7', '近 7 天'], ['30', '近 30 天'], ['all', '全部历史'], ['custom', '自定义']]), preset === 'custom' && h(R.Fragment, null, h('label', null, '开始日期', h('input', { type: 'date', value: from, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value) })), h('label', null, '结束日期', h('input', { type: 'date', value: to, min: from, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value) }))), select('工作区', workspace, setWorkspace, [['', '全部工作区'], ...(data?.workspaces ?? []).map(value => [value, value])]), select('模型', model, setModel, [['', '全部模型'], ...(data?.modelOptions ?? []).map(row => [row.key, row.label])]), select('请求类型', category, setCategory, categories)),
      h('div', { className: 'status', role: 'status', 'aria-live': 'polite' }, data ? `${data.status.state === 'backfill' ? '历史回填中' : '持续采集中'} · 已读取 ${data.status.readSessions}/${data.status.totalSessions} 个会话 · ${data.status.storage === 'durable' ? '已持久化' : '内存模式'} · 时区 ${data.timezone} · 更新 ${new Date(data.status.updatedAt).toLocaleTimeString()}` : '正在读取统计数据…', h('p', null, '包含可读取的归档会话；历史辅助请求仅从插件启用后采集。用量未知不计为零。'), data && h('p', null, data.coverage.firstEventAt === null ? '历史覆盖：暂无可读取的事件。' : `已采集历史：${new Date(data.coverage.firstEventAt).toLocaleDateString()} — ${new Date(data.coverage.lastEventAt!).toLocaleDateString()}；本次辅助采集自 ${new Date(data.coverage.auxiliarySince).toLocaleString()}`), data?.status.error && h('p', { className: 'error' }, data.status.error), (snapshot.error || exportError) && h('p', { className: 'error', role: 'alert' }, snapshot.error || exportError)),
      data && h(R.Fragment, null, h('div', { className: 'summary' }, ...[['已报告 token', fmt(data.totals.total), `${data.totals.unknown} 次调用用量未知`], ['模型调用', fmt(data.totals.calls), `${data.totals.failed} 失败 · ${data.totals.cancelled} 取消`], ['用户输入', fmt(data.totals.inputs), '实际进入会话的用户消息'], ['Agent 轮数', fmt(data.totals.turns), '进入执行步骤的轮数']].map(([label, value, caption]) => h('section', { key: label, className: 'card' }, h('div', { className: 'caption' }, label), h('div', { className: 'value' }, value), h('div', { className: 'caption' }, caption)))),
        data.totals.calls === 0 && data.totals.inputs === 0 && h('div', { className: 'empty' }, '这个范围内暂时没有使用记录。调整筛选，或开始一次对话。'),
        model && h('p', null, '模型筛选作用于调用和 token；用户输入与 Agent 轮数按工作区及请求类型统计。'),
        h('div', { className: 'charts' }, card('每日 token 趋势', trend(data, true), true), card('模型用量排行', ranking(data)), card('Token 构成', composition(data.totals)), card('对话与调用趋势', trend(data, false), true), card('活动热力图 · 12 周', heatmap(data)), card('耗时与失败率', performance(data)))))
  }
}
