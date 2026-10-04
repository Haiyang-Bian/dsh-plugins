# DSH 外观增强验证

验证日期：2026-10-04。兼容基线：已安装的 DSH `0.2.0-rc.2`。插件版本保持 `0.10.0`。

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

最终产物通过 **55 项浏览器集成检查**。夹具使用真实 React 18.3.1、安装版 Cordis、SlotCore、SlotRegistry、ThemeRuntime、ThemePresenter、官方字号组件，以及前端排版、tooltip/toast、设置、外壳、侧栏与会话 CSS。

保留原有主题、字体、代码字体、设置关闭/重开、宿主同步、字号边界和卸载恢复检查；调整背景断言以符合当前“外壳渐变、主浮岛柔和铺底、内层透明”的结构。新增实际计算样式检查覆盖：

- 三主题 tooltip、toast 与快捷键提示的文字对比度至少 4.5:1。
- 侧栏与主浮岛在宿主网格列内留白，设置窗口/设置行及实色输入框的圆角与阴影生效。
- Windows 标题栏的顶部留白、原有拖拽位置，收起为零宽侧栏后没有残余边框、阴影或占位。
- 切回 light/dark/system 及最终卸载时，布局标识、边距、圆角、阴影及字体回到基线。

另在 640 px 窄窗口，以及 400 px、侧栏收起的窗口中手动验证：文档无横向溢出，主内容与输入框没有越出所属区域。浏览器控制台无 error/warn。

截图：`artifacts/aurora-islands.jpg`、`artifacts/sage-islands.jpg`、`artifacts/sunset-islands.jpg`。此前渐变及迁移截图继续保留。

**验证边界：** 设置容器、会话内容、store handle 与持久化 scope 是夹具；tooltip/toast 节点是使用宿主 CSS 的固定展示样本，检查配色而非真实 hover、定位或自动消失流程。Windows 模式和侧栏收起由夹具模拟对应宿主 data/class 及网格属性，没有验证真实桌面窗口拖动。强制颜色分支已关闭插件渐变与阴影，未在系统高对比度模式下手动验证。浏览器日志下载落盘仍未计入通过项。

## 完整 DSH 应用端到端验证

**未完成。** 本次已启动真实 DSH 并尝试访问本地入口，浏览器工具仍返回 `ERR_BLOCKED_BY_CLIENT`；本会话没有原生窗口操作能力，无法进入真实设置及提示界面。浏览器夹具结果不能替代完整应用的加载、真实远端配置同步、侧栏拖动和桌面窗口验证。

desktop profile 沿用上次迁移的新目录链接及启用记录。本次没有修改 profile；重建客户端产物后，可刷新 DSH 客户端或重新启用插件检查浮岛效果。

## 单仓库迁移与打包

- 仓库根目录为 default-workspace，main 分支；原始插件基线由 Git 提交保存，迁移后位于 plugins/dsh-appearance。
- 根包 dsh-plugins 为 private，pnpm 固定 10.32.1；插件仍为 0.10.0。共享锁文件只调整 importer，依赖版本和解析结果保持原样，根目录冻结安装通过。
- 临时打包通过 prepack 类型检查和构建；归档仅包含 index.js、dist/client.js、package.json、cordis.patch.yml、README.md、VALIDATION.md，没有依赖或测试目录。
- 生产源码中旧运行时名称仅保留于明确标注的兼容存储常量。主题 ID、URL 参数及宿主共享 React 方式保持不变。
- desktop profile 原 package.json、pnpm-lock.yaml、cordis.patch.yml 及原源码归档备份于 `C:/Users/26687/AppData/Local/Temp/dsh-appearance-migration/profile-backup-20261004-200744`。旧依赖链接、node_modules 和 dist 已清理；旧目录已为空，但受进程占用，未能移除目录本身。
