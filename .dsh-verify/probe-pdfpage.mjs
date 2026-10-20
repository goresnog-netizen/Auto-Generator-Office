import PDFDocument from "pdfkit";
import { inflateSync } from "node:zlib";

function build(yPos) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "portrait",
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
      bufferPages: true,
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.fontSize(36).text("Judul", 72, 300);
    doc.addPage();
    doc.fontSize(12).text("Isi");
    const range = doc.bufferedPageRange();
    console.log(`  maxY (page.height - margin.bottom) = ${doc.page.maxY()}`);
    console.log(`  writing page number at y = ${yPos}`);
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fontSize(9).text(`${i + 1} / ${range.count}`, 0, yPos, { align: "center" });
    }
    doc.end();
    doc.on("end", () => {
      const buf = Buffer.concat(chunks);
      const latin = buf.toString("latin1");
      console.log(
        `  y=${yPos}: /Count=${(latin.match(/\/Count\s+(\d+)/) || [])[1]} Kids=${(latin.match(/\/Kids\s*\[[^\]]*\]/) || [])[0]}`,
      );
      resolve();
    });
  });
}

console.log("A) nomor halaman DI BAWAH margin bawah (kode generator sekarang):");
await build(792 - 50); // 742
console.log("B) nomor halaman DI DALAM area teks:");
await build(792 - 72 - 20); // 700
