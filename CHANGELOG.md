# 📋 变更日志 · Changelog

> 项目的重要里程碑与功能进展（中英双语）。
> Key milestones and feature progress (bilingual).

---

## 2026-10-23

### 🎨 观感动效打磨与截图更新 · Polish & Screenshots

- 多端触控目标优化（移动端评分按钮放大）、卡片悬停浮起与阴影、图标悬停缩放、统一缓动曲线，不改任何功能与位置。
  *Touch-target tuning, card hover lift & shadow, icon hover scale, unified easing — no functionality or layout changes.*
- README 截图更新为最新功能，并新增战术动画 GIF 演示；首页标题改为「不是一个人的比赛，而是团队的篮球 🏀」。
  *README screenshots refreshed with the latest features plus an animated tactics GIF; the home title now reads "It's not one man's game, it's team basketball 🏀".*

### 🚀 赛程训练 / 蓝白主题 / 复盘留言 · Schedule, Blue Theme, Reviews & Messages

- **赛程与日常训练**：新增「日程」类型（比赛/训练），含时间、地点、着装要求；首页新增「近期赛程」展示接下来 2 场比赛。
  *Match schedule & daily training: new "event" type (match/training) with time, location and dress code; the homepage shows the next 2 matches.*
- **蓝白新拟物主题**：新增第三套主题（蓝白主色调 + 双重阴影新拟物内凹外凸），三套主题可循环切换。
  *New blue-white neumorphism theme (3rd theme option, dual-shadow soft UI), with a three-way theme toggle.*
- **比赛队员复盘**：比赛详情访客可填写复盘（需填姓名），并新增球员「队员有话」留言板。
  *Match reviews (visitor, name required) and a player "messages" board on the player detail page.*

### ⚡ 性能优化与代码质量 · Performance & Code Quality

- **性能**：图片懒加载、`Admin`/`PlayerAnalysis` 组件按需加载（代码分割）、公开接口加缓存头（store 60s / ratings·advice 30s / media 1h）。
  *Performance: image lazy-loading, on-demand `Admin`/`PlayerAnalysis` (code splitting), public API cache headers (store 60s / ratings·advice 30s / media 1h).*
- **错误处理**：修正媒体接口错误状态码、区分校验错误(400)与服务器错误(500)、跨站写入返回 403。
  *Error handling: fixed media status codes, split validation (400) vs server (500) errors, cross-origin writes return 403.*
- **重构与清理**：`page.tsx` 辅助组件抽取到 `view-components.tsx`；删除未引用的 connector 死代码。
  *Refactor & cleanup: extracted `page.tsx` helpers into `view-components.tsx`; removed unused connector dead code.*

### 🏀 首发/替补阵容与 B站视频 · Lineup & Bilibili Videos

- **首发/替补阵容**：球队可安排下一场首发 5 人、比赛记录该场首发；阵容页展示首发（横向滚动动画）、替补席与上一场首发。
  *Starting lineup & bench: arrange the next game's starting five, record each game's lineup; the roster page shows starters (marquee animation), the bench and the last game's lineup.*
- **球员籍贯**：档案新增籍贯字段；并加入篮球图标、背景水印等 UI 篮球元素。
  *Added a hometown field to player profiles, plus basketball-themed UI elements (icon, background watermark).*
- **B站视频播放**：录像中心改用 B站 iframe 播放（粘贴 BV 号 / 链接），不再上传视频到 R2，节省云端存储。
  *Video center now embeds Bilibili streams (paste a BV id / link) instead of uploading to R2, saving cloud storage.*

### ✨ 球员六维分析与 AI 打法建议 · Player Analysis & AI Advice

- **六维能力评分**：得分 / 投射 / 篮板 / 组织 / 防守 / 体能，访客匿名打分（1–5），取平均生成手绘 SVG 六方图（雷达图）。
  *6-dimension ratings (scoring / shooting / rebounding / playmaking / defense / athleticism), anonymous visitor scoring (1–5), averaged into a hand-drawn SVG radar chart.*
- **AI 打法建议**：接入 DeepSeek，按「比赛数据 + 六维评分 + 位置」生成四段式建议（角色定位 / 进攻 / 防守 / 训练重点），指纹缓存防重复计费；数据缺失两项以上时提示补充。
  *DeepSeek-powered play-style advice generated from game stats + ratings + position in a four-section format (role / offense / defense / training focus), cached by fingerprint; blocked with a reminder when 2+ data items are missing.*
- **球员个人信息**：新增头像、身高、体重、生日、惯用手。
  *Player profiles now include avatar, height, weight, birthday and handedness.*

### 🌙 深色模式与球队相册 · Dark Mode & Team Album

- **完整深色模式**：浅 / 深主题一键切换，默认跟随系统，选择本地记忆；全部颜色经语义 token 统一管理，球场 SVG 一并换色。
  *Full dark mode with light/dark toggle, follows the system by default and persists locally; all colors managed through semantic tokens, including the court SVG.*
- **球队相册**：管理员新建相册、上传图片并归类、发布后公开浏览，支持照片放大。
  *Team photo album: admins create albums, upload & group photos, publish for public browsing with a lightbox.*
- **UI 微交互**：卡片悬停浮起、视图入场淡入、主题平滑过渡、按钮按压反馈。
  *UI micro-interactions: card hover lift, view fade-in, smooth theme transition, button press feedback.*

---

## 2026-10-22

### 🚀 生产部署 · Production Deployment

- 确立 `https://www.jxlq.top` 为唯一生产站（自有 Cloudflare 账号：Workers + D1 + R2），国内直连可用。
  *Established `https://www.jxlq.top` as the sole production site (own Cloudflare account: Workers + D1 + R2), accessible from mainland China.*
- 新增 `npm run deploy:cf` 一键部署（构建 + 守卫检查 + wrangler deploy）。
  *Added one-command deploy `npm run deploy:cf` (build + guard checks + wrangler deploy).*

### ✉️ 邮箱验证码登录 · Email Verification Login

- 支持邮箱验证码登录，首个验证邮箱自动成为管理员，保留原 ChatGPT 管理员身份。
  *Email verification-code login; the first verified email becomes the admin automatically, while the original ChatGPT admin identity is preserved.*

### 🏀 第一阶段 · Phase 1

- 匿名公开浏览（球队总览 / 11 套二维战术 / 比赛分析 / 球队阵容 / 对手档案 / 录像中心）。
  *Anonymous public browsing (team overview / 11 two-dimensional tactics / game analysis / roster / opponent profiles / video center).*
- 管理员后台：Excel / CSV 数据导入与校验、草稿 / 发布、批次撤销。
  *Admin console: Excel / CSV import & validation, draft / publish, batch undo.*
- 分片上传录像与图片至 R2，支持 Range 播放、草稿对匿名返回 404。
  *Chunked video & image upload to R2, Range playback, drafts return 404 to anonymous users.*
