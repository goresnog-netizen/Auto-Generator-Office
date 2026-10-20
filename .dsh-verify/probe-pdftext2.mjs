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
execFileSync(process.execPath, [bundle], { encoding: "utf8" });

const buf = readFileSync(target);
const latin = buf.toString("latin1");
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
  try {
    streams.push(inflateSync(buf.subarray(dataStart, e)).toString("latin1"));
  } catch {}
  idx = e + 9;
}
const all = streams.join("\n");

// Decode run teks: <hex> dan (literal) di dalam array TJ.
let teks = "";
for (const m of all.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
  const arr = m[1];
  for (const h of arr.matchAll(/<([0-9A-Fa-f]*)>/g)) {
    const hex = h[1];
    let out = "";
    for (let i = 0; i + 1 < hex.length; i += 2) {
      out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    teks += out;
  }
  for (const lit of arr.matchAll(/\(([^)]*)\)/g)) {
    teks += lit[1];
  }
  teks += "\n";
}
console.log("DECODED TEXT:\n" + JSON.stringify(teks));
console.log("has Judul Rahasia:", teks.includes("Judul Rahasia"));
console.log("has Paragraf Khas Uji:", teks.includes("Paragraf Khas Uji"));
console.log("page-number matches:", (teks.match(/\d+\s*\/\s*\d+/g) || []).join(","));
