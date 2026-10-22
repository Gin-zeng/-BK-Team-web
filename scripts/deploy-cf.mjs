// 自有 Cloudflare 账号的部署守卫与执行器。
// 用法：npm run deploy:cf（先构建，再跑本脚本）
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const raw = readFileSync(new URL("../wrangler.deploy.jsonc", import.meta.url), "utf8");
// 去除 JSONC 注释（仅行注释与块注释，本文件不含字符串内 //）
const json = raw.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const cfg = JSON.parse(json);

const db = cfg.d1_databases?.[0];
if (!db || !db.database_id || db.database_id === "REPLACE_WITH_YOUR_D1_DATABASE_ID") {
  console.error("❌ wrangler.deploy.jsonc 的 database_id 仍是占位符。请先执行 npx wrangler d1 create mech-hoops-db，把输出的 database_id 填进去。");
  process.exit(1);
}

if (!existsSync(new URL("../dist/server/index.js", import.meta.url))) {
  console.error("❌ 缺少 dist/server/index.js。请先执行 npm run build。");
  process.exit(1);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npx, ["wrangler", "deploy", "--config", "wrangler.deploy.jsonc"], {
  stdio: "inherit",
  cwd: root,
});
process.exit(result.status ?? 1);
