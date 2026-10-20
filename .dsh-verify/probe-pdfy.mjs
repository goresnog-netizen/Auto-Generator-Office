import PDFDocument from "pdfkit";

const asli = PDFDocument.prototype.addPage;
let jejak = [];
PDFDocument.prototype.addPage = function (...a) {
  jejak.push(new Error().stack.split("\n")[2]?.trim());
  return asli.apply(this, a);
};

function jalankan(y) {
  return new Promise((resolve) => {
    jejak = [];
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
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      doc.fontSize(9).text(`${i + 1} / ${pages.count}`, 0, y, { align: "center" });
    }
    doc.end();
    doc.on("end", () => {
      const latin = Buffer.concat(chunks).toString("latin1");
      console.log(
        `y=${y} (maxY=${doc.page.maxY().toFixed(2)}) -> /Count=${(latin.match(/\/Count\s+(\d+)/) || [])[1]} addPage=${jejak.length}`,
      );
      resolve();
    });
  });
}

// Nilai yang dipakai generator sekarang: doc.page.height - 50
await jalankan(841.89 - 50);
await jalankan(841.89 - 72 - 20); // di dalam area teks
