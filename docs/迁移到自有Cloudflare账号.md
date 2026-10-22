# 迁移到自有 Cloudflare 账号（摆脱 Sites 地域限制）

> 背景：2026-10-22 诊断确认，OpenAI Sites 托管会在 Cloudflare 边缘按地域拒绝中国大陆 IP（HTTP 403 WAF 拦截页），
> 而 Cloudflare 网络本身在国内可达（TCP 443 正常、www.cloudflare.com 可达）。因此把同一个 Worker 应用部署到**自己的 Cloudflare 账号**，
> 即可绕开 OpenAI 那条 WAF 规则。
>
> 诊断证据：代理关闭时 `curl https://www.jxlq.top` → `http_code=403 remote_ip=104.18.22.186`，返回 Cloudflare 拦截页；
> 开代理（海外出口）→ 200 OK。唯一变量是出口 IP 国家。

## 0. 前置说明（先看，避免白做）

- **旧站数据无法导出**：Sites 托管在 OpenAI 的 Cloudflare 账号里，你没有该账号权限，D1/R2 数据拿不出来。新站需要重新导入内容（战术是代码内置的，不受影响）。
- **GitHub 仓库与托管无关**：迁移只影响部署位置，代码仍在 `Gin-zeng/-BK-Team-web`。
- **管理员初始化不需要 ChatGPT 身份**：新账号下用「邮箱验证码登录」，首个验证成功的邮箱自动成为管理员（`auth_bootstrap` 单例主键保证）。
- **jxlq.top 的 NS 要迁到 Cloudflare**：否则自定义域名无法绑定。阿里云侧原有记录届时失效，以 Cloudflare 为准。

## 1. 把域名接入 Cloudflare

1. 登录 https://dash.cloudflare.com → **Add a site** → 输入 `jxlq.top` → 选 **Free** 计划；
2. Cloudflare 给出两个 NS（形如 `xxx.ns.cloudflare.com`），复制；
3. 阿里云 → 域名列表 → `jxlq.top` → 管理 → **DNS 修改** → 改成这两个 NS → 确认；
4. 回 Cloudflare 等待状态变 **Active**（几分钟到几小时，取决于 NS 生效速度）；
5. NS 生效后，Cloudflare 会导入原有记录。**删掉**下面两条已无用的记录（它们指向 Sites）：
   - `www` → CNAME `custom-domains.chatgpt.site`
   - `_openai-site-verification.www` / `_cf-custom-hostname.www` 两条 TXT 可一并删除

> 不必手工新建 `www` 记录，第 4 步部署时 `custom_domain: true` 会自动创建。

## 2. 登录 wrangler 并创建资源

在**自己机器的 PowerShell** 里执行（需要浏览器完成 OAuth）：

```powershell
cd E:\篮球战术动画讲解平台\mech-hoops
npx wrangler login
npx wrangler d1 create mech-hoops-db
npx wrangler r2 bucket create mech-hoops-media
```

`d1 create` 会输出一段带 `database_id` 的配置，**把那个 id 填进 `wrangler.deploy.jsonc` 的 `REPLACE_WITH_YOUR_D1_DATABASE_ID`**。

## 3. 建表（两个迁移都要跑）

```powershell
npx wrangler d1 execute mech-hoops-db --remote --file drizzle/0000_dazzling_whistler.sql
npx wrangler d1 execute mech-hoops-db --remote --file drizzle/0001_outgoing_micromacro.sql
```

校验：`npx wrangler d1 execute mech-hoops-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`
应看到 9 张表：records / imports / admins / uploads / email_users / email_sessions / email_codes / auth_bootstrap / auth_limits。

## 4. 构建并部署

```powershell
npm run build
npx wrangler deploy --config wrangler.deploy.jsonc
```

> 若第 1 步域名还是 Pending，部署会因 `routes` 失败——此时先把 `routes` 一行注释掉部署，等域名 Active 后在 Cloudflare 控制台
> 「Workers & Pages → mechanical-basketball → Settings → Domains & Routes」里添加 `www.jxlq.top`。

## 5. 配置密钥（4 个）

```powershell
npx wrangler secret put RESEND_API_KEY    --config wrangler.deploy.jsonc
npx wrangler secret put EMAIL_FROM        --config wrangler.deploy.jsonc
npx wrangler secret put EMAIL_AUTH_SECRET --config wrangler.deploy.jsonc
npx wrangler secret put ADMIN_SETUP_TOKEN --config wrangler.deploy.jsonc
```

- `EMAIL_FROM` 必须是 **Resend 已验证发信域名**下的地址，例如 `机械篮球战术室 <login@你的已验证域名>`；
- `EMAIL_AUTH_SECRET` 至少 32 位随机串；
- 四个值沿用你在 Sites 后台已经配好的那套即可（邮箱登录已跑通）。

## 6. 验证

```powershell
curl.exe -I https://www.jxlq.top
(Invoke-WebRequest https://www.jxlq.top -UseBasicParsing).StatusCode
```

期望 `HTTP/1.1 200`。**关掉代理、用手机流量再测一次**，这是本次迁移的唯一目的。

## 7. 初始化管理员

1. 打开 `https://www.jxlq.top/#admin`；
2. 走「邮箱验证码登录」，输入你的邮箱 → 收码 → 登录；
3. **首个验证成功的邮箱自动成为管理员**，无需初始化口令；
4. 若之前 Sites 后台有内容需要重建：进入「导入数据」重新导入 Excel/CSV，再分别发布比赛与球员。

## 8. 回滚

原 Sites 部署不受影响（`.openai/hosting.json` 与 `chatgpt.site` 地址仍在），只是国内直连会被 403 拦截。
如需回滚，把 `www.jxlq.top` 的 NS 从 Cloudflare 改回阿里云，并恢复原来的 CNAME 记录即可。

## 9. 预期与限制

- 国内**可达性**：Cloudflare 免费节点通常可连，但速度一般（常见 200–800ms），高峰期偶有波动；
- 想要「稳定 + 快」，最终仍需 **ICP 备案 + 国内托管**（届时数据层要从 D1/R2 换成可移植存储）；
- `workers.dev` 默认域名在国内被封，**只能用自定义域名**访问，别把 workers.dev 地址发给队员。