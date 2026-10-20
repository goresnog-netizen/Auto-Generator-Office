import PDFDocument from "pdfkit";

function build(bufferPages) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "portrait",
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
      bufferPages,
      info: { Title: "Uji" },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.fontSize(36).font("Helvetica-Bold").text("Judul", 72, 300, { width: 451, align: "center" });
    doc.addPage();
    for (let i = 0; i < 3; i++) {
      doc.fontSize(12).font("Helvetica").text(`Halaman isi ${i}`);
      doc.moveDown(30);
    }
    const pages = doc.bufferedPageRange();
    let err = null;
    try {
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(pages.start + i);
        doc.fontSize(9).text(`${i + 1} / ${pages.count}`, 0, 792 - 50, { align: "center" });
      }
    } catch (e) {
      err = e.message;
    }
    doc.end();
    doc.on("end", () => {
      const buf = Buffer.concat(chunks);
      const s = buf.toString("latin1");
      const kids = (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
      const countDecl = (s.match(/\/Count\s+(\d+)/) || [])[1];
      console.log(
        `bufferPages=${bufferPages}: bytes=${buf.length} /Type/Page=${kids} /Count=${countDecl} err=${err} range=${JSON.stringify(pages)}`,
      );
      resolve();
    });
  });
}

await build(true);
await build(false);
