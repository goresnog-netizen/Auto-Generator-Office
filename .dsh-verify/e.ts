
import { XLSXGenerator } from "../src/generators/xlsx.ts";
const g = new XLSXGenerator({ outputPath: "C:\\MRP\\proyek 2026\\NitZ-909\\.dsh-verify\\x.xlsx", sheets: [] });
const r = await g.generate({type:"xlsx",title:"Uji",metadata:{author:"Uji"}}, {blocks:[
 {id:"h",type:"heading",level:1,text:"Judul Sheet"},
 {id:"p",type:"paragraph",text:"Teks paragraf."},
 {id:"t",type:"table",headers:["A","B"],rows:[["1","2"]]},
]});
console.log("__R__" + JSON.stringify({success:r.success, error:r.error}));
