
import { PDFGenerator } from "../src/generators/pdf.ts";
const g = new PDFGenerator({ outputPath: "C:\\MRP\\proyek 2026\\NitZ-909\\.dsh-verify\\p.pdf" });
const r = await g.generate({type:"pdf",title:"Judul Rahasia",metadata:{author:"Uji"}}, {blocks:[
 {id:"p1",type:"paragraph",text:"Paragraf Khas Uji."},
]});
console.log("__R__" + JSON.stringify({success:r.success, error:r.error}));
