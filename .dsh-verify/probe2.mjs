import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const store = path.join(process.cwd(), "node_modules", ".pnpm");
const { readdirSync } = require("node:fs");
let esbuild;
for (const d of readdirSync(store)) {
  if (d.startsWith("esbuild@")) {
    try { esbuild = require(path.join(store, d, "node_modules", "esbuild", "lib", "main.js")); break; } catch {}
  }
}
const dir = path.resolve(".dsh-verify");
const entry = path.join(dir, "e.ts");
writeFileSync(entry, `
import { XLSXGenerator } from "../src/generators/xlsx.ts";
const g = new XLSXGenerator({ outputPath: ${JSON.stringify(path.join(dir, "x.xlsx"))}, sheets: [] });
const r = await g.generate({type:"xlsx",title:"Uji",metadata:{author:"Uji"}}, {blocks:[
 {id:"h",type:"heading",level:1,text:"Judul Sheet"},
 {id:"p",type:"paragraph",text:"Teks paragraf."},
 {id:"t",type:"table",headers:["A","B"],rows:[["1","2"]]},
]});
console.log("__R__" + JSON.stringify({success:r.success, error:r.error}));
`);
const bundle = path.join(dir, "b.mjs");
await esbuild.build({entryPoints:[entry], bundle:true, platform:"node", format:"esm", target:"node22", outfile:bundle, external:["docx","exceljs","pdfkit","pptxgenjs"], logLevel:"silent"});
execFileSync(process.execPath, [bundle], {stdio:"inherit"});
