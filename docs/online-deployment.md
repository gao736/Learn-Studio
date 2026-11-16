# 长期在线面试版本：部署接续

2026-11-16：用户选择长期在线，已有Render账号但尚未连接，GitHub私有目标仓库已由用户创建并通过截图指定为 https://github.com/gao736/Learn-Studio 。尚无已部署网址，不把候选域名写成可用网址。

## 已准备

- 保留原本机MVP、原数据库及.env.local；本机网页/数据库停止导致连接拒绝，已启动原数据目录和网页，没有初始化或重置数据。
- Node版本固定为已测试的24.16.0；线上使用 `pnpm run start:hosted`，绑定0.0.0.0并读取平台PORT；本机 `pnpm start` 继续仅监听127.0.0.1。
- 认证优先用显式BETTER_AUTH_URL；没有该设置时可用Render提供的RENDER_EXTERNAL_URL，防止验证链接回到localhost。
- 准备推送私有gao736/Learn-Studio仓库；只推送源代码与必要提交历史，不上传.env.local、.runtime、备份、邮件、账号或个人作答。最终结果以实际推送记录为准。

## 线上资源

使用完整Node网页服务、一个常驻worker和独立PostgreSQL。线上数据库新建，不直接上传原学习数据库。三个服务同区域。数据库应用连接必须是非superuser、非BYPASSRLS角色；AI核对继续使用独立受限角色，不能将管理员连接作为应用连接。

本机初始化脚本固定便携PostgreSQL路径，不能直接用于云平台。拿到Render连接后，先检查托管数据库角色权限，再初始化学习应用角色和受限AI角色、运行已有001—009增量迁移，验证两名测试用户隔离。尚未获得云数据库凭据，不能将这一步标为完成。

### Web

- 运行环境Node，版本24.16.0。
- 构建：`pnpm install --frozen-lockfile && pnpm build`（确保平台pnpm与现有11.19.0一致）。
- 启动：`pnpm run start:hosted`。
- 健康路径：`/login`。
- `LOCAL_MAILBOX=false`，HTTPS正式地址由RENDER_EXTERNAL_URL或显式BETTER_AUTH_URL提供。
- 仅在平台秘密配置中放入DATABASE_URL、BETTER_AUTH_SECRET、SMTP_USER、SMTP_PASSWORD、SMTP_FROM和模型API密钥；不进入GitHub。
- 沿用smtp.qq.com:465、TLS；沿用官方硅基流动API和当前Qwen模型限制。

### Worker

- 使用相同源码和Node24.16.0；安装锁定依赖。
- 启动：`node scripts/worker.ts`，不带本机.env.local参数。
- 配置非管理员DATABASE_URL、独立ASSESSMENT_WORKER_DATABASE_URL及相同模型配置/预算。
- 不分配公开域名，不复制SMTP密码或账户认证密钥。启动前核对持久化任务授权；费用预占、次数、超时与幂等规则保留。

## 云端验证和网址

1. Render账号连接，确认实际工作区、地区与付费方案。付费资源开通前核对控制台总价和授权；不把免费实例当长期可用服务。
2. 创建GitHub私有仓库、核对源代码/提交历史不含敏感材料，再推送实际分支。
3. 初始化独立云数据库与受限角色；执行迁移，验证真实权限、来源引用与持久化。
4. 部署Web与worker，把认证回调指向平台实际分配的HTTPS地址；核对SMTP和模型网络连接。
5. 用独立测试账户验证注册/验证、课程、保存、刷新重登、复习及周测。登录和成绩不能靠修改验证状态绕过。
6. 在不带本机Cookie的浏览器打开线上网址，确认能够访问且不泄露其他人的资料，才把平台返回的实际地址交给面试官。

## 当前条件

Render连接尚待确认；GitHub目标已配置为gao736/Learn-Studio，推送结果待远程验证。实际付费部署尚未执行。数据迁移、云环境真实运行和跨电脑访问仍待验收。当前localhost只是本机恢复地址，不是面试官可访问的地址。

官方参考：
- https://render.com/docs/deploy-nextjs-app
- https://render.com/docs/node-version
- https://render.com/docs/free
- https://render.com/pricing

## 2026-11-16 最新接续：预算改为零

- GitHub已推送并核对：gao736/Learn-Studio 的 main 与本地77cbe04一致，工作区干净；目标仓库保持私有。
- 用户确认Render账号连接，提供了已登录控制台截图。不再重复要求账号注册或邮箱验证。
- 当前会话未暴露Render操作工具；按官方技能改用Render CLI。官方v2.36.0 Windows AMD64下载包SHA256已与GitHub官方发布摘要核对，工具仅在忽略的.runtime中。CLI登录授权尚未完成；用户提出不付费后已取消等待登录的进程，没有创建云资源。
- 新约束：不付费。此前的三项付费资源方案停止，不创建付费Web/worker/Postgres，也未产生此类费用。
- 已解释两个免费方向，等待选择：独立静态演示版（预置课程、核心交互、无真实AI后台）或尝试保留完整版的免费额度部署（需要适配并接受限制）。不得在未获选择前把完整产品静默替换为演示版。
- 原本机完整版、账户、课程、作答、复习排期和已有Git历史均保留。目前没有已部署的面试网址。

## 2026-11-16 面试源码公开交付

- GitHub源代码与面试README已推送到main，用户明确授权将仓库改为Public。实际地址：https://github.com/gao736/Learn-Studio 。
- 官方GitHub API确认visibility=public；无凭据请求仓库元数据和README均为HTTP200，面试概览存在。面试官可直接查看源码；尚无在线应用体验地址。
- 本机密钥、运行目录、数据库、备份、账号与个人作答未加入Git。原MVP与数据保留，本轮不改业务行为。
- 免费完整版部署继续待办：选择长期免费数据库并验证受限角色/迁移、替换受阻SMTP、适配后台任务、注入秘密并执行云端功能及跨电脑验收。预算仍为零，不恢复创建付费资源；此前免费演示版与完整版的范围选择仍不能由源码公开替代。
