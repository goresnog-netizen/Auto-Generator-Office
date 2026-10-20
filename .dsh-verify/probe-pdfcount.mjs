import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { inflateSync } from "node:zlib";
import path from "node:path";

const require = createRequire(import.meta.url);
const { readdirSync } = require("node:fs");
const store = path.join(process.cwd(), "node_modules", ".pnpm");
let esbuild;
for (const d of readdirSync(store)) {
  if (d.startsWith("esbuild@")) {
    try {
      esbuild = require(path.join(store, d, "node_modules", "esbuild", "lib", "main.js"));
      break;
    } catch {}
  }
}

const dir = path.resolve(".dsh-verify");
mkdirSync(dir, { recursive: true });
const target = path.join(dir, "p2.pdf");
const entry = path.join(dir, "pe2.ts");
writeFileSync(
  entry,
  `
import { PDFGenerator } from "../src/generators/pdf.ts";
const g = new PDFGenerator({ outputPath: ${JSON.stringify(target)} });
const r = await g.generate({type:"pdf",title:"Laporan Uji",metadata:{author:"Uji"}}, {blocks:[
 {id:"p1",type:"paragraph",text:"Paragraf pengujian."},
 {id:"p2",type:"paragraph",text:"Paragraf kedua."},
]});
console.log("__R__" + JSON.stringify({success:r.success, error:r.error}));
`,
);
const bundle = path.join(dir, "pb2.mjs");
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: bundle,
  external: ["docx", "exceljs", "pdfkit", "pptxgenjs"],
  logLevel: "silent",
});
execFileSync(process.execPath, [bundle], { encoding: "utf8" });

const buf = readFileSync(target);
const latin = buf.toString("latin1");
console.log("/Count decls:", (latin.match(/\/Count\s+\d+/g) || []).join(", "));
console.log("/Type /Page (regex):", (latin.match(/\/Type\s*\/Page[^s]/g) || []).length);
console.log("/Type /Pages decl:", (latin.match(/\/Type\s*\/Pages/g) || []).length);
console.log("Kids count:", (latin.match(/\/Kids\s*\[[^\]]*\]/) || [])[0]);

const streams = [];
let i = 0;
while (true) {
  const s = latin.indexOf("stream", i);
  if (s < 0) break;
  let m = s + 6;
  if (latin[m] === "\r") m++;
  if (latin[m] === "\n") m++;
  const e = latin.indexOf("endstream", m);
  if (e < 0) break;
  try {
    streams.push(inflateSync(buf.subarray(m, e)).toString("latin1"));
  } catch {}
  i = e + 9;
}
let teks = "";
for (const mm of streams.join("\n").matchAll(/\[([^\]]*)\]\s*TJ/g)) {
  for (const h of mm[1].matchAll(/<([0-9A-Fa-f]*)>/g)) {
    const hex = h[1];
    for (let k = 0; k + 1 < hex.length; k += 2)
      teks += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
  }
  teks += "\n";
}
console.log("TEXT:\n" + JSON.stringify(teks));
console.log("page labels:", (teks.match(/\d+\s*\/\s*\d+/g) || []).join(", "));
