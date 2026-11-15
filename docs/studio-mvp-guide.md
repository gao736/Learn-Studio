# Learning Studio 网页 MVP 使用与交付

当前开发目录：`C:/Users/gaofe/.codex/worktrees/learning-studio-mvp/learning-platform`。原始源码和原数据库仍在 `C:/Users/gaofe/Documents/New project/learning-platform`。本版保留原Qwen接入与历史记录，与Learn Anything桌面版分别维护。

## 交付范围

- 原邮箱账户、验证、密码重置、课堂答题与结果保存。
- 自定义主题、目标、天数、每日时间，保存月／周／日骨架并通过原受控网关生成首课；失败可查看与恢复，已有生成次数和费用历史保留。
- 一条预置天文学小课程：入门练习、认识天体与光、恒星演化，共三节。后两节以独立考核证据解锁；提示、已见题、复核和实操要求继续约束通过。
- 已核对的私有课程可复用其技能课建立连续计划。其他主题先提供首课，后续技能课需要现有题库核对流程，不能视为已完整生成。
- FSRS客观题复习、周测、逐题解释、薄弱技能补习建议、确认调整与历史版本、恢复未开始安排。
- Today显示最近更新的学习计划、下一项任务、到期复习、最近课堂反馈和正在进行的周测。

这是本机可用的MVP。代码沙箱、文件知识库、RAG/Agent/LangGraph实操、语音、运动视频和游戏分析尚未交付。课程中的自主练习不等于技术实操已验证；不承诺短期完全掌握，不提供能力认证。

## 从现有账号继续

1. 打开 `http://127.0.0.1:3000/today`，用原账号登录；无需重新注册或重做已验收首课。
2. 课程 → 开始天文学连续学习 → 确认日期并保存。已有计划会直接打开。
3. 在计划目录进入当前课；后续技能以正式独立考核为准，失败时阅读补习并申请新题。已完成记录自动读取。
4. 复习 → 到期任务 → 先回忆、再核对；保存反馈和下次时间。
5. 计划第七天起：周测 → 对应计划 → 开始或继续本周测验。只抽取已通过技能的五个未见题族，30分钟内提交。
6. 周测结果会逐题解释。先查看日期、原安排、补习内容和分钟数，再点击“确认调整后续安排”；刷新后确认回执保留。
7. 需恢复学习时，在计划填写恢复日期并确认；旧版本可逐日阅读。已开始任务、已完成学习、成绩和FSRS日期保留，时间冲突时停止保存。

周测与正式技能掌握分别记录。题库容量有限，耗尽时会明确提示并保留当前计划；需补充核对后的新题，不能反复用旧题刷通过。新建计划不会立即开放第七天测验，自动测试使用独立夹具验证这一流程。

## 本机启动与状态检查

以下命令在开发目录执行，使用已有Node与锁定依赖。不要重跑初始化、覆盖 `.env.local` 或删除 `.runtime`。当前本机便携PostgreSQL在原项目 `.runtime/pgsql/bin`，数据也在原项目 `.runtime/postgres-data`，地址 `127.0.0.1:54329`。

```powershell
Set-Location 'C:\Users\gaofe\.codex\worktrees\learning-studio-mvp\learning-platform'
node --env-file=.env.local scripts/mvp-status.ts
```

若原数据库已停止，可在单独终端启动原数据目录（此命令保持运行；不要在网页重启时关闭该终端）：

```powershell
& 'C:\Users\gaofe\Documents\New project\learning-platform\.runtime\pgsql\bin\postgres.exe' -D 'C:\Users\gaofe\Documents\New project\learning-platform\.runtime\postgres-data' -h 127.0.0.1 -p 54329
```

启动网页和后台任务，分别保留终端：

```powershell
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000
```

```powershell
node --env-file=.env.local scripts/mvp-status.ts --assert-idle
# 若已有任务，先核对持久化任务及授权；不要清空任务表来绕过。
node --env-file=.env.local scripts/worker.ts
```

源代码变更后先停止网页，再 `pnpm build`，成功后重新启动；数据库不必重启。不要同时让两个网页服务争用3000端口或运行两个副本修改同一数据库。开发可用 `pnpm dev`。保留Webpack开关，因为此本机的依赖目录复用junction不兼容Turbopack。

## 配置与费用

- `.env.local` 是本机密钥文件，不提交Git，不发到聊天中，不放到前端变量。
- 邮件沿用原QQ SMTP：真实模式 `LOCAL_MAILBOX=false`；SMTP授权码由本人配置。`mvp-status.ts`只显示配置是否存在，不打印凭据，也不发送邮件。
- 模型沿用 `SILICONFLOW_MODEL=Qwen/Qwen3.5-4B` 与已配置密钥。网关每次调用前核价，仅允许符合原免费策略的模型，不自动切换付费型号。实际价格和账单以当次验证为准。
- 默认模型月上限35000分、日上限1000分；同时保留每人次数、超时、费用预占和结算。超时无法确认的历史预占不会在本次清零。基础设施成本不包含在模型预算里。
- AI核对后台使用已有独立 `ASSESSMENT_WORKER_DATABASE_URL`；应用角色不能伪造批准凭据。
- 新环境先使用锁定依赖和已有角色配置再运行增量迁移；不要把本机的测试收件箱、管理员数据库连接或SQL备份公开。

## 自动验收与真实服务分开

自动浏览器测试只允许本机测试邮件，真实SMTP模式会拒绝运行夹具。不要在真实服务进程中运行浏览器测试。测试使用独立账户，不替本人答题、不更改个人掌握状态。

单独的测试网页进程需要覆盖 `LOCAL_MAILBOX=true`、`SMTP_HOST=127.0.0.1`、`SMTP_PORT=1025`、`SMTP_SECURE=false`、清空SMTP用户/密码及 `SILICONFLOW_API_KEY`，并运行本机收件箱。完成后退出测试进程，使用原 `.env.local` 启动真实模式。

```powershell
pnpm test
pnpm run typecheck
pnpm build
# 仅在确认测试网页使用本机邮件后：
pnpm run test:e2e
```

用户已有M02真实生成、0元账单确认与首课保存验收保留。原用户的M03诊断、补习补测、解锁后重登和实际到期复习应继续实际观察；不能把夹具成功记为本人完成。自动生成新题库的真实可靠性、本轮新调用账单及长期效果仍需后续验证。本次MVP开发没有新增真实模型调用或测试互联网邮件。

## 备份和安全恢复演练

现有迁移前备份 `.runtime/before-studio-mvp.dump` 保留。新增演练脚本仅接受现有本机数据库，不接受目标库参数；使用一致快照导出，恢复至随机新建的演练数据库，核对20类记录（含账户、费用与历史）、RLS及用户隔离，随后仅删除该随机演练库。原库不覆盖。备份包含私有资料，文件保持本机、忽略Git，并另做受控离线保存。

```powershell
$env:PG_BIN='C:\Users\gaofe\Documents\New project\learning-platform\.runtime\pgsql\bin'
node --env-file=.env.local scripts/verify-backup.ts
```

输出备份文件位置和核对结果，不输出密码或作答。失败时备份保留，停止后续发布并排查。正式恢复应先恢复至新库、核对身份隔离与记录、停止网页和worker，再审阅切换配置；不对现有数据库运行 `pg_restore --clean`。

## 公开发布前的剩余条件

本次未发布到互联网。若后续公开内测，还需实际提供域名和HTTPS、持续运行的PostgreSQL/worker、正式SMTP、秘密注入、预算告警、离线备份、适用隐私与删除政策，以及真实参与者的独立后测和7/30天复测。现有本机状态检查和恢复演练不能代替这些外部验收。

连续计划与周测是本轮最小版本的M05能力，不能将原M05—M24整体标为完成。实时进度以 `docs/studio-mvp-progress.md` 为准，旧handoff中的早期记录仅作历史证据。
