# DSH 外观增强验证

验证日期：2026-10-04。兼容基线：已安装的 DSH `0.2.0-rc.2`。

## 自动检查

| 检查 | 结果 |
|---|---|
| 根目录 `pnpm test` | 49 项全部通过（原 45 项 + 4 项改名兼容检查） |
| 根目录 `pnpm run typecheck` | 通过 |
| 根目录 `pnpm run build` | 通过，已重新生成 `dist/client.js` |
| 客户端共享 React | 产物在模块工厂内调用宿主 `require("react")`，未包含 React 运行时实现 |

新增检查核对包清单、Node 导出、客户端模块 ID 和 bundle 声明，验证改名后仍读取旧字体/主题键、历史 OPFS/localStorage 日志和 Web Locks 名称，且导出文件名使用 dsh-appearance。

回归测试使用真实 SlotCore 验证外观行的优先级替换与卸载恢复，覆盖设置声明缺失/重建、字体恢复及失败回滚、全部主题动作、宿主同步、启动异常、导出与关闭并发，以及 30 次连续启停后的监听器、定时器、节点和覆盖层基线。原有 OPFS、localStorage、内存回退、历史保留和容量限制测试继续通过。

## 浏览器集成

迁移后的 dsh-appearance 构建通过 **31 项浏览器集成检查**。夹具使用真实 React 18.3.1，以及从已安装 app.asar 只读加载的 Cordis、SlotCore、SlotRegistry、ThemeRuntime、ThemePresenter、官方外观/字号组件和完整前端设计、排版、外壳、侧栏与会话 CSS。设置容器、无会话适配器、会话内容、store handle 和宿主持久化 scope 为测试夹具。

已验证六主题与选中样式、15 预设分组、自定义输入先编辑后提交、主界面/输入框/Markdown 实际计算字体、代码字体保留、设置关闭/重开、草稿丢弃、宿主同步、内置主题恢复管理权、字号 10–22 px、卸载恢复官方外观及重新启用。前一版还通过真实键盘操作确认 Enter 提交自定义字体。

本次新增 Aurora/Sage 在真实宿主 CSS 外壳、中心列、侧栏及聊天内容节点上的实际 `background-image` 检查，确认渐变预览、实色输入卡片、关闭设置后背景继续生效，以及切换 Sunset/内置主题和卸载后装饰完全撤销。当前浏览器无横向溢出，控制台无 error/warn。人工查看两种主题，蓝青淡紫光晕和绿米色纸纹均可见；纸纹是静态 CSS 图层。

本次迁移复验截图为 `artifacts/migration-integration.jpg`，通过检查后显示 Aurora。原有视觉验证截图保存在工作区 `artifacts/aurora-gradient.jpg` 与 `artifacts/sage-texture.jpg`，显示安装版渲染器及外壳 CSS 的集成夹具。旧迁移截图为 `artifacts/settings-integration.png`。系统强制颜色媒体分支已添加，未在真实系统高对比度模式下手动验证。

日志行正常显示 OPFS 状态；Node 测试已验证实际导出内容及关闭竞态。浏览器工具未捕获文件下载完成事件，因此浏览器下载落盘未计入通过项目。

## 完整 DSH 应用端到端验证

**未完成。** 已在 DSH 完全退出后迁移 desktop profile，保留 disabled: false，并使用宿主附带 pnpm 更新锁文件和新目录链接。核实新链接指向 plugins/dsh-appearance，且通过 profile 链接导入的 Node 入口名称为 dsh-appearance；其他 bundle 和配置 patch 保持原样。随后启动真实 DSH 并访问其本地入口，当前浏览器工具返回 `ERR_BLOCKED_BY_CLIENT`，无法进入真实设置界面；本会话的原生应用操作不可用。

浏览器夹具的通过结果证明当前安装版的插槽注册、React hook 绑定、字号组件和字体呈现兼容性，不能替代完整应用的包加载、真实远端配置同步和桌面窗口验证。

可在真实 DSH 中打开已启用插件的设置后检查“设置 → 通用”：出现六个主题卡片与字体下拉；关闭设置后字体仍生效；禁用插件后官方外观行恢复。

## 单仓库迁移与打包

- 仓库根目录为 default-workspace，main 分支；原始插件基线由 Git 提交保存，迁移后位于 plugins/dsh-appearance。
- 根包 dsh-plugins 为 private，pnpm 固定 10.32.1；插件仍为 0.10.0。共享锁文件只调整 importer，依赖版本和解析结果保持原样，根目录冻结安装通过。
- 临时打包通过 prepack 类型检查和构建；归档仅包含 index.js、dist/client.js、package.json、cordis.patch.yml、README.md、VALIDATION.md，没有依赖或测试目录。
- 生产源码中旧运行时名称仅保留于明确标注的兼容存储常量。主题 ID、URL 参数及宿主共享 React 方式保持不变。
- desktop profile 原 package.json、pnpm-lock.yaml、cordis.patch.yml 及原源码归档备份于 `C:/Users/26687/AppData/Local/Temp/dsh-appearance-migration/profile-backup-20261004-200744`。旧依赖链接、node_modules 和 dist 已清理；旧目录已为空，但受进程占用，未能移除目录本身。
