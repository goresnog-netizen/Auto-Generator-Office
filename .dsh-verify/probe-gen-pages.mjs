import PDFDocument from "pdfkit";

const asli = PDFDocument.prototype.addPage;
let jejak = [];
PDFDocument.prototype.addPage = function (...a) {
  jejak.push("addPage");
  return asli.apply(this, a);
};

const doc = new PDFDocument({
  size: "A4",
  layout: "portrait",
  margins: { top: 72, right: 72, bottom: 72, left: 72 },
  bufferPages: true,
  info: { Title: "Laporan Uji", Author: "Uji" },
});
const chunks = [];
doc.on("data", (c) => chunks.push(c));

// Replikasi addTitlePage generator
const pageHeight = doc.page.height;
const pageWidth = doc.page.width;
const margin = 72;
doc.fontSize(36).font("Helvetica-Bold").fillColor("#1A1A1D").text("Laporan Uji", margin, pageHeight / 2 - 50, { width: pageWidth - 2 * margin, align: "center" });
doc.fontSize(18).font("Helvetica").fillColor("#5C5C66").text("Dokumen sintetis untuk verifikasi generator.", margin, pageHeight / 2 + 20, { width: pageWidth - 2 * margin, align: "center" });
doc.fontSize(12).font("Helvetica").fillColor("#8A8A94").text("By Uji", margin, pageHeight - 100, { width: pageWidth - 2 * margin, align: "center" });
console.log("setelah title page: range =", JSON.stringify(doc.bufferedPageRange()), "jejak =", jejak.length);
doc.addPage();
console.log("setelah addPage: range =", JSON.stringify(doc.bufferedPageRange()), "jejak =", jejak.length);

// Isi konten (paragraf)
doc.fontSize(12).font("Helvetica").fillColor("#1A1A1D").text("Paragraf pengujian.", { align: "left", lineGap: 4 });
doc.moveDown(0.5);
doc.fontSize(12).font("Helvetica").fillColor("#1A1A1D").text("Paragraf kedua.", { align: "left", lineGap: 4 });
doc.moveDown(0.5);
console.log("setelah konten: range =", JSON.stringify(doc.bufferedPageRange()), "jejak =", jejak.length);

// Nomor halaman
const pages = doc.bufferedPageRange();
console.log("addPageNumbers: pages.count =", pages.count);
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(pages.start + i);
  doc.fontSize(9).font("Helvetica").fillColor("#9E9E9E").text(`${i + 1} / ${pages.count}`, 0, doc.page.height - 50, { align: "center" });
}
console.log("setelah nomor halaman: range =", JSON.stringify(doc.bufferedPageRange()), "jejak =", jejak.length);
doc.end();

doc.on("end", () => {
  const buf = Buffer.concat(chunks);
  const latin = buf.toString("latin1");
  console.log("FINAL /Count:", (latin.match(/\/Count\s+(\d+)/) || [])[1], "Kids:", (latin.match(/\/Kids\s*\[[^\]]*\]/) || [])[0]);
  console.log("total addPage:", jejak.length);
});
