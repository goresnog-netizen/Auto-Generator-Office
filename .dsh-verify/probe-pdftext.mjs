import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
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
const target = path.join(dir, "p.pdf");
const entry = path.join(dir, "pe.ts");
writeFileSync(
  entry,
  `
import { PDFGenerator } from "../src/generators/pdf.ts";
const g = new PDFGenerator({ outputPath: ${JSON.stringify(target)} });
const r = await g.generate({type:"pdf",title:"Judul Rahasia",metadata:{author:"Uji"}}, {blocks:[
 {id:"p1",type:"paragraph",text:"Paragraf Khas Uji."},
]});
console.log("__R__" + JSON.stringify({success:r.success, error:r.error}));
`,
);
const bundle = path.join(dir, "pb.mjs");
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
console.log(execFileSync(process.execPath, [bundle], { encoding: "utf8" }));

const buf = readFileSync(target);
const latin = buf.toString("latin1");

// Cari semua stream yang dikompresi FlateDecode lalu decompress.
const streams = [];
let idx = 0;
while (true) {
  const s = latin.indexOf("stream", idx);
  if (s < 0) break;
  let dataStart = s + 6;
  if (latin[dataStart] === "\r") dataStart++;
  if (latin[dataStart] === "\n") dataStart++;
  const e = latin.indexOf("endstream", dataStart);
  if (e < 0) break;
  const raw = buf.subarray(dataStart, e);
  try {
    streams.push(inflateSync(raw).toString("latin1"));
  } catch {
    /* stream bukan flate (mis. font) */
  }
  idx = e + 9;
}
const all = streams.join("\n");
console.log("streams decompressed:", streams.length, "total chars:", all.length);
console.log("has (Judul Rahasia):", all.includes("Judul Rahasia"));
console.log("has (Paragraf Khas Uji):", all.includes("Paragraf Khas Uji"));
console.log("has page-number text (1 / ):", all.includes("1 / "));
// Teks di PDF ditulis per glyph; cek potongan hex-encoded.
console.log("sample:", JSON.stringify(all.slice(0, 400)));
