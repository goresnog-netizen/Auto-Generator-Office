import PDFDocument from "pdfkit";

const doc = new PDFDocument({
  size: "A4",
  layout: "portrait",
  margins: { top: 72, right: 72, bottom: 72, left: 72 },
  bufferPages: true,
  info: { Title: "Uji", Author: "NitZ-909" },
});

const chunks = [];
doc.on("data", (c) => chunks.push(c));

doc.fontSize(36).font("Helvetica-Bold").fillColor("#1A1A1D").text("Judul Uji", 72, 300, { width: 451, align: "center" });
doc.addPage();
doc.fontSize(12).font("Helvetica").text("Isi halaman kedua");
const pages = doc.bufferedPageRange();
console.log("page range:", JSON.stringify(pages));
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);
  doc.fontSize(9).text(`${i + 1} / ${pages.count}`, 0, 792 - 50, { align: "center" });
}
doc.end();
await new Promise((res, rej) => { doc.on("end", res); doc.on("error", rej); });
const buf = Buffer.concat(chunks);
console.log("bytes:", buf.length);
console.log("header:", buf.subarray(0, 8).toString("latin1"));
const s = buf.toString("latin1");
console.log("BT count:", (s.match(/BT/g) || []).length);
console.log("Tj count:", (s.match(/Tj/g) || []).length);
console.log("/Count:", (s.match(/\/Count\s+\d+/) || [])[0]);
console.log("MediaBox:", (s.match(/\/MediaBox[^\]]*\]/) || [])[0]);
console.log("ends with EOF:", s.trimEnd().endsWith("%%EOF"));
