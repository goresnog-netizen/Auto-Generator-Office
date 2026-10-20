import PDFDocument from "pdfkit";
import { inflateSync } from "node:zlib";

// A) How many addPage calls does pdfkit make internally?
let p = PDFDocument.prototype;
const asli = p.addPage;
let calls = 0;
p.addPage = function (...a) {
  calls++;
  return asli.apply(this, a);
};

const doc = new PDFDocument({
  size: "A4",
  layout: "portrait",
  margins: { top: 72, right: 72, bottom: 72, left: 72 },
  bufferPages: true,
});
console.log("addPage calls after constructor:", calls);
console.log("bufferedPageRange:", JSON.stringify(doc.bufferedPageRange()));
console.log("Pages.Count:", doc._root.data.Pages.Count);
console.log("Pages.Kids.length:", doc._root.data.Pages.Kids.length);

doc.fontSize(36).text("Judul", 72, 300);
doc.addPage();
console.log("after addPage -> calls:", calls, "range:", JSON.stringify(doc.bufferedPageRange()), "Count:", doc._root.data.Pages.Count);

doc.fontSize(12).text("Isi");
const range = doc.bufferedPageRange();
console.log("final range:", JSON.stringify(range));
doc.end();

doc.on("end", () => {
  console.log("FINAL Pages.Count:", doc._root.data.Pages.Count, "Kids:", doc._root.data.Pages.Kids.length);
});
