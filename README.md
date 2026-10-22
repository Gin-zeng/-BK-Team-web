# 机械学院 · 篮球战术室

联网的篮球战术教学和赛后数据分析网站。React / Vinext / Cloudflare D1 / R2。

## 使用

公开区：球队总览、11套二维战术、比赛分析、球队阵容、对手档案、录像中心。管理员发布后普通用户即可浏览。初次上线没有真实比赛与球员数据；战术为明确标注的教学示意。

管理员入口：网站左下角。使用ChatGPT身份登录后，首次填写管理员初始化口令。口令存放于本机未跟踪文件 `.dev.vars` 的 `ADMIN_SETUP_TOKEN`，同时配置于托管运行环境。只有首次初始化可使用口令，后续服务端按管理员ID校验。不能将此文件提交或上传。线上数据库与本地数据库独立，首次各初始化一次。

## 本地启动（PowerShell）

需要 Node.js >=22.13、Git；依赖已安装时可跳过第一步。

```powershell
npm run install:ci
node scripts/init-local-admin.mjs
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_dazzling_whistler.sql
npm run dev
```

数据库迁移仅首次执行，不能重复回放。已有本地数据库请跳过建表迁移。开发默认地址 http://127.0.0.1:5173/ 。此Windows主机全局npm命令入口异常时，可使用 `node E:/node_modules/npm/bin/npm-cli.js run dev`；或直接运行 `node scripts/run-framework.mjs dev --hostname 127.0.0.1 --port 5173`。

本地模拟身份只用于开发：访问 `/signin-with-chatgpt?return_to=/%23admin`。托管环境由平台提供真实身份，客户端不能自行指定管理员。

## 导入数据

1. 管理后台 → 导入数据，选择xlsx或UTF-8 CSV（最大10MB）。
2. 空工作表自动跳过；选择非空表，映射字段。
3. 投篮、三分、罚球均按“出手/命中”解释，兼容反斜线。投篮包含三分，不含罚球。
4. 校验异常、填写差异处理说明、匹配球员ID、确认出场状态。
5. 补充比赛标题、日期、赛季、对手及已知比分。不得从文件名推断年份。
6. 保存草稿，然后在内容管理分别发布比赛与球员档案。
7. 导入历史可撤销批次，移除对应比赛，保留批次记录和球员档案。

样例表的预期结果：11名球员、38分；助攻明细9而原总计10；罚球出手明细11而原总计10。系统保留原表总计，不静默覆盖。

数据缺失显示“—”；零出手显示“无出手”；全0记录的出场状态默认未知。个人场均只按明确标记为已出场的样本计算。球队累计/场均按已记录明细并注明场次。命中率使用汇总命中数/汇总出手数。

## 战术管理

预置传切、持球挡拆、无球掩护、牛角顺下与外弹、三线快攻、2–3和3–2联防、人盯人、两套边线球。可播放、暂停、慢放、逐步、重播、放大，点击球员查看职责。

后台“战术”可从模板复制、绑定本队1—5号位置、修改名称和补充文字，审核后发布。自由绘制与改变动作轨迹属于第二阶段。

## 录像与图表

管理员上传MP4/WebM录像或PNG/JPEG/WebP图表，8MB分片，单文件上限5GB。浏览器先验证视频能否读取，服务端检查格式标记。推荐H.264/AAC MP4或WebM；第一阶段不做自动转码。不兼容会明确报错。失败可重新上传，未完成会话会尝试取消。

文件存放R2，数据库只保存元信息和关联。开发使用 `.wrangler/state` 持久化模拟存储，请保留该目录。生产使用托管D1/R2，不依赖服务器临时磁盘。文件访问由服务端检查发布状态，草稿文件对匿名用户返回404。支持Range请求和播放器倍速/跳转。

## 配置与发布

`.openai/hosting.json` 保存站点ID及DB/BUCKET逻辑绑定，不存放秘密。站点创建后必须复用此ID。托管环境的 `ADMIN_SETUP_TOKEN` 是秘密环境变量；修改后需重新部署。发布使用Sites技能规定的源代码同步和打包流程，数据库迁移由托管平台执行。

管理员可以在球队设置维护名称、介绍、主题色、默认每节分钟数及已发布的队徽图片。新比赛可覆盖每节时长。

## 双目标部署

同一份代码支持两个部署目标，D1/R2 绑定名一致（`DB` / `BUCKET`），业务代码无需区分：

| 目标 | 访问地址 | 部署方式 | 配置文件 |
| --- | --- | --- | --- |
| OpenAI Sites（Codex 发布） | `https://mechanical-hoops-lab.quirkyfinch.chatgpt.site` | Codex 按 Sites 流程发布 | `.openai/hosting.json` |
| 自有 Cloudflare 账号（国内直连） | `https://www.jxlq.top` | `npm run deploy:cf` | `wrangler.deploy.jsonc` |

- 两个目标各自使用独立的 D1/R2，**数据不互通**：日常内容请在 `www.jxlq.top` 维护，Sites 那条作为 Codex 的开发预览环境。
- 登录方式自适应：Sites 环境走平台身份，自有账号走邮箱验证码（`app/auth.ts` 已做双轨回退）。
- 自有账号的首次部署步骤见 [docs/迁移到自有Cloudflare账号.md](docs/迁移到自有Cloudflare账号.md)。
- 注意：`*.workers.dev` 默认域名在国内被墙，只使用 `www.jxlq.top` 访问。

## 验证

```powershell
node --test tests/domain.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node tests/workbook-browser.mjs '../26机械VS化工(2).xlsx'
node tests/application-browser.mjs http://127.0.0.1:5173
```

浏览器测试需要Playwright和Edge；本机使用已提供的运行时，其他环境可通过PLAYWRIGHT_MODULE指定模块路径。应用验收脚本只允许连接localhost，样例不会写入线上。它生成本地测试WebM以验证上传播放，结束后撤销样例导入并删除测试文件。

## 后续范围

已实现：第一阶段公开浏览、管理员权限、导入校验与撤销、基础统计、二维教学、对手人工档案、基础录像和图片。

第二阶段：视频片段标注、战术与录像联动、自由绘制、定制分析助手。当前助手端点明确返回未启用，不产生AI分析。

第三阶段：真实样本验证后的自动事件识别、追踪、可选三维教学。

当前限制：尚无用户提供的真实比赛视频，播放验收使用程序生成的测试片段；线上大文件、移动设备真实机型和不同网络条件需要投入使用后继续验收。个人场均需管理员补充出场状态；现有样例缺少上场时间、位置轨迹和逐回合数据，不提供热区、阵容效率和自动行为结论。

## 邮箱验证码登录（新增）

已支持首个验证邮箱自动获得管理员权限，保留原管理员。需要配置真实邮件服务后才能启用，详见 [邮箱登录配置](docs/邮箱登录配置.md)。未配置时保留原 ChatGPT 登录入口，绝不假装发送验证码。
