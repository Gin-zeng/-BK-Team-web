# 🏀 DHU Mech Hoops — Basketball Space

> An online basketball tactics teaching & post-game analytics platform. Turn every play into team chemistry.

[**中文**](./README.md) · [Changelog](./CHANGELOG.md) · [Live Demo](https://www.jxlq.top)

![License](https://img.shields.io/badge/license-MIT-green)
![Next.js](https://img.shields.io/badge/Next.js-16-000000)
![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers%20%2B%20D1%20%2B%20R2-f6821f)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)

---

## ✨ Features

| 🧭 Module | 📝 Description |
| --- | --- |
| 📊 Team Overview | Team info, badge, theme color and season summary |
| 📋 2D Tactics | 11 animated plays (motion, pick-and-roll, off-ball screen, horns, fast break, zone defense…), playable / pausable / slow-mo / step-through / zoomable |
| 📈 Game Analysis | Excel / CSV import & validation, shooting percentages, trend charts, per-game review |
| 👥 Roster | Player profiles (avatar, height, weight, position, hometown, handedness) + starting lineup & bench (next-game lineup, last-game lineup) |
| ⭐ 6-Dimension Ratings | Anonymous visitor scoring (scoring / shooting / rebounding / playmaking / defense / athleticism) averaged into a radar chart |
| 🤖 AI Advice | DeepSeek generates four-section advice (role / offense / defense / training focus) from data + ratings + position |
| 🎯 Opponent Profiles | Manual scouting notes + preparation advice |
| 🎬 Video Center | Bilibili streaming playback (paste a BV id / link), no cloud storage cost |
| 🖼 Team Album | Album grouping, covers, photo lightbox |
| 🌙 Dark Mode | Light / dark theme toggle, follows system, persisted locally |
| 🔐 Admin Console | Content management, data import, draft / publish, batch undo |
| ✉️ Auth | Email verification-code login + legacy ChatGPT admin identity |

## 🖼 Screenshots

| 🏠 Home | 📋 Tactics |
| --- | --- |
| ![Home](docs/screenshots/home.png) | ![Tactics](docs/screenshots/tactic.png) |

| 🖼 Album | ⭐ Player Analysis (dark) |
| --- | --- |
| ![Album](docs/screenshots/album.png) | ![Player Analysis](docs/screenshots/player.png) |

## 🛠 Tech Stack

- **Frontend**: Next.js 16 · React 19 · Vinext (RSC) · Tailwind CSS 4 · lucide-react
- **Backend**: Cloudflare Workers · D1 (SQLite) · R2 (object storage)
- **Data**: Drizzle ORM · Zod validation
- **AI**: DeepSeek (`deepseek-chat`)
- **Language**: TypeScript

## 🚀 Getting Started

> Requires Node.js ≥ 22.13.

```powershell
npm run install:ci               # install dependencies
node scripts/init-local-admin.mjs # initialize local admin
npm run db:generate              # generate DB migrations
npm run dev                      # start dev server
```

Dev server defaults to `http://127.0.0.1:5173/`. Apply the database migrations on first run — see the [deployment guide](docs/部署手册.md).

## ☁️ Deployment

Production: **https://www.jxlq.top** (Cloudflare Workers + D1 + R2).

```powershell
npm run deploy:cf                # build + guard checks + wrangler deploy
```

See the [deployment guide](docs/部署手册.md) for full steps, secrets and troubleshooting.

## 📚 Documentation

| 📄 Doc | 📝 Description |
| --- | --- |
| [Deployment Guide](docs/部署手册.md) | Production deploy, secrets, rollback, troubleshooting |
| [Product Plan](docs/产品方案.md) | Requirements, pages, data model, build order |
| [UI Style](docs/UI风格.md) | Palette, layout, visual semantics, dark theme |
| [Email Login](docs/邮箱登录配置.md) | Email verification-code login setup |
| [Acceptance Results](docs/验收结果.md) | Per-phase acceptance notes & known limits |
| [Changelog](CHANGELOG.md) | Milestones & feature progress |

## 🗺 Roadmap

- ✅ **Phase 1**: public browsing, admin auth, import validation, 2D tactics, opponent profiles, video & image upload
- ✅ **Phase 2**: dark mode, team album, 6-dimension player analysis & AI advice, starting lineup & bench, Bilibili video, hometown
- ⏳ **Planned**: video clip annotation, tactics–video linking, free-form play drawing, custom analysis assistant
- 💭 **Future**: auto event detection & tracking validated on real samples, optional 3D teaching

See the [Changelog](CHANGELOG.md) for details.

## 🤝 Contributing

This project is open source under the **MIT License**. Issues and pull requests are welcome — please read the [product plan](docs/产品方案.md) first to understand the architecture conventions.

## 🔒 Security

This repository contains **code only** — no secrets, credentials or production data:

- `.dev.vars`, `.env*`, `old-data.json`, `restore.sql` and `backup-*.sql` are all git-ignored;
- the production site's data (D1), media (R2) and deployment credentials (Cloudflare, DeepSeek, admin token) are not in this repo.

So **anyone who clones this repo only gets the code** and cannot modify the content at `www.jxlq.top`:

- deploying requires the author's Cloudflare account credentials;
- admin access is gated by email login (only the first verified email becomes admin; later accounts are read-only);
- to run your own instance, configure your own Cloudflare account and secrets (see the [deployment guide](docs/部署手册.md)).

## 📄 License

[MIT](./LICENSE) © 2026 DHU Mech Hoops
