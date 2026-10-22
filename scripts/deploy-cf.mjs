// 自有 Cloudflare 账号的部署守卫与执行器。
// 用法：npm run deploy:cf（先构建，再跑本脚本）
//
// 注意：Windows + Node 22/24 禁止直接 spawn .cmd 文件（npx.cmd），
// 因此这里用 process.execPath 直接调用 wrangler 的 JS 入口，与 npm start 的做法一致。
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const configPath = "wrangler.deploy.jsonc";

const raw = readFileSync(new URL("../" + configPath, import.meta.url), "utf8");
const json = raw.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const cfg = JSON.parse(json);

const db = cfg.d1_databases?.[0];
if (!db || !db.database_id || db.database_id === "REPLACE_WITH_YOUR_D1_DATABASE_ID") {
  console.error("❌ " + configPath + " 的 database_id 仍是占位符。请先执行 npx wrangler d1 create mech-hoops-db，把输出的 database_id 填进去。");
  process.exit(1);
}

if (!existsSync(new URL("../dist/server/index.js", import.meta.url))) {
  console.error("❌ 缺少 dist/server/index.js。请先执行 npm run build。");
  process.exit(1);
}

const wranglerBin = new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url);
if (!existsSync(wranglerBin)) {
  console.error("❌ 找不到 node_modules/wrangler/bin/wrangler.js。请先执行 npm run install:ci。");
  process.exit(1);
}

const target = cfg.routes?.[0]?.pattern ?? "(未配置自定义域名)";
console.log("→ 部署到 Cloudflare：数据库 " + db.database_name + "，域名 " + target);

const result = spawnSync(
  process.execPath,
  [fileURLToPath(wranglerBin), "deploy", "--config", configPath],
  { stdio: "inherit", cwd: root },
);

if (result.error) {
  console.error("❌ 启动 wrangler 失败：" + result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
