# DSH 外观增强 (dsh-appearance)

为 DeepSeek Harness 提供 Sunset（深紫与琥珀）、Aurora（蓝青与淡紫渐变）、Sage（鼠尾草绿与暖米色纸纹）三个浮岛式主题，并将外观和字体控制集成到 **设置 → 通用**。

## 使用

启用插件后打开 DSH 官方设置的“通用”页：

- **外观**：浅色、深色、跟随系统、Sunset、Aurora、Sage，以三列卡片显示。启用期间替换官方外观行；卸载后自动恢复。
- **字体**：15 个预设按 6 组显示在下拉框中。预设立即应用；选择“自定义字体”后输入本机字体名，点击“应用”或按 Enter 提交。关闭设置会丢弃未提交输入。
- **正文字号**：继续使用官方 10–22 px 控件。
- **主题插件日志**：默认折叠，展开后查看存储状态或导出 `.log`。

插件不再创建右下角悬浮按钮。关闭设置窗口不会停用字体覆盖、自定义主题或日志记录。

Aurora 在主区域使用柔和的蓝、青、淡紫光晕，侧栏使用更明显的多色渐变。Sage 将绿、薄荷与暖米色混合，主区域带细纸纹，侧栏带轻斜纹。装饰覆盖 DSH 外壳和聊天背景，设置卡片展示同款预览；输入卡片保持实色，代码区域沿用宿主样式。背景由静态 CSS 渐变生成，无动画、外部图片或网络请求；系统强制颜色模式下关闭渐变与插件阴影。

三个自定义主题使用浮岛式（island）界面：侧栏和主内容独立留白，设置窗口、设置行及输入框采用圆角、细边框和柔和阴影。主内容降低渐变强度，内层透明避免重复铺底，输入框保持实色。切回内置主题或卸载后恢复宿主布局。留白位于宿主网格列内部，保留原有轨道、拖拽坐标及 Windows 标题栏；窄窗口收紧留白。左栏宽度规则兼容官方 `display: contents` 插槽包裹节点，内层宽度限制在浮岛实际宽度内，保留按钮、工作区列表及滚动条的右侧间距。右栏在实际停靠面板内留白，内容、标签栏和空面板统一圆角；覆盖式零宽轨道、双面板和 Windows 全屏继续沿用宿主定位，不改动轨道宽度。

Aurora/Sage 的 tooltip 与 toast 使用主题对应的深色背景，配合宿主白色文字及快捷键标签。三个主题的提示文字对比度均达到 4.5:1。

字体覆盖 DSH 实际使用的 `--dsw-font-family` 和 `--dsw-font-family-brand`，作用于主界面、输入框、Markdown 正文及设置界面。代码区域保留宿主等宽字体。预设和自定义字体均使用本机已安装字体及 fallback，不自动下载字体。选择“系统默认”或卸载插件会移除覆盖。

## 持久化

| 设置 | 保存位置 |
|---|---|
| 内置主题 `system/light/dark` 和字号 | DSH settings scope；本地回环客户端由宿主持久化，非回环客户端只在进程内保留 |
| 自定义主题 | `localStorage['demo-sunset-theme:theme']` |
| 字体选择 | `localStorage['demo-sunset-theme:font']` |
| 自定义字体名 | `localStorage['demo-sunset-theme:custom-font']` |

原 demo-sunset-theme 已更名为 dsh-appearance，包名和运行时标识均已更新。沿用旧版本的全部存储键、OPFS 文件 demo-sunset-theme.log 和 Web Locks 名称 demo-sunset-theme:log，无需手动迁移。插件偏好按浏览器 origin 保存，不跨设备同步。

初始化优先级为：有效 `?theme=<id>` → 已保存且仍注册的自定义主题 → 宿主当前偏好。URL 只在激活时使用，之后不会覆盖用户选择。未知 URL 主题被忽略，失效的保存主题被清除；未知字体和空自定义字体回落到系统默认。

自定义主题启用期间，插件会在宿主同步后恢复该选择。通过合并后的“外观”行选择浅色、深色或跟随系统，会清除自定义选择并交回宿主管理。卸载后停止恢复，宿主继续使用其内置偏好。浏览器存储不可用时，本次选择仍然生效，但刷新后可能无法恢复。

## 开发与验证

该插件属于根目录 pnpm workspace，使用根目录共享锁文件。在仓库根目录安装依赖，再进入本插件目录运行以下检查：

```bash
pnpm test
pnpm run typecheck
pnpm run build
pnpm run watch
```

`build` 和 `prepack` 都先检查 TypeScript，再生成 `dist/client.js`；`watch` 只监听打包。运行时 React 来自 DSH 的 `factory(require)`，不会打包额外的 React。官方 DSH 类型和 React 测试包仅是开发依赖。

DSH 链接此工作区时，重建后的客户端产物可由宿主重新加载。若界面仍显示旧悬浮按钮，重新启用插件或刷新客户端。

Node 回归测试使用内置测试运行器、TypeScript 和真实 `SlotCore`，覆盖替换/恢复、偏好同步、启动失败、日志存储故障和连续启停资源清理。

安装了 DSH 的 Windows 环境还可以运行：

```bash
pnpm run test:browser
# 或显式指定 app.asar
node tests/browser-smoke.cjs "C:/path/to/DeepSeek Harness/resources/app.asar"
```

打开输出的本地 URL，点击“运行集成检查”。夹具使用真实 React 及已安装 DSH 的 Cordis、SlotRegistry、ThemeRuntime、ThemePresenter、官方字号行和前端/外壳 CSS；设置容器、会话内容及持久化 scope 为测试夹具。它会检查计算字体、设置关闭/重开、未提交输入、主题同步、宿主区域的实际背景图层、提示配色、浮岛边界和卸载恢复，**不等同于完整 DSH 应用端到端验证**。

兼容基线为 DSH `0.2.0-rc.2`。实际验证结果见 `VALIDATION.md`。

## 实现

- `src/client.ts`：模块工厂、主题注册和插件生命周期。
- `src/preferences.ts`：主题恢复与宿主同步边界。
- `src/font-preference.ts`：插件级字体状态和覆盖，独立于设置组件挂载。
- `src/theme-decoration.ts`：跟随激活主题的背景、浮岛标识及清理。
- `src/tokens/decoration.ts`：Aurora/Sage 的渐变和纹理图层。
- `src/settings.ts`：三个 React 设置贡献，以及插槽生成的 observable selector hook。
- `src/styles.ts`：使用宿主 token 的设置样式、背景与浮岛表面样式。
- `src/log.ts`：每次激活独立的有界持久日志。

通过 `ctx.slots.inject('settings.general.item', ...)` 等待官方声明。外观贡献复用 `appearance` ID，以 `priority: -100`、`order: 10` 替换官方展示；字体贡献顺序为 `10.5`，日志为 `12`，官方字号行保持不变。贡献跟随声明生命周期移除与恢复，插件状态保持到插件卸载。

组件通过 `inject` 接收动作和裸 observable source，由宿主生成 `useAppearance`、`useFont`、`useSink` 钩子；组件不接收 `ctx`。所有主题动作经过偏好控制器，确保切回内置主题时不会被自定义恢复逻辑反向覆盖。

渐变使用插件专属 image token，宿主语义 color token 保持合法颜色。装饰控制器订阅 `theme/change` 并读取最新激活主题，为 Aurora/Sage 设置渐变标识，为三个自定义主题设置浮岛标识；切换内置主题或卸载时撤销。聊天区域优先使用宿主 data 属性，外壳与侧栏选择器按已安装的 `0.2.0-rc.2` CSS 类核实；升级宿主后应复验这些选择器。

添加主题时同时更新主题注册和设置中的主题卡片列表；添加字体时更新 `src/fonts.ts` 的预设及分组即可。

## 日志

每次激活创建独立日志实例，按 OPFS → localStorage → 控制台与有界内存的顺序选择存储。保留最新的最多 500 行、100 KiB UTF-8 内容，约每 250 ms 提交一批。OPFS 写入等待流关闭；Web Locks 协调同 origin 的窗口，不支持时保证同一 bundle 内串行写入。

导出先等待初始化和 flush，再从实际存储读取历史及本次记录。持久化不可用时仍能导出内存日志。关闭设置不会取消导出；插件卸载与导出并发时取消下载，并等待日志提交和资源清理。异常退出可能丢失尚未提交的日志。
