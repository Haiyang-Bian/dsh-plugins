/** Font presets — override DSH's shared --dsw-font-family typography token. */
export type FontGroup = 'system' | 'os' | 'serif' | 'mono' | 'display' | 'cjk'

export interface FontPreset {
  id: string
  label: string
  preview: string
  family: string
  group: FontGroup
}

export const FONTS: FontPreset[] = [
  // system
  { id: 'system',   group: 'system',  label: '系统默认', preview: 'Aa',
    family: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif' },
  { id: 'sans',     group: 'system',  label: '无衬线',   preview: 'Aa',
    family: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", sans-serif' },

  // OS-native
  { id: 'sf',       group: 'os',      label: 'SF Pro',   preview: 'Aa',
    family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' },
  { id: 'helvetica', group: 'os',     label: 'Helvetica', preview: 'Aa',
    family: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: 'segoe',    group: 'os',      label: 'Segoe UI', preview: 'Aa',
    family: '"Segoe UI", "Segoe UI Variable", Tahoma, sans-serif' },
  { id: 'verdana',  group: 'os',      label: 'Verdana',  preview: 'Aa',
    family: 'Verdana, Geneva, sans-serif' },

  // serif
  { id: 'serif',    group: 'serif',   label: '衬线',     preview: 'Aa',
    family: 'Georgia, "Source Han Serif SC", "Songti SC", "Noto Serif CJK SC", serif' },
  { id: 'songti',   group: 'serif',   label: '宋体',     preview: '字',
    family: '"Songti SC", "SimSun", "Source Han Serif SC", serif' },
  { id: 'cambria',  group: 'serif',   label: 'Cambria',  preview: 'Aa',
    family: 'Cambria, Georgia, serif' },

  // mono
  { id: 'mono',     group: 'mono',    label: '等宽',     preview: 'Aa',
    family: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace' },
  { id: 'consolas', group: 'mono',    label: 'Consolas', preview: 'Aa',
    family: 'Consolas, "Courier New", monospace' },

  // display
  { id: 'rounded',  group: 'display', label: '圆润',     preview: 'Aa',
    family: '"Nunito", "Quicksand", "PingFang SC", system-ui, sans-serif' },

  // CJK
  { id: 'pingfang', group: 'cjk',     label: '苹方',     preview: '字',
    family: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' },
  { id: 'yahei',    group: 'cjk',     label: '雅黑',     preview: '字',
    family: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { id: 'noto',     group: 'cjk',     label: 'Noto CJK', preview: '字',
    family: '"Noto Sans CJK SC", "Noto Sans SC", "PingFang SC", sans-serif' },
]

export const FONT_GROUPS: Array<{ id: FontGroup; label: string }> = [
  { id: 'system',  label: '系统' },
  { id: 'os',      label: '原生' },
  { id: 'serif',   label: '衬线' },
  { id: 'mono',    label: '等宽' },
  { id: 'display', label: '展示' },
  { id: 'cjk',     label: '中文' },
]

export const FONT_SOURCE = 'dsh-appearance-font'
