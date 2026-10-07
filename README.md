# Learning Studio · 多领域学习网站

**M01 本机闭环已交付；M02 自定义课程的代码已实现，真实百炼验收待完成。** 可以创建主题、确认范围并保存月周日计划；接通真实服务后可生成第一课、答题并保存反馈。自适应诊断、自动复习和实操实验等 M03—M24 尚未开始。此目录是独立的 Next.js / TypeScript 项目，原有成果和记录保留。

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

## M02 自定义课程

打开“课程” → “创建自定义课程”，输入主题、目标、天数、每日总时间和开始日期，预览范围后保存。仅输入主题时默认30天、每日30分钟；可以补充最多三个可信公开资料链接。

多个主题共享每日总时间。已有课程先占用，新课程使用剩余时间，不够时提示调整日期或预算。首课之后的日期只显示计划骨架；复习栏是时间预留，尚未接入自动复习。

当前没有百炼配置时，点击生成会显示原因，草案和计划仍保留。模拟课程仅由浏览器验收夹具创建，有明确标签；不存在给普通用户自动返回模拟成功的开关。

以后开通百炼后，在**现有** `.env.local` 中增补这些字段，保持数据库和认证配置原样，不把密钥发到聊天中：

```dotenv
DASHSCOPE_API_KEY=从百炼控制台取得的密钥
DASHSCOPE_BASE_URL=https://你的业务空间ID.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
```

地址应使用控制台对应北京地域的真实业务空间 API Host，不照抄占位文字。旧版北京地址 `https://dashscope.aliyuncs.com/compatible-mode/v1` 也在服务器白名单中；实际可用性需要用你的账号验证。

另开一个终端启动同一数据库的持久化任务 worker：

```powershell
pnpm run worker
```

修改环境配置后重新启动网站和 worker；回到已保存课程点击生成即可，不用重新注册或重建课程。初始模型月预算350元、日上限10元、单次预占0.10元、每课程最多五次尝试。用量按北京原价保守估算并向上取整到分，实际以百炼账单为准；超时等未知费用保留预占待核对。准备好配置后仍需完成真实模型、引用和账单验收，才能把M02标记完成。

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

M02额外验收包含范围确认、跨月计划保存、配置缺失反馈、显式模拟课程的手机首课与答题；Node检查覆盖真实PostgreSQL/pg-boss的并发、预算、入队回滚、第五次过期恢复和不覆盖新结果。模型HTTP与资料响应的边界测试使用模拟响应，不算真实云端验收。

若Codex受限环境中的pnpm依赖检查提示非TTY错误，以下是同一套检查的直接Node入口，无需删除现有依赖：

```powershell
node --test tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@playwright/test/cli.js test
node node_modules/next/dist/bin/next build
```

核心规则在服务端执行：身份检查、输入大小与字段校验、参数化 SQL、用户所有权检查、PostgreSQL 强制行级隔离、提交幂等。未提交的选项不会跨刷新保存；保存失败时保留当前页面选项供重试。

## 后续实施

交付证据、续作位置和限制见 [docs/handoff.md](docs/handoff.md)，界面约定见 [docs/design-system.md](docs/design-system.md)，模块顺序见 [docs/modules.md](docs/modules.md)，M02闭环约定见 [docs/m02-plan.md](docs/m02-plan.md)。中断后先核对记录和Git历史，从未完成检查继续，不清空学习数据或重建现有文件。

互联网邮件、公开部署和真实学习效果均待验证。未来部署需配置真实 SMTP、数据库与强随机密钥，设置正确的站点地址并关闭 `LOCAL_MAILBOX`。M02真实验收仍需要用户开通百炼；本轮未调用外部模型，没有外部部署，M03不推进。
