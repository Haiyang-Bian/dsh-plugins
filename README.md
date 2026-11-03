# DSH 插件开发仓库

一个 Git 仓库管理多个独立 DSH 插件，使用 pnpm workspace 和根目录共享锁文件。

当前插件：

- [DSH 外观增强](plugins/dsh-appearance/README.md)：`dsh-appearance`，版本 `0.10.0`。
- [DSH 使用统计](plugins/dsh-usage/README.md)：`dsh-usage`，版本 `0.1.1`（DSH `0.2.1-rc.2`），原生侧栏入口与图表仪表盘。

## 从 GitHub 安装

公开源码仓库：[Haiyang-Bian/dsh-plugins](https://github.com/Haiyang-Bian/dsh-plugins)。同一仓库内的插件可以分别通过 DSH 的 Git 安装功能安装，地址中的 `&path:` 选择插件子目录：

| 插件 | Git 安装地址 | 已验证兼容基线 |
|---|---|---|
| DSH 外观增强 0.10.0 | `git+https://github.com/Haiyang-Bian/dsh-plugins.git#main&path:/plugins/dsh-appearance` | DSH 0.2.0-rc.2 |
| DSH 使用统计 0.1.1 | `git+https://github.com/Haiyang-Bian/dsh-plugins.git#main&path:/plugins/dsh-usage` | DSH 0.2.1-rc.2 |

在 DSH 的 Git 仓库安装入口填写所需插件的完整地址。也可在已注册 `dsh` 命令的终端执行（先完全退出桌面 DSH）：

```powershell
dsh plugin --profile desktop add "git+https://github.com/Haiyang-Bian/dsh-plugins.git#main&path:/plugins/dsh-appearance" --allow-build=dsh-appearance
dsh plugin --profile desktop add "git+https://github.com/Haiyang-Bian/dsh-plugins.git#main&path:/plugins/dsh-usage" --allow-build=dsh-usage
```

按需安装其中一个即可，然后重新打开 DSH 并确认插件已启用。桌面版使用 `desktop` profile；其他运行方式改成实际 profile 名称。没有 `dsh` 命令时，使用图形界面的 Git 安装入口，或先通过桌面应用提供的命令管理功能注册命令（取决于桌面版本）。

Git 安装获取源码，两个插件的 `prepare` 会在安装时构建产物；不需要手动克隆，也不向 Git 提交 `dist`。pnpm 10 默认限制 Git 依赖的构建脚本。上面的 `--allow-build` 只授权所选插件；图形界面如提示构建脚本被拦截，按提示允许所选插件构建并重试；如无法在界面授权，可完全退出 DSH 后执行相应命令，或在该 profile 的 `pnpm-workspace.yaml` 现有 `onlyBuiltDependencies` 列表中加入需要的插件名再重试，保留其他设置。

根包 `dsh-plugins` 的 `private: true` 只防止误发布到 npm，不影响 GitHub 仓库公开；根包不是可启用的插件包，完整地址必须保留子目录。需要固定源码版本时，将 `main` 替换为已核实的提交 SHA，保留 `&path:/plugins/...`。

安装插件只安装代码，不同步外观偏好、统计历史、会话或凭据；这些数据仍属于各台电脑的本地 DSH profile。自定义字体还需要在目标机安装相应字体。

### 安装验证

2026-11-03 使用桌面版附带的 DSH CLI `0.2.1-rc.2` 和 pnpm `10.32.1`，在独立临时 `DSH_HOME`/profile 中从上述公开 GitHub 地址同时安装两款插件。已确认自动构建成功、Node/客户端入口及 bundle patch 存在，profile 的 `dsh.profile.bundles` 登记两款插件，`--dump-config` 展开结果包含它们。验证源码提交为 `76dbd63`。

仓库的 82 项回归（外观 54、统计 28）、类型检查、冻结锁文件安装和根目录构建通过。此次安装验证未修改日常 desktop profile；尚未进行第二台电脑或图形安装界面的完整端到端验证。

## 开发

使用 pnpm 10.32.1，在本目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm run typecheck
pnpm run build
pnpm --filter dsh-appearance run watch
pnpm run test:browser
```

根目录的测试、类型检查和构建递归执行各插件同名命令。浏览器验证命令并行启动各插件的夹具，分别打开输出的本地 URL；统计夹具自动检查，外观夹具点击“运行集成检查”；详细边界和结果见各插件的 VALIDATION.md。单插件可执行 `pnpm --filter dsh-usage run test:browser`。

## 独立构建与打包

```powershell
pnpm --filter dsh-appearance test
pnpm --filter dsh-appearance run typecheck
pnpm --filter dsh-appearance run build
pnpm --filter dsh-appearance exec pnpm pack --pack-destination C:\path\to\output
```

DSH 应链接具体插件目录 `plugins/dsh-appearance`，根包是 private 开发入口。每个插件保留自己的包名、版本、DSH bundle 声明和产物；前端插件从宿主加载共享 React。

## 新增插件

1. 在 `plugins/<包名>` 下创建独立包，使用唯一包名和运行时 ID，并声明自己的依赖。
2. 配置该插件的构建、测试、类型检查及 DSH 入口；按照宿主要求声明 bundle 和客户端依赖。
3. 在根目录运行 `pnpm install` 更新共享锁文件，然后验证对应插件及根目录命令。
4. 每个插件独立维护版本，发布标签使用 `<包名>-v<版本>`；分支按具体开发任务创建。

workspace 自动收录 `plugins/*`。当前不设置公共代码包，等出现实际复用需要后再添加。

## 改名兼容

旧 `demo-sunset-theme` 已迁入外观插件。主题 ID 和功能保持不变；旧 localStorage 键、OPFS 日志文件和 Web Locks 名称继续使用，已保存设置与日志无需迁移。

迁移基线提交保留原始源码。desktop profile 属于用户本地配置，备份和修改不纳入此仓库。依赖、dist、日志和打包文件不提交；客户端产物通过 build 或 prepack 重建。
