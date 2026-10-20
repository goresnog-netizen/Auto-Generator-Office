import PDFDocument from "pdfkit";
import { inflateSync } from "node:zlib";

// Rekam pemanggilan addPage untuk melihat halaman yang pdfkit buat sendiri.
const asli = PDFDocument.prototype.addPage;
let calls = [];
PDFDocument.prototype.addPage = function (...a) {
  calls.push(this._pageBuffer.length);
  return asli.apply(this, a);
};

const doc = new PDFDocument({
  size: "A4",
  layout: "portrait",
  margins: { top: 72, right: 72, bottom: 72, left: 72 },
  bufferPages: true,
});
console.log("after ctor: addPage calls =", calls.length, "range:", JSON.stringify(doc.bufferedPageRange()));

doc.fontSize(36).text("Judul", 72, 300);
doc.addPage();
console.log("after explicit addPage: calls =", calls.length, "range:", JSON.stringify(doc.bufferedPageRange()));

doc.fontSize(12).text("Isi");
doc.moveDown(40);
doc.text("Isi panjang");
const range = doc.bufferedPageRange();
console.log("before end: calls =", calls.length, "range:", JSON.stringify(range));
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  doc.fontSize(9).text(`${i + 1} / ${range.count}`, 0, 792 - 50, { align: "center" });
}
doc.end();

const chunks = [];
doc.on("end", () => {
  console.log("FINAL: addPage calls =", calls.length, "range at end:", JSON.stringify(range));
});
doc.on("data", (c) => chunks.push(c));
doc.on("end", () => {
  const buf = Buffer.concat(chunks);
  const latin = buf.toString("latin1");
  console.log("/Count:", (latin.match(/\/Count\s+\d+/g) || []).join(","));
  console.log("Kids:", (latin.match(/\/Kids\s*\[[^\]]*\]/) || [])[0]);
});
