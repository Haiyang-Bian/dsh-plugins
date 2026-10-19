# 验证记录

## 0.1.1：DSH 0.2.1-rc.2 升级（2026-10-19）

版本从 0.1.0 推进为 0.1.1。开发 SDK 固定为 0.2.1-rc.2、Cordis 4.0.5；运行时 SDK peers 为 ^0.2.1-rc.2，Cordis 为 ~4.0.5，继续由桌面加载器提供同一模块实例。统计域 dsh_usage、格式版本 1、记录键和统计口径保持原样。

- 根目录 pnpm test：82 项通过（外观 54、统计 28）；pnpm run typecheck、pnpm run build、pnpm install --frozen-lockfile 通过。
- 网关回归遵守新版显式 PeerScope 契约，由可信测试载体提供 owner 身份；覆盖严格 query/export、无效参数、Agent 循环请求去重、已销毁连接拒绝及卸载。身份不从请求 JSON 读取。
- 存储与协议 SDK 分别使用 Zod 4.4 与 4.6，在存储声明处做显式类型桥接，保留记录类型和运行时 schema 校验，避免递归结构比较导致类型检查耗尽内存。Slots 类型解析绑定本包 SDK，避免与外观插件的旧开发类型混用。
- 新版浏览器集成 55 项通过：真实安装包的 SlotRenderer、SidebarRoot、AppFrame、ThemeRuntime/Presenter 与网关，检查导航、六组图表、筛选、导出、六种主题及连续启停清理。新版 ASAR 内嵌、不再单独提供的共享核心使用与安装版完全同版本的官方 npm SDK；夹具拒绝版本不一致的回退。React 为共享 18.3.1，未在插件产物打包第二份 React。
- 浏览器夹具补齐新版 shell.bottom、字体角色字段与异步偏好写入；导出仍由夹具截获下载动作，因此不称为完整下载验证。样本数据是合成数据。
- 真实 Windows Electron 0.2.1-rc.2 验证：插件详情显示 v0.1.1，启用且运行中，原不兼容警告消失；统计导航正常，六组图表可见，当前 profile 的 3/3 个会话回填完成，历史统计可读、显示已持久化。原有 Sage 外观及字体仍可见。
- 沿用 desktop profile 中已有的源码目录链接，无需卸载插件或清空统计。启动前确认 DSH 退出并备份 profile 元数据；package.json、pnpm-lock.yaml、cordis.patch.yml 与备份逐一核对未变。备份目录为用户 .dsh/profile-backups/desktop-before-dsh-usage-011-20261019-100910。
- 独立打包 dsh-usage-0.1.1.tgz 通过，包含 host/client 产物、package.json、bundle、README、验证记录和既有合成数据截图，没有依赖目录、测试目录或真实用户统计。桌面截图保存在仓库外临时目录，不作为可分发样例。

真实桌面本次未发起新的付费模型调用；普通对话、辅助请求、重试和取消的实时口径由自动测试覆盖。外观插件保留现有 54 项回归；本次未将其独立浏览器夹具完整迁移至新宿主。构建沿用两条 Zod 纯函数注释警告，产物生成成功。

## 0.1.0 历史验证记录

2026-10-05，兼容基线为安装的 DSH `0.2.0-rc.2-04f392c`。仓库使用 pnpm 10.32.1；真实 profile 安装使用桌面附带的 pnpm 11.7.0，保留 hoisted/autoInstallPeers 设置。

### 自动验证

- 根目录冻结锁文件安装通过，共享锁文件保留现有依赖版本。
- `pnpm test`：82 项通过（外观 54 项、统计 28 项）。`pnpm run typecheck`、`pnpm run build` 均通过。
- 回归覆盖历史与实时交接、重复事件、继承前缀、分叉与子 Agent 区分、最终 usage、重试、取消、未知用量、辅助请求、删除后保留、时区/DST、存储降级/恢复、队列上限、迟到查询、并发导出与关闭及连续启停。
- 使用真实 Cordis/Typert Gateway 测试服务绑定、严格参数校验、RPC 导出、循环请求归属和卸载。
- 真实桌面发现并修正了官方事件结构差异：用户消息本身就是 user/message 的 data，模型消息才嵌套在 data.message。回填重算修复漏计，按事实 ID 合并已有统计，调用不重复累加。
- 运行时 SDK 声明为 peers，符合安装版 profile 加载器的 canonical module 路由要求。客户端通过 factory(require) 读取宿主共享 React，没有打包 React 实现或图表库。

构建有两条 Zod 注释位置警告；Rollup 移除无法识别的纯函数注释，产物成功生成并可加载。

### 浏览器集成

根目录 `pnpm run test:browser` 启动两个夹具；统计夹具自动检查，外观夹具点击“运行集成检查”。

- 统计插件 55 项、外观插件 95 项通过。
- 使用真实 React 18、安装 ASAR 中的 SlotRenderer、SidebarRoot、AppFrame、ThemeRuntime、ThemePresenter、Client Remote 和真实 Host Gateway；经 HTTP 测试载体实际完成严格 query/export RPC。
- 覆盖入口位置/选中状态、六组 SVG 图表与表格、模型与自定义日期筛选、六种真实主题、关闭重开保留原会话，以及三次启停后的样式、连接订阅、可见性监听器和刷新计时器基线。
- 导出检查捕获真实 RPC 结果生成的 Blob，校验 CSV/JSON 内容、当前筛选及 URL 回收；下载动作由夹具替身截获，不将此项称为完整浏览器下载验证。
- 另以 Enter 检查导航按钮切回会话、重新打开统计页及数据表展开。默认实际视口约 1265 px，无主区域水平溢出。窄视口覆盖调用未改变实际视口，已撤销，不计为验证通过。

夹具使用合成数据及同契约的轻量 store；Tooltip/辅助图标使用替身。因此它不是完整官方会话或 tooltip 端到端验证。界面证据：[browser-integration.jpg](artifacts/browser-integration.jpg)。

### 真实 Electron

确认 DSH 完全退出后，备份 desktop profile 的 package.json、pnpm-lock.yaml 和 cordis.patch.yml，增加新插件的 dependency/bundle/启用记录。宿主 pnpm 安装及冻结锁安装通过；链接、包入口和 bundle 核实正常，外观插件及其他配置保留。

备份目录 `desktop-before-dsh-usage-20261005-215330` 位于用户 `.dsh/profile-backups/`，不纳入仓库或打包文件。第一次安装脚本未取得 GUI 进程退出码，自动恢复快照；随后使用隐藏进程并等待真实退出码的安装成功。

真实 Windows Electron 窗口中已确认：

- 原生“统计数据”入口位于导航组与工作区之间，并在主区域打开统计页。
- 当前 profile 的 3/3 个可读取会话完成回填，显示持久化、历史覆盖范围及本地时区。
- 重启后调用总量保持，漏计的真实用户输入正确补回；原会话保留。
- Sage 主题、现有字体及浮岛布局正常，真实历史图表可见。实际用户统计截图保存在仓库外，避免作为可分发样例提交。

真实桌面未发起新模型调用，普通对话、子 Agent、标题生成、压缩、失败和取消的实时场景目前由自动测试覆盖。真实桌面完整下载、全部筛选/主题切换和卸载基线未逐一实测。当前 DSH 若在最后一次构建前启动，需要下次重启加载最终宿主构建。

### 独立打包

`pnpm --filter dsh-usage exec pnpm pack --pack-destination <临时目录>` 通过，prepack 完成类型检查及构建。包包含 host/client 产物、package.json、bundle patch、README、验证记录及合成数据截图；没有依赖目录、测试或对话数据。

功能阶段提交 `088f369`；最终验证与修复作为第二个本地提交保存。未推送或发布包。
