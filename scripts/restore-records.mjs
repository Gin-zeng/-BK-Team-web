// 把旧站导出的 JSON（GET /api/store 的结果）转成可直接执行到新 D1 的 SQL。
// 用法：
//   1) node scripts/restore-records.mjs
//   2) npx wrangler d1 execute mech-hoops-db --remote --file restore.sql
// 说明：video/image 记录会被跳过（旧站 R2 文件无法搬运，需重新上传）。
import { readFileSync, writeFileSync } from "node:fs";

const raw = JSON.parse(readFileSync(new URL("../old-data.json", import.meta.url), "utf8"));
const records = Array.isArray(raw) ? raw : (raw.records ?? raw.data ?? []);
const metaKeys = new Set(["id", "kind", "status", "createdAt", "updatedAt"]);
const skipKinds = new Set(["video", "image"]);
const esc = (s) => String(s).replace(/'/g, "''");

const sqlLines = [];
const stats = {};
for (const r of records) {
  if (!r || skipKinds.has(r.kind)) continue;
  const data = {};
  for (const [k, v] of Object.entries(r)) {
    if (!metaKeys.has(k)) data[k] = v;
  }
  const id = r.id;
  const kind = r.kind;
  const status = r.status || "draft";
  const created = r.createdAt || new Date().toISOString();
  const updated = r.updatedAt || created;
  sqlLines.push(
    "INSERT OR REPLACE INTO records(id,kind,status,data,created_at,updated_at) VALUES('" +
      [id, kind, status, JSON.stringify(data), created, updated].map(esc).join("','") +
      "');",
  );
  stats[kind] = (stats[kind] || 0) + 1;
}

const out = new URL("../restore.sql", import.meta.url);
writeFileSync(out, sqlLines.join("\n") + "\n");
console.log("已生成 restore.sql，记录分布：" + JSON.stringify(stats));
