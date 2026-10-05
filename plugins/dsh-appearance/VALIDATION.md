# DSH 外观增强验证

验证日期：2026-10-05。兼容基线：已安装的 DSH `0.2.0-rc.2`。插件版本保持 `0.10.0`。

## 自动检查

| 检查 | 结果 |
|---|---|
| 根目录 `pnpm test` | 54 项全部通过（原 49 项 + 5 项浮岛与提示回归） |
| 根目录 `pnpm run typecheck` | 通过 |
| 根目录 `pnpm run build` | 通过，已重新生成 `dist/client.js` |
| 客户端共享 React | 在模块工厂内加载宿主 `require("react")`，没有第二份 React 运行时 |

新增检查验证三个主题的 tooltip/toast 背景与宿主白字对比度至少 4.5:1，浮岛仅跟随插件主题，关闭设置后仍生效，切回内置或其他插件主题时撤销，卸载及失败回滚恢复原有 body 属性。原有 30 次启停的资源基线检查包含新增布局属性。

现有插槽替换与卸载恢复、字体、URL、偏好同步、启动失败、导出与关闭并发、OPFS/localStorage/内存回退、历史与容量限制，以及改名兼容检查继续通过。本次没有更换依赖或存储名称。

## 浏览器集成

上次 85 项检查遗漏真实左栏外的 SlotOutlet 包裹层，无法证明桌面端边距已修复。本次先保留旧产物，在真实组件结构中观察到宽度规则失效和按钮裁切；再修正后代选择器，确认相同结构通过。问题来源是宿主 DOM 结构与旧夹具不一致，尚无证据表明是 Electron 的 CSS 引擎差异。

最终产物通过 **95 项浏览器集成检查**。夹具使用真实 React 18.3.1、安装版 Cordis、SlotCore、SlotRegistry、ThemeRuntime、ThemePresenter、官方 SidebarRoot 与字号组件，以及前端排版、tooltip/toast、设置、外壳、工作区列表、左右侧栏与会话 CSS。

保留原有主题、字体、代码字体、设置关闭/重开、宿主同步、字号边界和卸载恢复检查；调整背景断言以符合当前“外壳渐变、主浮岛柔和铺底、内层透明”的结构。新增实际计算样式检查覆盖：

- 三主题 tooltip、toast 与快捷键提示的文字对比度至少 4.5:1。
- 侧栏与主浮岛在宿主网格列内留白，设置窗口/设置行及实色输入框的圆角与阴影生效。
- Windows 标题栏的顶部留白、原有拖拽位置，收起为零宽侧栏后没有残余边框、阴影或占位。
- 确认侧栏由官方 SlotRenderer 生成 `data-slot="sidebar"` 锚点，`display: contents` 不改变 CSS 的 DOM 父子关系；三主题在 Windows 的 264、280、420 px 官方宽度范围内均保留右侧间距，旧产物在新版夹具中失败。
- 左栏使用宿主固定内联宽度与真实工作区列表的负边距结构，验证按钮、长标题、时间与操作按钮的右侧间距，以及列表纵向滚动和横向无溢出。使用真实 SidebarRoot 和 SlotOutlet 后，旧产物复现：内层 280 px 超过浮岛 265 px，宽度约束没有命中，新会话按钮越过右边界约 1.67 px。修复后内层约 263.67 px，按钮右侧间距约 14.67 px、列表行约 23 px、时间约 31 px（当前夹具环境）。
- 右栏停靠、零宽轨道覆盖、空面板、双面板、Windows 全屏和左栏收起后的留白、四角圆角、内容裁切、拖拽柄可命中样式及关闭后的隐藏状态。
- 切回 light/dark/system 及最终卸载时，左右栏布局标识、边距、圆角、阴影和左栏宽度约束及字体回到基线。

另在 640 px 窄窗口验证展开左栏和覆盖式右栏；在 400 px 窗口验证左栏收起与全屏右栏：文档无横向溢出，右栏留在容器边界内，窄窗口圆角为 18 px。浏览器控制台无 error/warn。

当前插槽侧栏修复截图：`artifacts/sage-sidebar-slot-fixed.jpg`。`artifacts/sage-layout-fixed.jpg` 保留为上一版夹具记录，该版本遗漏了侧栏插槽包裹层。此前三个浮岛主题、渐变及迁移截图继续保留。

**验证边界：** 设置容器、会话内容、store handle 与持久化 scope 是夹具；tooltip/toast 节点是使用宿主 CSS 的固定展示样本，检查配色而非真实 hover、定位或自动消失流程。左栏由安装版 SidebarRoot 经真实 SlotRenderer 及 React portal 渲染，保留官方 DOM、内联宽度、订阅/折叠生命周期及插槽锚点；导航数据、图标、Tooltip 包裹、回调与工作区列表内容为样本。右栏和 DockKit 面板树仍为 DOM 夹具，使用真实宿主 CSS，未执行完整 DockKit 交互运行时。Windows 模式、侧栏收起及右栏状态由夹具模拟对应宿主 data/class 和网格属性；自动检查临时关闭滑动过渡，以测量终态几何，没有验证真实拖动、分隔柄拖拽或页签分离。强制颜色分支已关闭插件渐变与阴影，未在系统高对比度模式下手动验证。浏览器日志下载落盘仍未计入通过项。

## 完整 DSH 应用端到端验证

**未完成。** 本会话没有原生窗口操作能力，无法验证完整 Electron 窗口。此前访问真实本地入口返回 `ERR_CONNECTION_REFUSED`。本次复核 desktop profile 的目录链接仍指向当前插件，并已重建包含修正选择器的客户端产物。浏览器夹具结果不能替代完整应用的加载、真实远端配置同步、侧栏拖动和桌面窗口验证。

desktop profile 沿用上次迁移的新目录链接及启用记录。本次没有修改 profile；已重建客户端产物，可刷新 DSH 客户端或重新启用插件检查左右侧栏效果。

## 单仓库迁移与打包

- 仓库根目录为 default-workspace，main 分支；原始插件基线由 Git 提交保存，迁移后位于 plugins/dsh-appearance。
- 根包 dsh-plugins 为 private，pnpm 固定 10.32.1；插件仍为 0.10.0。共享锁文件只调整 importer，依赖版本和解析结果保持原样，根目录冻结安装通过。
- 临时打包通过 prepack 类型检查和构建；归档仅包含 index.js、dist/client.js、package.json、cordis.patch.yml、README.md、VALIDATION.md，没有依赖或测试目录。
- 生产源码中旧运行时名称仅保留于明确标注的兼容存储常量。主题 ID、URL 参数及宿主共享 React 方式保持不变。
- desktop profile 原 package.json、pnpm-lock.yaml、cordis.patch.yml 及原源码归档备份于 `C:/Users/26687/AppData/Local/Temp/dsh-appearance-migration/profile-backup-20261004-200744`。旧依赖链接、node_modules 和 dist 已清理；旧目录已为空，但受进程占用，未能移除目录本身。
