> 2026-11-15 Learning Studio 网页 MVP：请先阅读 [使用与交付说明](docs/studio-mvp-guide.md) 和 [当前进度](docs/studio-mvp-progress.md)。以下旧模块记录保留作历史证据；支持范围以新说明为准。

# Learning Studio · 多领域学习网站

M01、M02原真实课程功能闭环已完成。M03已实现AI对照来源核对、独立诊断、补习与学习进度解锁，普通账户不能伪造AI完成凭据；2026-10-09原真实课程的20题题库经真实AI报告复核已开放，标注“AI 评估，待验证”。M03原用户诊断、补测与重登联验未完成。M04本机实现已交付，真实到期复习联验待完成；M05—M24未开始。中断后沿用现有课程、材料版本、成绩、复习排期、题库和AI调用历史，不清零或重建。

这是本机开发版。使用真实 PostgreSQL；默认邮件模式是独立本机 SMTP 收件箱，邮件**不会投递到互联网**，配置真实邮件的方法见下文。答题记录只说明这次表现，不表示已完整掌握天文学。

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

## 真实 QQ 邮件配置

2026-10-07已接通QQ真实SMTP：TLS与授权码鉴权通过，网站使用真实邮件模式；为原QQ账户发送验证邮件后，用户确认收件并打开链接，数据库确认emailVerified=true。原账户与学习记录保留，不需要重新注册。授权码仅保存在忽略的.env.local，不提交或分享。以下步骤用于新环境或更换发件账户，已配置的本机不用重复填写。

在[QQ邮箱网页版](https://wx.mail.qq.com/)登录发件账户，进入设置寻找POP3/IMAP/SMTP服务并按页面提示生成授权码。[官方帮助](https://service.mail.qq.com/detail/0/141)给出的路径是“设置—账户”，不同版本菜单可能不同。授权码由账户本人完成验证后取得，不能用QQ登录密码代替，不要发到聊天中。

在**现有**`.env.local`的`SMTP_PASSWORD=`后填写授权码并保存，保持数据库、认证与模型配置原样。只有SMTP鉴权验证通过后才切换以下字段并重新构建、启动网站；不要用空授权码启用真实模式：

```dotenv
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_FROM=Learning Studio <你的QQ邮箱地址>
SMTP_USER=你的QQ邮箱地址
SMTP_PASSWORD=你在本机保存的SMTP授权码
LOCAL_MAILBOX=false
```

真实模式不需要`mail:local`。原QQ账户在登录页输入已有凭据，再点击“重新发送验证邮件”，从同一台电脑打开邮件中的验证链接。网站仍只监听本机地址，链接不能从其他设备访问本机网站。发件服务接收邮件、邮箱实际收到邮件、点击验证并能登录需要分别确认，不能只凭接口成功宣告全部通过。

自动浏览器验收使用`@example.test`与本机邮件夹具，真实SMTP模式下拒绝启动；需要回归本机邮件流程时先启动使用本机测试配置的网站，避免向真实SMTP发送测试邮件。真实收件成功后再继续原课程的M02验收，不清空历史或绕过课程生成次数上限。

## M02 自定义课程

打开“课程” → “创建自定义课程”，输入主题、目标、天数、每日总时间和开始日期，预览范围后保存。仅输入主题时默认30天、每日30分钟；可以补充最多三个可信公开资料链接。

六类默认资料（天文学、Python、JavaScript、音乐理论、经济学、AI）已在本机实际抓取并核对正文。音乐改用[Open Music Theory 基础记谱章节](https://openmusictheory.github.io/basicNotation.html)；如果已保存的音乐草案仍使用旧链接，请在该课程的“补充或修改资料链接”入口替换链接并复用原课程，不必重新创建。网站资料读取通过不等于真实模型生成与引用质量验收通过。

多个主题共享每日总时间。已有课程先占用，新课程使用剩余时间，不够时提示调整日期或预算。首课之后的日期只显示计划骨架；已完成的客观题可进入M04复习，跨周重排仍待M05。

当前没有硅基流动密钥时，点击生成会显示原因，草案和计划仍保留。模拟课程仅由浏览器验收夹具创建，有明确标签；不存在给普通用户自动返回模拟成功的开关。

在[硅基流动控制台](https://cloud.siliconflow.cn/account/ak)创建API Key，在**现有** `.env.local` 中填写下面三项，保持数据库和认证配置原样，不把密钥发到聊天中：

```dotenv
SILICONFLOW_API_KEY=从硅基流动控制台取得的完整密钥
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=Qwen/Qwen3.5-4B
```

仅允许上述官方HTTPS地址和所选免费文本模型，不自动尝试Pro或其他付费型号。[官方价格页](https://www.siliconflow.cn/pricing)于2026-10-07实际核对输入/输出价格均为0，公开数据同时标记支持JSON。每次模型调用前无密钥读取官方价格页并再次核对；收费、下架、不支持JSON、核价失败或页面格式改变都会阻止调用。网站脚本只作JSON数据解析，不执行；数据有歧义时拒绝猜测。返回的模型ID必须一致；异常不会触发付费回退。

另开一个终端启动同一数据库的持久化任务 worker：

```powershell
pnpm run worker
```

修改环境配置后重新启动网站和 worker；回到已保存课程点击生成即可，不用重新注册或重建课程。仍保留日/月内部预算、单次安全预占0.10元、每课程最多五次尝试和限流/超时恢复；安全预占不是账户扣款。凭据齐全的免费调用按0元估算，保存服务商、模型、Token用量（含推理Token）、核价日期/摘要；实际账单需核对。超时、返回不同模型或凭据不足时费用保持未知，不冒充免费成功。旧百炼任务保留原服务商、模型、预算和估算规则，不用新配置重算历史；旧排队任务不跨服务商调用。原课程真实生成、基本引用核对、答题持久化已完成；账单0元由用户确认。M03/M04真实课程联验保持待办。

2026-10-07真实接入历史：原Xing4.0的402与超时、独立Qwen测试课程五次失败及离线格式重放记录保留。现入口为Qwen/Qwen3.5-4B，固定非思考模式；兼容逐条验证的1—4条练习列表，总长度仍不超过800字符。代理对照未消除完整请求超时，因此没有保存新的代理配置；不把单一对照结果当作确定根因。

2026-10-08原用户课程恢复：NASA资料读取遇到暂时连接失败时最多再试一次，各次仍受8秒和任务总90秒期限限制；取消、HTTP拒绝、违规来源或内容校验失败不重试。错误说明资料域名以及尚未调用模型，草案仍保留。模型请求没有自动重试，仍保留60秒期限、实时核价、预算与五次尝试上限。首课提示缩小为少量核心概念与短练习，实际最后一次请求HTTP200、45.859秒，输入2911/输出1119/思考0 Token，免费凭据齐全按0元估算；这是本次观察，用户随后核对相关请求实际费用均为0元。原课程已保存为真实内容，用户确认能打开“恒星的诞生与生命历程”。原课程五次尝试全部保留，不重置次数。随后依据原NASA来源补充正文并保存修订0/1/2；原账号作答结果及五张复习卡已持久化。M03/M04真实联验、领域专家审核和学习效果校准仍待完成。详细结果与下一位置见[交付与恢复记录](docs/handoff.md)。

如果端口 3000 / 1025 已有这个项目的服务，不必重复启动。退出网站和邮件进程使用它们终端中的 `Ctrl+C`。停止本项目数据库：

```powershell
& '.\.runtime\pgsql\bin\pg_ctl.exe' -D '.\.runtime\postgres-data' -w stop
```

## M03 诊断、补习与解锁

打开“今天” → “进入能力诊断”，选择预置天文学示例。先诊断“认识天体与光”，未达标时进入“学习与针对性补习”，再用新题补测；通过后可以阅读“理解恒星的一生”。跳级测验使用同一门槛，不能跳过前置证据。结果和会话入口保存在技能页，刷新或再次登录可继续查看。

当前估计是最近五个不同题族独立正确的比例，至少四项正确且五个题族齐全才通过；没有校准为长期掌握概率。提示与答案先保存访问记录再显示，本题不计独立证据。同题不重复签发，补测用新问题；每技能示例题库有三轮新题，耗尽后明确提示补充题库。旧M01/M02练习成绩不追认为新考核证据。必需实操未经验证时不会通过。

短答会进入人工复核，有争议的客观题也可申请。复核前暂停通过判定；原始作答、评分和复核意见保留。复核者不能处理自己的作答或批准自己的私有题库。需用另一个已注册并验证的本机账户承担复核，由本机开发者在终端显式授予权限：

```powershell
node scripts/reviewer.ts grant reviewer@example.test
```

该账户登录后从“能力诊断”进入“授权复核工作台”，核对来源和评分依据再保存决定。撤销使用`node scripts/reviewer.ts revoke reviewer@example.test`。脚本仅连接本项目的回环数据库，管理凭据不进入网站；不要把真实管理员凭据发到聊天中。

自定义真实课程生成成功后，可在课程页申请诊断题库核对。没有人工审核者时，使用用户已同意的AI对照来源核对方案，保留五个不同题族、每族至少两道新题、来源与前置校验；通过后标注“AI 评估，待验证”。原课练习不能换个选项顺序或干扰项再次作为考核。模拟课程拒绝进入正式题库。人工复核入口保留，普通学习者没有自行批准权限；争议与短答仍需复核，不能凭AI标签自动通过。

原用户真实课程的题库已开放：[进入原题库](http://127.0.0.1:3000/assessments/f01c274d-8838-4d90-8642-c6ec231048e3)。用原账户独立诊断；未通过则学习、补习并用新题考核，第一个技能通过后才开放第二个技能正文。刷新结果并退出重新登录检查记录。真实报告复核沿用已保存的20题和来源，修复HTML超链接结尾标点空白后通过，追加完成记录且保留原失败；复核没有新增模型调用。原用户实际诊断、补测、解锁和重登尚待验证，不能把题库开放写成M03整体验收完成。自动生成全新题库的真实端到端可靠性与本轮服务商账单也尚待验证。

M03最终本机检查：21/21核心检查、全部6/6生产版浏览器流程、类型与构建通过。初始题库、掌握门槛与真实学习效果尚未经过专家审核或内测校准；详细运行证据与中断后的续作位置见交付记录。

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

M04入口为 `/reviews`，也可从“今天”进入间隔复习。完成M01示例课或M03客观考核后，复习卡与原始结果在同一事务保存；旧记录在复习页展开“补入以前完成的练习”后同步，不重置已保存排期。真实课程首课的适配器已实现，真实模型联验仍待完成；模拟课程和简答题不进入自动复习。有评分争议的原题暂停自动排期，需核对答案键后再补充可用题目。

采用 [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 5.4.2（MIT、FSRS-6），目标保持率90%，关闭随机扰动。先独立选择答案和回忆难度，服务端评分：错答强制重学；答对才按费力/一般/轻松排期。完整参数、算法版本、前后记忆状态、结果与FSRS日志入库。同一排期版本重复提交只保存一次；回看结果不会重排。复习不增加M03独立考核证据。未提交输入不跨刷新保存，保存失败会保留当前输入；长期效果仍待内测。

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
node --test --test-concurrency=1 tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@playwright/test/cli.js test
node node_modules/next/dist/bin/next build
```

核心规则在服务端执行：身份检查、输入大小与字段校验、参数化 SQL、用户所有权检查、PostgreSQL 强制行级隔离、提交幂等。未提交的选项不会跨刷新保存；保存失败时保留当前页面选项供重试。

## 后续实施

交付证据、续作位置和限制见 [docs/handoff.md](docs/handoff.md)，界面约定见 [docs/design-system.md](docs/design-system.md)，模块顺序见 [docs/modules.md](docs/modules.md)，M02闭环约定见 [docs/m02-plan.md](docs/m02-plan.md)。中断后先核对记录和Git历史，从未完成检查继续，不清空学习数据或重建现有文件。

QQ互联网邮件收件与原账户验证已完成；公开部署和真实学习效果仍待验证。未来部署需配置真实 SMTP、数据库与强随机密钥，设置正确的站点地址并关闭 `LOCAL_MAILBOX`。当前本机硅基流动密钥与真实QQ邮件已经配置，不必重复填写；百炼不再是接入前置。真实课程生成可用，整体验收仍按上文待办推进。M05未开始。核心检查串行运行，因为失败恢复验收会临时调整本机数据库权限；全部恢复操作在finally中执行。
