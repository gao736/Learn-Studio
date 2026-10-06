# Learning Studio · 多领域学习网站

当前实施范围是 **M01：账户、邮箱验证、天文学示例课堂、独立答题、保存结果与再次登录**。自定义主题、AI 专题、自适应课程与实验等 M02—M24 尚未开放。此目录是独立的 Next.js / TypeScript 项目；没有修改工作区中的其他作品。

这是本机开发版。使用真实 PostgreSQL 和独立本机 SMTP 收件箱，邮件**不会投递到互联网**。答题记录只说明这次表现，不表示已完整掌握天文学。

## 打开已有本机环境

在 PowerShell 中进入项目：

```powershell
cd 'C:\Users\gaofe\Documents\New project\learning-platform'
pnpm install --frozen-lockfile
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
pnpm run db:migrate
```

`setup-local.ps1` 只初始化或启动项目内的数据库，不安装系统服务。现有便携数据库文件已经准备好；迁移可重复运行。

保持一个终端运行本机收件箱：

```powershell
pnpm run mail:local
```

另开一个终端，在同一目录运行网站：

```powershell
pnpm dev
```

访问 <http://127.0.0.1:3000>。注册时使用如 `yourname@example.test` 的测试邮箱，密码至少 12 个字符。再开一个终端读取该邮箱最新的验证或密码重置邮件：

```powershell
node scripts/read-mail.ts yourname@example.test
```

把终端显示的链接打开，即可验证邮箱并开始课程。验证链接一小时内有效；未验证时，可在登录页重新发送验证邮件。链接包含账户凭证，请勿公开。`.env.local`、数据库和邮件文件均已被 Git 忽略。

如果端口 3000 / 1025 已有这个项目的服务，不必重复启动。退出网站和邮件进程使用它们终端中的 `Ctrl+C`。停止本项目数据库：

```powershell
& '.\.runtime\pgsql\bin\pg_ctl.exe' -D '.\.runtime\postgres-data' -w stop
```

## 新电脑准备 PostgreSQL

需要 Node.js 24、pnpm 和 Microsoft Edge（浏览器验收使用 Edge）。本次依赖锁定在 `pnpm-lock.yaml`。

首次使用时，将 [EDB 官方 PostgreSQL 17.11 Windows x64 便携包](https://get.enterprisedb.com/postgresql/postgresql-17.11-1-windows-x64-binaries.zip) 下载到 `.runtime/postgresql-17.11.zip`，校验 SHA256 为 `6EABDF00D2893713B75DB4336A23C3FDF505F056E217EC6E2E95D901750CFEA3`，再解压，使 `.runtime/pgsql/bin/pg_ctl.exe` 存在：

```powershell
New-Item -ItemType Directory -Path .runtime -Force | Out-Null
Invoke-WebRequest 'https://get.enterprisedb.com/postgresql/postgresql-17.11-1-windows-x64-binaries.zip' -OutFile .runtime/postgresql-17.11.zip
$archiveHash = (Get-FileHash .runtime/postgresql-17.11.zip -Algorithm SHA256).Hash
if ($archiveHash -ne '6EABDF00D2893713B75DB4336A23C3FDF505F056E217EC6E2E95D901750CFEA3') { throw '下载校验失败，停止解压。' }
Expand-Archive -LiteralPath .runtime/postgresql-17.11.zip -DestinationPath .runtime
```

然后执行前面的 `setup-local.ps1`、迁移和启动步骤。本机数据库仅监听 `127.0.0.1:54329`；应用使用非超级用户 `learning_app`。

## 实际验收

先启动数据库、邮件和网站，再运行：

```powershell
pnpm test
pnpm run typecheck
pnpm run test:e2e
pnpm run build
```

浏览器验收包含注册、邮箱验证与重发、电脑和手机答题、结果保存、再次登录、跨用户隔离、密码找回与会话撤销。数据库失败验收会短暂撤销**本机测试数据库**的答题 INSERT 权限并在 `finally` 中恢复，请勿把这组验收指向共享或生产数据库。失败截图和 trace 可能包含测试账户信息，保存在被忽略的 `test-results`。

核心规则在服务端执行：身份检查、输入大小与字段校验、参数化 SQL、用户所有权检查、PostgreSQL 强制行级隔离、提交幂等。未提交的选项不会跨刷新保存；保存失败时保留当前页面选项供重试。

## 后续实施

交付证据和限制见 [docs/handoff.md](docs/handoff.md)，界面约定见 [docs/design-system.md](docs/design-system.md)，模块顺序见 [docs/modules.md](docs/modules.md)。用户本轮要求“先完成 M01”，所以不推进 M02。

互联网邮件、公开部署和真实学习效果均待验证。未来部署需配置真实 SMTP、数据库与强随机密钥，设置正确的站点地址并关闭 `LOCAL_MAILBOX`。M02 还需要用户开通百炼并将 API 密钥写入 `.env.local`；本轮没有模型费用或外部部署。
