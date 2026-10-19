# DSH 插件开发仓库

一个 Git 仓库管理多个独立 DSH 插件，使用 pnpm workspace 和根目录共享锁文件。

当前插件：

- [DSH 外观增强](plugins/dsh-appearance/README.md)：`dsh-appearance`，版本 `0.10.0`。
- [DSH 使用统计](plugins/dsh-usage/README.md)：`dsh-usage`，版本 `0.1.1`（DSH `0.2.1-rc.2`），原生侧栏入口与图表仪表盘。

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
