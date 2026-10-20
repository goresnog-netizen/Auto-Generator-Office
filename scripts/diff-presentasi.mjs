import fs from "node:fs";
const src = fs.readFileSync("src/data/templates.ts", "utf8");
const blocks = src.split(/^  \{$/m);
const ts = blocks
  .filter((b) => b.includes('kategori: "presentasi"'))
  .map((b) => (b.match(/\bid: "([a-z0-9_]+)"/) || [])[1])
  .filter(Boolean);
const mf = JSON.parse(
  fs.readFileSync("templates/manifest/manifest.json", "utf8"),
)
  .filter((m) => m.kategori === "presentasi")
  .map((m) => m.id);
console.log("ts:", ts.join(","));
console.log("di ts tdk di manifest:", ts.filter((x) => !mf.includes(x)).join(",") || "-");
console.log("di manifest tdk di ts:", mf.filter((x) => !ts.includes(x)).join(",") || "-");
