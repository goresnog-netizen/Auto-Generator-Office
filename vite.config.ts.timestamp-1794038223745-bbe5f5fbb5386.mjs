var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/deckcraft.ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
function defaultBinPath() {
  const dariEnv = process.env.DECKCRAFT_CLI?.trim();
  if (dariEnv) return dariEnv;
  const akar = process.cwd();
  const app = path.join(akar, "vendors", "deckcraft-bin", "app");
  if (process.platform === "win32") {
    return path.join(
      app,
      "deckcraft-0.8.0-windows-x64-portable",
      "deckcraft-cli.exe"
    );
  }
  if (process.platform === "darwin") {
    return path.join(
      app,
      "deckcraft-cli-0.8.0-macos-universal",
      "deckcraft-cli"
    );
  }
  return path.join(
    app,
    "deckcraft-0.8.0-linux-x86_64",
    "bin",
    "deckcraft-cli"
  );
}
function jalankanSekali(binPath, args, input) {
  return new Promise((resolve, reject) => {
    const anak = spawn(binPath, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    anak.stdout.on("data", (d) => {
      stdout += d.toString("utf8");
    });
    anak.stderr.on("data", (d) => {
      stderr += d.toString("utf8");
    });
    anak.on("error", (e) => reject(e));
    anak.on(
      "close",
      (code) => resolve({ kode: code ?? -1, stdout, stderr })
    );
    if (input !== void 0) {
      anak.stdin.end(input);
    } else {
      anak.stdin.end();
    }
  });
}
async function bacaTemaDeckcraft(binPath = defaultBinPath()) {
  try {
    const { stdout } = await jalankanSekali(binPath, [
      "run",
      "--cmd",
      "design.themes",
      "--print",
      "--save",
      path.join(tmpdir(), "deckcraft-tema.deckcraft")
    ]);
    const baris = stdout.split(/\r?\n/).find((b) => b.includes("design.themes"));
    if (!baris) return [];
    const json = baris.slice(baris.indexOf("\u2192") + 1).trim();
    const data = JSON.parse(json);
    const dariTema = (data.themes ?? []).map((t) => t.name);
    return dariTema.length > 0 ? dariTema : data.colorSchemes ?? [];
  } catch {
    return [];
  }
}
async function periksaDeckcraft(binPath = defaultBinPath()) {
  if (!existsSync(binPath)) {
    return {
      binPath,
      versi: "-",
      tersedia: false,
      tema: [],
      galat: "Binary deckcraft-cli tidak ditemukan. Jalankan skrip vendoring."
    };
  }
  try {
    const { stdout, stderr, kode } = await jalankanSekali(binPath, ["--version"]);
    if (kode !== 0) {
      return {
        binPath,
        versi: "-",
        tersedia: false,
        tema: [],
        galat: stderr.trim() || "deckcraft-cli gagal dijalankan."
      };
    }
    const versi = stdout.trim() || "-";
    const tema = await bacaTemaDeckcraft(binPath);
    return { binPath, versi, tersedia: true, tema };
  } catch (e) {
    return {
      binPath,
      versi: "-",
      tersedia: false,
      tema: [],
      galat: e instanceof Error ? e.message : "Gagal menjalankan deckcraft-cli."
    };
  }
}
var DeckcraftSession;
var init_deckcraft = __esm({
  "src/lib/deckcraft.ts"() {
    "use strict";
    DeckcraftSession = class {
      constructor(binPath = defaultBinPath(), akarKerja) {
        this.anak = null;
        /** Antrean serialize: satu perintah pada satu waktu. */
        this.antrean = Promise.resolve();
        this.penghitung = 0;
        this.buffer = "";
        this.penunggu = /* @__PURE__ */ new Map();
        this.binPath = binPath;
        this.akarKerja = akarKerja;
      }
      get aktif() {
        return this.anak !== null;
      }
      /** Mulai proses MCP dan lakukan handshake. */
      async mulai() {
        if (this.anak) return;
        const anak = spawn(this.binPath, ["mcp"], {
          stdio: ["pipe", "pipe", "pipe"],
          cwd: this.akarKerja
        });
        this.anak = anak;
        this.buffer = "";
        anak.stdout.setEncoding("utf8");
        anak.stdout.on("data", (potongan) => this.serap(potongan));
        anak.stderr.on("data", () => {
        });
        anak.on("close", () => {
          this.anak = null;
          for (const { reject } of this.penunggu.values()) {
            reject(new Error("Proses deckcraft-cli berhenti."));
          }
          this.penunggu.clear();
        });
        await this.kirim("initialize", {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "nitz-909", version: "1" }
        });
        this.tulis({
          jsonrpc: "2.0",
          method: "notifications/initialized"
        });
      }
      /** Hentikan proses dengan rapi. */
      async berhenti() {
        const anak = this.anak;
        this.anak = null;
        if (!anak) return;
        anak.stdin.end();
        anak.kill();
        for (const { reject } of this.penunggu.values()) {
          reject(new Error("Sesi deckcraft ditutup."));
        }
        this.penunggu.clear();
      }
      serap(potongan) {
        this.buffer += potongan;
        let idx = this.buffer.indexOf("\n");
        while (idx >= 0) {
          const baris = this.buffer.slice(0, idx).trim();
          this.buffer = this.buffer.slice(idx + 1);
          if (baris) this.tangani(baris);
          idx = this.buffer.indexOf("\n");
        }
        if (this.buffer.length > 16 * 1024 * 1024) {
          this.buffer = "";
          for (const { reject } of this.penunggu.values()) {
            reject(new Error("Balasan deckcraft melebihi batas 16 MiB."));
          }
          this.penunggu.clear();
        }
      }
      tangani(baris) {
        let pesan;
        try {
          pesan = JSON.parse(baris);
        } catch {
          return;
        }
        if (typeof pesan.id !== "number") return;
        const tunggu = this.penunggu.get(pesan.id);
        if (!tunggu) return;
        this.penunggu.delete(pesan.id);
        if (pesan.error) {
          tunggu.reject(
            new Error(pesan.error.message ?? "Kesalahan JSON-RPC dari deckcraft.")
          );
          return;
        }
        tunggu.resolve(pesan.result);
      }
      tulis(pesan) {
        if (!this.anak) throw new Error("Sesi deckcraft belum dimulai.");
        this.anak.stdin.write(`${JSON.stringify(pesan)}
`);
      }
      /** Kirim satu permintaan JSON-RPC dan tunggu balasannya. */
      kirim(method, params) {
        const id = ++this.penghitung;
        const hasil = new Promise((resolve, reject) => {
          this.penunggu.set(id, { resolve, reject });
        });
        this.tulis({
          jsonrpc: "2.0",
          id,
          method,
          params: params ?? {}
        });
        return hasil;
      }
      /**
       * Panggil tool MCP. Antrian di serialkan supaya perintah tidak saling
       * menimpa state presentasi.
       */
      async panggil(nama, argumen = {}) {
        const jalan = this.antrean.then(async () => {
          await this.mulai();
          const balasan = await this.kirim("tools/call", {
            name: nama,
            arguments: argumen
          });
          const teks = (balasan.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
          if (balasan.isError) {
            throw new Error(teks || `Tool deckcraft "${nama}" gagal.`);
          }
          return teks;
        });
        this.antrean = jalan.then(
          () => void 0,
          () => void 0
        );
        return jalan;
      }
      /** Jalankan sekumpulan perintah engine dalam satu batch. */
      async jalankan(perintah) {
        if (perintah.length === 0) return "";
        return this.panggil("batch", {
          commands: this.perintahKeEngine(perintah)
        });
      }
      /**
       * Jalankan satu perintah engine di luar batch.
       *
       * Berbeda dari `panggil` (yang memanggil MCP tool), perintah di sini adalah
       * ENGINE command - eg. `slide.go`, `slide.inspect`, `shape.inspect`. MCP
       * tool `run_command` memang bisa memanggilnya, tapi `batch` lebih murah
       * untuk deretan perintah berurutan.
       */
      async jalankanEngine(perintah, params = {}) {
        return this.panggil("run_command", { command: perintah, params });
      }
      /**
       * Ubah daftar perintah menjadi bentuk yang bisa dikirim ke engine.
       *
       * Perintah `format.*` (dan perintah lain yang berlaku pada selection)
       * hanya berlaku pada slide AKTIF. Karena itu, sebelum menjalankan perintah
       * format pada slide tertentu, bridge menyisipkan `slide.go {index}`.
       *
       * Bukti empiris (DeckCraft v0.8.0, MCP):
       *  - `format.font {family, ids:[N]}` mengabaikan `ids`;
       *  - `format.font` tanpa selection aktif = no-op;
       *  - `slide.go {index}` memindahkan slide aktif, dan selection shape pada
       *    slide itu menjadi target perintah format.
       */
      perintahKeEngine(perintah) {
        const hasil = [];
        let slideAktif = null;
        for (const p of perintah) {
          if (p.command === "slide.new") {
            hasil.push({ command: p.command, params: p.params ?? {} });
            slideAktif = null;
            continue;
          }
          if (typeof p.slide === "number" && p.slide !== slideAktif) {
            hasil.push({ command: "slide.go", params: { index: p.slide } });
            slideAktif = p.slide;
          }
          hasil.push({ command: p.command, params: p.params ?? {} });
        }
        return hasil;
      }
      /** Baca ringkasan presentasi yang aktif. */
      async periksa() {
        const teks = await this.panggil("inspect_document", {});
        const data = JSON.parse(teks);
        return {
          title: data.title ?? "",
          theme: data.theme ?? "",
          slideSize: data.slideSize ?? [960, 540],
          slides: (data.slides ?? []).map((s) => ({
            index: s.index,
            id: s.id,
            title: s.title ?? "",
            layout: s.layout ?? "",
            shapes: s.shapes ?? 0,
            hidden: !!s.hidden
          }))
        };
      }
      /** Render satu slide jadi PNG (base64) untuk pratinjau di browser. */
      async renderSlide(slide = 0, skala = 1) {
        const balasan = await this.kirimToolMentah("render_slide", {
          slide,
          scale: skala
        });
        const gambar = (balasan.content ?? []).find((c) => c.type === "image");
        if (!gambar?.data) {
          const jumlah = await this.hitungSlide().catch(() => 0);
          if (jumlah === 0) {
            throw new Error("DeckCraft tidak punya slide untuk dirender.");
          }
          throw new Error(
            `Slide ${slide} tidak ada (deck berisi ${jumlah} slide).`
          );
        }
        return gambar.data;
      }
      /** Jumlah slide pada presentasi aktif (0 bila tidak ada deck). */
      async hitungSlide() {
        const teks = await this.panggil("inspect_document", {});
        try {
          const data = JSON.parse(teks);
          return data.slides?.length ?? 0;
        } catch {
          return 0;
        }
      }
      async kirimToolMentah(nama, argumen) {
        const jalan = this.antrean.then(async () => {
          await this.mulai();
          return this.kirim("tools/call", { name: nama, arguments: argumen });
        });
        this.antrean = jalan.then(
          () => void 0,
          () => void 0
        );
        return jalan;
      }
      /** Simpan presentasi ke path tertentu (ekstensi menentukan format). */
      async simpan(pathTujuan) {
        return this.panggil("export", { path: pathTujuan });
      }
      /**
       * Ekspor deck ke format tertentu lewat tool MCP `export`.
       *
       * Format yang didukung engine v0.8.0: png, jpeg, pptx, deckcraft, outline,
       * pdf, gif. Ekstensi path harus cocok dengan format (engine menolak
       * kombinasi yang tak konsisten).
       */
      async ekspor(pathTujuan, format, opsi = {}) {
        const teks = await this.panggil("export", { path: pathTujuan, format, ...opsi });
        try {
          return JSON.parse(teks);
        } catch {
          return {};
        }
      }
      /**
       * Render semua slide jadi PNG (base64) untuk filmstrip pratinjau.
       *
       * Render per-slide (bukan `export all`) karena hasilnya langsung jadi
       * data-URL di respons JSON, tanpa file sementara di server.
       */
      async renderSemua(jumlahSlide, skala = 0.35) {
        const hasil = [];
        for (let i = 0; i < jumlahSlide; i++) {
          hasil.push(await this.renderSlide(i, skala));
        }
        return hasil;
      }
    };
  }
});

// src/lib/deckcraft-ppt.ts
function smartArtDariDiagram(b) {
  const sumber = b.source || "";
  if (!/-->/.test(sumber)) return null;
  const label = [...sumber.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
  const tahap = label.length > 0 ? label : [];
  if (tahap.length === 0) return null;
  return {
    command: "insert.smartArt",
    params: {
      kind: "process",
      items: tahap
      // Tidak ada `rect`: `insert.smartArt` tidak menerimanya dan mengabaikannya.
      // SmartArt diposisikan otomatis oleh engine (10%–90% lebar slide,
      // 28%–88% tinggi) — lihat crates/engine/src/cmd/smartart.rs.
    }
  };
}
function listKeBaris(items, level = 0, keluar = []) {
  for (const it of items) {
    keluar.push(`${"	".repeat(level)}${it.text}`);
    if (it.children?.length) listKeBaris(it.children, level + 1, keluar);
  }
  return keluar;
}
function blokKePerintah(blocks, options = {}) {
  const perintah = [];
  const tema = options.tema || "Slate";
  if (options.sampul && options.judul) {
    perintah.push({
      command: "file.new",
      params: { theme: tema, blank: true }
    });
    perintah.push({
      command: "slide.new",
      params: {
        layout: "titleOnly",
        title: options.judul
      }
    });
  } else {
    perintah.push({
      command: "file.new",
      params: { theme: tema, blank: true }
    });
  }
  if (options.judul) {
    perintah.push({
      command: "file.properties",
      params: { title: options.judul, author: "NitZ-909" }
    });
  }
  let slideBaru = [];
  let judulMenunggu = options.judul || "Materi";
  let slideTerisi = false;
  let kursorY = 140;
  const flushSlide = () => {
    if (slideBaru.length > 0) {
      perintah.push(...slideBaru);
    }
    slideBaru = [];
    slideTerisi = false;
    kursorY = 140;
  };
  const mulaiSlide = (judul) => {
    flushSlide();
    slideBaru = [
      { command: "slide.new", params: { layout: "titleOnly", title: judul } }
    ];
    slideTerisi = false;
    kursorY = 140;
  };
  const tambahTeks = (teks, opsi = {}) => {
    if (slideBaru.length === 0) mulaiSlide(judulMenunggu);
    const baris = teks.split("\n");
    const tinggi = Math.min(Math.max(baris.length * 26, 34), 300);
    slideBaru.push({
      command: "insert.textBox",
      params: { rect: [MARGIN_X, kursorY, KONTEN_W, tinggi], text: teks }
    });
    if (opsi.bullet) {
      slideBaru.push({
        command: "format.bullets",
        params: { on: true, char: "\u2022" }
      });
    }
    kursorY += tinggi + 16;
    slideTerisi = true;
  };
  const mulaiSlideObjek = (judul) => {
    if (slideBaru.length === 0 || slideTerisi) {
      flushSlide();
      slideBaru = [
        { command: "slide.new", params: { layout: "titleOnly", title: judul } }
      ];
    } else {
      slideBaru = [
        {
          command: "slide.new",
          params: { layout: "titleOnly", title: judul }
        }
      ];
    }
    slideTerisi = true;
  };
  const tambahKode = (b) => {
    if (slideBaru.length === 0) mulaiSlide(judulMenunggu);
    const baris = b.code.split("\n");
    const tinggi = Math.min(Math.max(baris.length * 26 + 28, 72), 340);
    const karakterTerpanjang = baris.reduce(
      (maks, b2) => Math.max(maks, b2.length),
      0
    );
    const lebarIdeal = karakterTerpanjang * LEBAR_KARAKTER_PT + 36;
    const lebar = Math.min(Math.max(lebarIdeal, LEBAR_KODE_MIN), LEBAR_KODE_MAX);
    slideBaru.push({
      command: "insert.textBox",
      params: {
        rect: [MARGIN_X, kursorY, lebar, tinggi],
        text: b.code
      }
    });
    slideBaru.push({
      command: "format.font",
      params: { family: FONT_KODE }
    });
    slideBaru.push({
      command: "format.size",
      params: { size: UKURAN_FONT_KODE }
    });
    slideBaru.push({
      command: "format.color",
      params: { color: WARNA_TEKST_KODE }
    });
    slideBaru.push({
      command: "shape.fill",
      params: { color: WARNA_LATAR_KODE }
    });
    slideBaru.push({
      command: "shape.line",
      params: { color: WARNA_GARIS_KODE, width: 1 }
    });
    kursorY += tinggi + 16;
    slideTerisi = true;
  };
  for (const b of blocks) {
    switch (b.type) {
      case "heading": {
        if (b.level <= 2) {
          flushSlide();
          judulMenunggu = b.text;
        } else {
          tambahTeks(b.text);
        }
        break;
      }
      case "paragraph": {
        tambahTeks(b.text);
        break;
      }
      case "list": {
        const isi = listKeBaris(b.items);
        if (isi.length === 0) break;
        if (slideBaru.length === 0) mulaiSlide(judulMenunggu);
        const tinggi = Math.min(isi.length * 26, 300);
        slideBaru.push({
          command: "insert.textBox",
          params: {
            rect: [MARGIN_X, kursorY, KONTEN_W, tinggi],
            text: isi.join("\n")
          }
        });
        slideBaru.push({
          command: "format.bullets",
          params: { on: true, char: "\u2022" }
        });
        kursorY += tinggi + 16;
        slideTerisi = true;
        break;
      }
      case "table": {
        const t = b;
        mulaiSlideObjek(judulMenunggu || options.judul || "Tabel");
        slideBaru.push({
          command: "insert.table",
          params: {
            rows: t.rows.length + 1,
            cols: t.headers.length,
            data: [t.headers, ...t.rows],
            rect: [MARGIN_X, 150, KONTEN_W, 300]
          }
        });
        break;
      }
      case "chart": {
        const c = b;
        mulaiSlideObjek(judulMenunggu || options.judul || "Grafik");
        slideBaru.push({
          command: "insert.chart",
          params: {
            type: TIPE_GRAFIK[c.chartType] ?? "column",
            categories: c.data.labels,
            series: c.data.datasets.map((d) => ({
              name: d.label,
              values: d.data
            })),
            rect: [MARGIN_X, 140, KONTEN_W, 330]
          }
        });
        break;
      }
      case "image": {
        const g = b;
        mulaiSlideObjek(judulMenunggu || options.judul || "Gambar");
        if (/^data:image\//i.test(g.src)) {
          const data = g.src.split(",")[1] ?? "";
          slideBaru.push({
            command: "insert.picture",
            params: {
              data,
              name: g.alt || "gambar",
              rect: [MARGIN_X, 140, KONTEN_W, 300]
            }
          });
        } else {
          slideBaru.push({
            command: "insert.textBox",
            params: {
              rect: [MARGIN_X, 200, KONTEN_W, 120],
              text: g.caption || g.alt || "Gambar"
            }
          });
        }
        break;
      }
      case "diagram": {
        const smart = smartArtDariDiagram(b);
        mulaiSlideObjek(judulMenunggu || options.judul || "Diagram");
        if (smart) {
          slideBaru.push(smart);
        } else {
          slideBaru.push({
            command: "insert.textBox",
            params: {
              rect: [MARGIN_X, 150, KONTEN_W, 300],
              text: b.source
            }
          });
        }
        break;
      }
      case "code": {
        tambahKode(b);
        break;
      }
      case "divider": {
        slideBaru.push({
          command: "shape.insert",
          params: {
            preset: "line",
            rect: [MARGIN_X, 300, KONTEN_W, 2]
          }
        });
        break;
      }
      default:
        break;
    }
  }
  flushSlide();
  const preamble = [];
  const groups = [];
  let sekarang = null;
  for (const p of perintah) {
    if (p.command === "slide.new") {
      sekarang = { slide: p, isi: [] };
      groups.push(sekarang);
      continue;
    }
    if (!sekarang) {
      preamble.push(p);
      continue;
    }
    sekarang.isi.push(p);
  }
  const perintahBersih = [...preamble];
  let nomorSlide = 0;
  for (const g of groups) {
    if (g.isi.length === 0) continue;
    perintahBersih.push({ ...g.slide, slide: nomorSlide });
    for (const isi of g.isi) {
      perintahBersih.push({ ...isi, slide: nomorSlide });
    }
    nomorSlide += 1;
  }
  const adaSlide = perintahBersih.some((p) => p.command === "slide.new");
  if (!adaSlide) {
    perintahBersih.push({
      command: "slide.new",
      params: {
        layout: "titleOnly",
        title: options.judul || "Presentasi NitZ-909"
      },
      slide: 0
    });
  }
  return perintahBersih;
}
var MARGIN_X, KONTEN_W, TEMA_DECKCRAFT, TIPE_GRAFIK, FONT_KODE, UKURAN_FONT_KODE, LEBAR_KARAKTER_PT, LEBAR_KODE_MIN, LEBAR_KODE_MAX, WARNA_TEKST_KODE, WARNA_LATAR_KODE, WARNA_GARIS_KODE;
var init_deckcraft_ppt = __esm({
  "src/lib/deckcraft-ppt.ts"() {
    "use strict";
    MARGIN_X = 60;
    KONTEN_W = 840;
    TEMA_DECKCRAFT = [
      "DeckCraft",
      "Harbor",
      "Ember",
      "Meadow",
      "Nocturne",
      "Paper",
      "Coral Reef",
      "Slate"
    ];
    TIPE_GRAFIK = {
      bar: "column",
      line: "line",
      pie: "pie",
      area: "area",
      scatter: "scatter"
    };
    FONT_KODE = "Liberation Mono";
    UKURAN_FONT_KODE = 18;
    LEBAR_KARAKTER_PT = 11.2;
    LEBAR_KODE_MIN = 360;
    LEBAR_KODE_MAX = KONTEN_W;
    WARNA_TEKST_KODE = "111827";
    WARNA_LATAR_KODE = "EEF0F3";
    WARNA_GARIS_KODE = "C8CDD4";
  }
});

// server/deckcraft-api.ts
var deckcraft_api_exports = {};
__export(deckcraft_api_exports, {
  tanganiApi: () => tanganiApi,
  tutupDeckcraft: () => tutupDeckcraft
});
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir as tmpdir2 } from "node:os";
import path2 from "node:path";
function bacaBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let ukuran = 0;
    req.on("data", (potongan) => {
      ukuran += potongan.length;
      if (ukuran > BATAS_BODY) {
        reject(new Error("Badan permintaan terlalu besar."));
        req.destroy();
        return;
      }
      data += potongan.toString("utf8");
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
function kirimJson(res, kode, data) {
  const badan = JSON.stringify(data);
  res.writeHead(kode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(badan),
    "Cache-Control": "no-store"
  });
  res.end(badan);
}
function serialkan(kerja) {
  const jalan = antreanDeck.then(kerja, kerja);
  antreanDeck = jalan.then(
    () => void 0,
    () => void 0
  );
  return jalan;
}
async function bangunDeck(blocks, judul, tema) {
  return serialkan(async () => {
    if (!sesiTerbuka) {
      sesiTerbuka = { sesi: new DeckcraftSession(), deck: null };
    }
    const perintah = blokKePerintah(blocks, { judul, tema });
    await sesiTerbuka.sesi.jalankan(perintah);
    const deck = await sesiTerbuka.sesi.periksa();
    sesiTerbuka.deck = deck;
    return deck;
  });
}
async function tanganiApi(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/deckcraft")) return false;
  try {
    if (url.pathname === "/api/deckcraft/status" && req.method === "GET") {
      if (!infoDeckcraft) {
        infoDeckcraft = await periksaDeckcraft();
      }
      kirimJson(res, 200, {
        tersedia: infoDeckcraft.tersedia,
        versi: infoDeckcraft.versi,
        binPath: infoDeckcraft.binPath,
        tema: infoDeckcraft.tema.length > 0 ? infoDeckcraft.tema : [...TEMA_DECKCRAFT],
        galat: infoDeckcraft.galat ?? null
      });
      return true;
    }
    if (url.pathname === "/api/deckcraft/build" && req.method === "POST") {
      const body = JSON.parse(await bacaBody(req) || "{}");
      if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
        kirimJson(res, 400, { galat: "Tidak ada blok konten." });
        return true;
      }
      if (!infoDeckcraft) infoDeckcraft = await periksaDeckcraft();
      if (!infoDeckcraft.tersedia) {
        kirimJson(res, 503, {
          galat: infoDeckcraft.galat ?? "DeckCraft tidak tersedia."
        });
        return true;
      }
      const deck = await bangunDeck(
        body.blocks,
        body.judul || "Presentasi NitZ-909",
        body.tema || "Slate"
      );
      kirimJson(res, 200, { deck });
      return true;
    }
    if (url.pathname === "/api/deckcraft/preview" && req.method === "GET") {
      if (!sesiTerbuka) {
        kirimJson(res, 409, { galat: "Bangun deck dulu sebelum meminta pratinjau." });
        return true;
      }
      const slide = Number(url.searchParams.get("slide") ?? "0");
      const skala = Number(url.searchParams.get("scale") ?? "1");
      const png = await serialkan(
        () => sesiTerbuka.sesi.renderSlide(
          Number.isFinite(slide) ? slide : 0,
          Number.isFinite(skala) ? skala : 1
        )
      );
      kirimJson(res, 200, { png, slide });
      return true;
    }
    if (url.pathname === "/api/deckcraft/filmstrip" && req.method === "GET") {
      if (!sesiTerbuka) {
        kirimJson(res, 409, { galat: "Bangun deck dulu sebelum meminta filmstrip." });
        return true;
      }
      const skala = Number(url.searchParams.get("scale") ?? "0.35");
      const gambar = await serialkan(async () => {
        const deck = await sesiTerbuka.sesi.periksa();
        const jumlah = Math.min(deck.slides.length, 40);
        return sesiTerbuka.sesi.renderSemua(
          jumlah,
          Number.isFinite(skala) ? skala : 0.35
        );
      });
      kirimJson(res, 200, { gambar });
      return true;
    }
    if (url.pathname === "/api/deckcraft/export" && req.method === "POST") {
      const body = JSON.parse(await bacaBody(req) || "{}");
      if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
        kirimJson(res, 400, { galat: "Tidak ada blok konten." });
        return true;
      }
      if (!infoDeckcraft) infoDeckcraft = await periksaDeckcraft();
      if (!infoDeckcraft.tersedia) {
        kirimJson(res, 503, {
          galat: infoDeckcraft.galat ?? "DeckCraft tidak tersedia."
        });
        return true;
      }
      const judul = body.judul || "Presentasi NitZ-909";
      const tema = body.tema || "Slate";
      const hasil = await serialkan(async () => {
        if (!sesiTerbuka) {
          sesiTerbuka = { sesi: new DeckcraftSession(), deck: null };
        }
        const perintah = blokKePerintah(body.blocks, { judul, tema });
        await sesiTerbuka.sesi.jalankan(perintah);
        const deck = await sesiTerbuka.sesi.periksa();
        sesiTerbuka.deck = deck;
        const dir = mkdtempSync(path2.join(tmpdir2(), "nitz-deckcraft-"));
        try {
          const nama = `${judul.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 100) || "Presentasi"}.pptx`;
          const target = path2.join(dir, nama);
          await sesiTerbuka.sesi.simpan(target);
          return { data: readFileSync(target), nama };
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      });
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Length": hasil.data.length,
        "Content-Disposition": `attachment; filename="${hasil.nama}"`,
        "Cache-Control": "no-store"
      });
      res.end(hasil.data);
      return true;
    }
    if (url.pathname === "/api/deckcraft/export-format" && req.method === "POST") {
      const body = JSON.parse(await bacaBody(req) || "{}");
      if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
        kirimJson(res, 400, { galat: "Tidak ada blok konten." });
        return true;
      }
      const format = body.format;
      if (!format || !(format in FORMAT_EKSPOR)) {
        kirimJson(res, 400, {
          galat: `Format "${body.format ?? "(kosong)"}" tidak didukung. Pilihan: ${Object.keys(FORMAT_EKSPOR).join(", ")}.`
        });
        return true;
      }
      if (!infoDeckcraft) infoDeckcraft = await periksaDeckcraft();
      if (!infoDeckcraft.tersedia) {
        kirimJson(res, 503, {
          galat: infoDeckcraft.galat ?? "DeckCraft tidak tersedia."
        });
        return true;
      }
      const judul = body.judul || "Presentasi NitZ-909";
      const tema = body.tema || "Slate";
      const meta = FORMAT_EKSPOR[format];
      const hasil = await serialkan(async () => {
        if (!sesiTerbuka) {
          sesiTerbuka = { sesi: new DeckcraftSession(), deck: null };
        }
        const perintah = blokKePerintah(body.blocks, { judul, tema });
        await sesiTerbuka.sesi.jalankan(perintah);
        const deck = await sesiTerbuka.sesi.periksa();
        sesiTerbuka.deck = deck;
        const dir = mkdtempSync(path2.join(tmpdir2(), "nitz-deckcraft-"));
        try {
          const nama = judul.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 100) || "Presentasi";
          const target = path2.join(dir, `${nama}.${meta.ekstensi}`);
          await sesiTerbuka.sesi.ekspor(target, format, {
            ...format === "gif" ? {
              secondsPerSlide: Number.isFinite(body.secondsPerSlide) ? Math.min(Math.max(body.secondsPerSlide ?? 3, 0.1), 600) : 3,
              loop: true
            } : {}
          });
          return { data: readFileSync(target), nama: `${nama}.${meta.ekstensi}` };
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      });
      res.writeHead(200, {
        "Content-Type": meta.mime,
        "Content-Length": hasil.data.length,
        "Content-Disposition": `attachment; filename="${hasil.nama}"`,
        "Cache-Control": "no-store"
      });
      res.end(hasil.data);
      return true;
    }
    kirimJson(res, 404, { galat: "Rute tidak dikenal." });
    return true;
  } catch (e) {
    kirimJson(res, 500, {
      galat: e instanceof Error ? e.message : "Kesalahan tak diketahui."
    });
    return true;
  }
}
async function tutupDeckcraft() {
  if (sesiTerbuka) {
    await sesiTerbuka.sesi.berhenti();
    sesiTerbuka = null;
  }
}
var BATAS_BODY, FORMAT_EKSPOR, sesiTerbuka, infoDeckcraft, antreanDeck;
var init_deckcraft_api = __esm({
  "server/deckcraft-api.ts"() {
    "use strict";
    init_deckcraft();
    init_deckcraft_ppt();
    BATAS_BODY = 8 * 1024 * 1024;
    FORMAT_EKSPOR = {
      pptx: {
        ekstensi: "pptx",
        mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      },
      pdf: { ekstensi: "pdf", mime: "application/pdf" },
      gif: { ekstensi: "gif", mime: "image/gif" }
    };
    sesiTerbuka = null;
    infoDeckcraft = null;
    antreanDeck = Promise.resolve();
  }
});

// vite.config.ts
import react from "file:///C:/MRP/proyek%202026/NitZ-909/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@22.20.5_/node_modules/@vitejs/plugin-react/dist/index.js";
import path3 from "path";
import { defineConfig } from "file:///C:/MRP/proyek%202026/NitZ-909/node_modules/.pnpm/vite@5.4.21_@types+node@22.20.5/node_modules/vite/dist/node/index.js";
var __vite_injected_original_dirname = "C:\\MRP\\proyek 2026\\NitZ-909";
async function muatApiDeckcraft() {
  try {
    const modul = await Promise.resolve().then(() => (init_deckcraft_api(), deckcraft_api_exports));
    return {
      name: "nitz-deckcraft-api",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          void modul.tanganiApi(req, res).then((tertangani) => {
            if (!tertangani) next();
          });
        });
      }
    };
  } catch {
    return null;
  }
}
var vite_config_default = defineConfig(async () => {
  const api = await muatApiDeckcraft();
  return {
    // Aset relatif: hasil build bisa dibuka dari subdirektori mana pun
    // (GitHub Pages /Auto-Generator-Office/, Vercel, atau folder lokal).
    // Tanpa ini, Vite menulis "/assets/…" yang putus di Pages project site.
    base: "./",
    plugins: api ? [react(), api] : [react()],
    resolve: {
      alias: {
        "@": path3.resolve(__vite_injected_original_dirname, "./src")
      }
    },
    server: {
      open: false
    },
    test: {
      // `Deploy Github/` adalah salinan mirror untuk hosting statis. Berkas
      // ujinya identik dengan yang di `src/`, jadi tanpa pengecualian ini
      // vitest menjalankan setiap tes dua kali dan jumlah tesnya menipu.
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/Deploy Github/**"
      ]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL2xpYi9kZWNrY3JhZnQudHMiLCAic3JjL2xpYi9kZWNrY3JhZnQtcHB0LnRzIiwgInNlcnZlci9kZWNrY3JhZnQtYXBpLnRzIiwgInZpdGUuY29uZmlnLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcTVJQXFxcXHByb3llayAyMDI2XFxcXE5pdFotOTA5XFxcXHNyY1xcXFxsaWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXE1SUFxcXFxwcm95ZWsgMjAyNlxcXFxOaXRaLTkwOVxcXFxzcmNcXFxcbGliXFxcXGRlY2tjcmFmdC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovTVJQL3Byb3llayUyMDIwMjYvTml0Wi05MDkvc3JjL2xpYi9kZWNrY3JhZnQudHNcIjsvKipcbiAqIEJyaWRnZSBEZWNrQ3JhZnQgXHUyMDE0IG1lc2luIHJlbmRlci9la3Nwb3IgcHJlc2VudGFzaSBtdXRha2hpci5cbiAqXG4gKiBEZWNrQ3JhZnQgKHN0b3J5dG9sZC9kZWNrY3JhZnQpIGFkYWxhaCByZWltcGxlbWVudGFzaSBQb3dlclBvaW50IG9wZW4tc291cmNlXG4gKiBkYWxhbSBSdXN0IG11cm5pLiBCaW5lcm55YSAoYGRlY2tjcmFmdC1jbGlgKSBiaXNhIGJlcmphbGFuIHRhbnBhIGplbmRlbGE6XG4gKlxuICogICBkZWNrY3JhZnQtY2xpIG1jcCAgICAgICAgXHUyMTkyIHNlcnZlciBNQ1AgZGkgc3RkaW8gKEpTT04tUlBDIDIuMCBwZXIgYmFyaXMpXG4gKiAgIGRlY2tjcmFmdC1jbGkgcnVuICAgICAgICBcdTIxOTIgbWVuamFsYW5rYW4gcGVyaW50YWggcGFkYSBkZWNrIGxhbHUgbWVueWltcGFuXG4gKiAgIGRlY2tjcmFmdC1jbGkgcmVuZGVyICAgICBcdTIxOTIgbWVuZ2dhbWJhciBzbGlkZSBqYWRpIFBOR1xuICpcbiAqIE1vZHVsIGluaSBiZXJiaWNhcmEgcHJvdG9rb2wgTUNQIGRpIHN0ZGlvIGthcmVuYTpcbiAqICAxLiB0aWRhayBhZGEgYmF0YXMgcGFuamFuZyBiYXJpcyBwZXJpbnRhaCBXaW5kb3dzICg4IEtCKSBzZXBlcnRpIGAtLWNtZGA7XG4gKiAgMi4gc2F0dSBwcm9zZXMgYmVydGFoYW4gXHUyMTkyIHByZXNlbnRhc2kgYmlzYSBkaWJhbmd1biBiZXJ0YWhhcDtcbiAqICAzLiBgcmVuZGVyX3NsaWRlYCBtZW5nZW1iYWxpa2FuIFBORyBkYWxhbSByZXNwb25zIHlhbmcgc2FtYSBcdTIxOTIgcHJhdGluamF1XG4gKiAgICAgZGkgZGFsYW0gYnJvd3NlciB0YW5wYSBwZXJsdSBmaWxlIHNlbWVudGFyYS5cbiAqXG4gKiBCYXRhcyB5YW5nIGRpc2VuZ2FqYTogYnJpZGdlIGluaSBiZXJqYWxhbiBkaSBOb2RlIChidWthbiBicm93c2VyKSwgbWVtYWthaVxuICogYGNoaWxkX3Byb2Nlc3NgLiBEaXBha2FpIG9sZWggc2lzaSBzZXJ2ZXIvYWdlbiwgYnVrYW4gb2xlaCBidW5kZWwgYnJvd3Nlci5cbiAqL1xuaW1wb3J0IHsgc3Bhd24sIHR5cGUgQ2hpbGRQcm9jZXNzV2l0aG91dE51bGxTdHJlYW1zIH0gZnJvbSBcIm5vZGU6Y2hpbGRfcHJvY2Vzc1wiO1xuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyB0bXBkaXIgfSBmcm9tIFwibm9kZTpvc1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiO1xuXG4vKiogUGVyaW50YWggZW5naW5lIERlY2tDcmFmdCAoaWQgeWFuZyBkaXRlcmltYSBgYmF0Y2hgIGRhbiBgcnVuX2NvbW1hbmRgKS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGVja2NyYWZ0Q29tbWFuZCB7XG4gIGNvbW1hbmQ6IHN0cmluZztcbiAgcGFyYW1zPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIC8qKlxuICAgKiBJbmRla3Mgc2xpZGUgdGVtcGF0IHBlcmludGFoIGluaSBiZXJsYWt1ICgwLWJhc2VkKS5cbiAgICpcbiAgICogUGVyaW50YWggYGZvcm1hdC4qYCBkaSBlbmdpbmUgYmVrZXJqYSBwYWRhIFNFTEVDVElPTiBzbGlkZSBha3RpZiwgYnVrYW5cbiAgICogcGFkYSBpZCB5YW5nIGRpYmVyaS4gVGFucGEgaW5mb3JtYXNpIHNsaWRlLCBwZXJpbnRhaCBmb3JtYXQgYmlzYVxuICAgLy8gbWVuZW1wZWwga2Ugc2hhcGUgZGkgc2xpZGUgbGFpbi4gQnJpZGdlIG1lbWFrYWkgZmllbGQgaW5pIHVudHVrXG4gICAqIG1lbnlpc2lwa2FuIGBzbGlkZS5nb2AgeWFuZyB0ZXBhdCBzZWJlbHVtIHBlcmludGFoIGZvcm1hdC5cbiAgICovXG4gIHNsaWRlPzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERlY2tjcmFmdFNsaWRlIHtcbiAgaW5kZXg6IG51bWJlcjtcbiAgaWQ6IG51bWJlcjtcbiAgdGl0bGU6IHN0cmluZztcbiAgbGF5b3V0OiBzdHJpbmc7XG4gIHNoYXBlczogbnVtYmVyO1xuICBoaWRkZW46IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVja2NyYWZ0RGVjayB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIHRoZW1lOiBzdHJpbmc7XG4gIHNsaWRlU2l6ZTogW251bWJlciwgbnVtYmVyXTtcbiAgc2xpZGVzOiBEZWNrY3JhZnRTbGlkZVtdO1xufVxuXG5leHBvcnQgdHlwZSBEZWNrY3JhZnRTdGF0dXMgPSBcInNpYXBcIiB8IFwiYmVyamFsYW5cIiB8IFwiZ2FnYWxcIjtcblxuZXhwb3J0IGludGVyZmFjZSBEZWNrY3JhZnRJbmZvIHtcbiAgLyoqIFBhdGggYWJzb2x1dCBiaW5hcnkgZGVja2NyYWZ0LWNsaS4gKi9cbiAgYmluUGF0aDogc3RyaW5nO1xuICAvKiogVmVyc2kgeWFuZyBkaWxhcG9ya2FuIGJpbmFyeS4gKi9cbiAgdmVyc2k6IHN0cmluZztcbiAgLyoqIHRydWUgYmlsYSBiaW5hcnkgZGl0ZW11a2FuIGRhbiBiaXNhIGRpamFsYW5rYW4uICovXG4gIHRlcnNlZGlhOiBib29sZWFuO1xuICAvKiogVGVtYSB5YW5nIHRlcnNlZGlhIGRpIGJpbmFyeSB0ZXJzZWJ1dC4gKi9cbiAgdGVtYTogc3RyaW5nW107XG4gIC8qKiBQZXNhbiBlcnJvciB0ZXJha2hpciAoYmlsYSBhZGEpLiAqL1xuICBnYWxhdD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBMb2thc2kgZGVmYXVsdCBiaW5hcnkuIEJpc2EgZGlvdmVycmlkZSBsZXdhdCBlbnZpcm9ubWVudCBERUNLQ1JBRlRfQ0xJLlxuICpcbiAqIFRpYXAgcGxhdGZvcm0gcHVueWEgbmFtYSBmb2xkZXIgJiBuYW1hIGJlcmthcyBiZXJiZWRhOlxuICogICBXaW5kb3dzICB2ZW5kb3JzL2RlY2tjcmFmdC1iaW4vYXBwL2RlY2tjcmFmdC0wLjguMC13aW5kb3dzLXg2NC1wb3J0YWJsZS9kZWNrY3JhZnQtY2xpLmV4ZVxuICogICBMaW51eCAgICB2ZW5kb3JzL2RlY2tjcmFmdC1iaW4vYXBwL2RlY2tjcmFmdC0wLjguMC1saW51eC14ODZfNjQvYmluL2RlY2tjcmFmdC1jbGlcbiAqICAgbWFjT1MgICAgdmVuZG9ycy9kZWNrY3JhZnQtYmluL2FwcC9kZWNrY3JhZnQtY2xpLTAuOC4wLW1hY29zLXVuaXZlcnNhbC9kZWNrY3JhZnQtY2xpXG4gKlxuICogU2ViZWx1bW55YSBmdW5nc2kgaW5pIGhhbnlhIG1lbnVuanVrIGphbHVyIFdpbmRvd3MsIHNlaGluZ2dhIGluc3RhbGFzaVxuICogTGludXgvbWFjT1MgKHRlcm1hc3VrIGNvbnRhaW5lciBEb2NrZXIpIHNlbGFsdSBtZWxhcG9ya2FuIFwiYmluYXJ5IHRpZGFrXG4gKiBkaXRlbXVrYW5cIiBtZXNraSBiZXJrYXNueWEgYWRhLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVmYXVsdEJpblBhdGgoKTogc3RyaW5nIHtcbiAgY29uc3QgZGFyaUVudiA9IHByb2Nlc3MuZW52LkRFQ0tDUkFGVF9DTEk/LnRyaW0oKTtcbiAgaWYgKGRhcmlFbnYpIHJldHVybiBkYXJpRW52O1xuXG4gIGNvbnN0IGFrYXIgPSBwcm9jZXNzLmN3ZCgpO1xuICBjb25zdCBhcHAgPSBwYXRoLmpvaW4oYWthciwgXCJ2ZW5kb3JzXCIsIFwiZGVja2NyYWZ0LWJpblwiLCBcImFwcFwiKTtcblxuICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiKSB7XG4gICAgcmV0dXJuIHBhdGguam9pbihcbiAgICAgIGFwcCxcbiAgICAgIFwiZGVja2NyYWZ0LTAuOC4wLXdpbmRvd3MteDY0LXBvcnRhYmxlXCIsXG4gICAgICBcImRlY2tjcmFmdC1jbGkuZXhlXCIsXG4gICAgKTtcbiAgfVxuICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIikge1xuICAgIHJldHVybiBwYXRoLmpvaW4oXG4gICAgICBhcHAsXG4gICAgICBcImRlY2tjcmFmdC1jbGktMC44LjAtbWFjb3MtdW5pdmVyc2FsXCIsXG4gICAgICBcImRlY2tjcmFmdC1jbGlcIixcbiAgICApO1xuICB9XG4gIC8vIExpbnV4OiBhcnNpcCByZXNtaSBtZW5hcnVoIGJpbmFyeSBkaSBkYWxhbSBzdWJmb2xkZXIgYmluLy5cbiAgcmV0dXJuIHBhdGguam9pbihcbiAgICBhcHAsXG4gICAgXCJkZWNrY3JhZnQtMC44LjAtbGludXgteDg2XzY0XCIsXG4gICAgXCJiaW5cIixcbiAgICBcImRlY2tjcmFmdC1jbGlcIixcbiAgKTtcbn1cblxuLyoqXG4gKiBTYXR1IHBlcmludGFoIHlhbmcgZGlqYWxhbmthbiBsYWx1IHByb3NlcyBkaXR1dHVwLiBEaXBha2FpIHVudHVrXG4gKiBtZW1lcmlrc2Ega2V0ZXJzZWRpYWFuIGJpbmFyeSBkYW4gbWVtYmFjYSBkYWZ0YXIgdGVtYS5cbiAqL1xuZnVuY3Rpb24gamFsYW5rYW5TZWthbGkoXG4gIGJpblBhdGg6IHN0cmluZyxcbiAgYXJnczogc3RyaW5nW10sXG4gIGlucHV0Pzogc3RyaW5nLFxuKTogUHJvbWlzZTx7IGtvZGU6IG51bWJlcjsgc3Rkb3V0OiBzdHJpbmc7IHN0ZGVycjogc3RyaW5nIH0+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCBhbmFrID0gc3Bhd24oYmluUGF0aCwgYXJncywgeyBzdGRpbzogW1wicGlwZVwiLCBcInBpcGVcIiwgXCJwaXBlXCJdIH0pO1xuICAgIGxldCBzdGRvdXQgPSBcIlwiO1xuICAgIGxldCBzdGRlcnIgPSBcIlwiO1xuICAgIGFuYWsuc3Rkb3V0Lm9uKFwiZGF0YVwiLCAoZDogQnVmZmVyKSA9PiB7XG4gICAgICBzdGRvdXQgKz0gZC50b1N0cmluZyhcInV0ZjhcIik7XG4gICAgfSk7XG4gICAgYW5hay5zdGRlcnIub24oXCJkYXRhXCIsIChkOiBCdWZmZXIpID0+IHtcbiAgICAgIHN0ZGVyciArPSBkLnRvU3RyaW5nKFwidXRmOFwiKTtcbiAgICB9KTtcbiAgICBhbmFrLm9uKFwiZXJyb3JcIiwgKGUpID0+IHJlamVjdChlKSk7XG4gICAgYW5hay5vbihcImNsb3NlXCIsIChjb2RlKSA9PlxuICAgICAgcmVzb2x2ZSh7IGtvZGU6IGNvZGUgPz8gLTEsIHN0ZG91dCwgc3RkZXJyIH0pLFxuICAgICk7XG4gICAgaWYgKGlucHV0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFuYWsuc3RkaW4uZW5kKGlucHV0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgYW5hay5zdGRpbi5lbmQoKTtcbiAgICB9XG4gIH0pO1xufVxuXG4vKiogQW1iaWwgZGFmdGFyIHRlbWEgZGFyaSBiaW5hcnkgbGV3YXQgcGVyaW50YWggYGRlc2lnbi50aGVtZXNgLiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJhY2FUZW1hRGVja2NyYWZ0KFxuICBiaW5QYXRoID0gZGVmYXVsdEJpblBhdGgoKSxcbik6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgamFsYW5rYW5TZWthbGkoYmluUGF0aCwgW1xuICAgICAgXCJydW5cIixcbiAgICAgIFwiLS1jbWRcIixcbiAgICAgIFwiZGVzaWduLnRoZW1lc1wiLFxuICAgICAgXCItLXByaW50XCIsXG4gICAgICBcIi0tc2F2ZVwiLFxuICAgICAgcGF0aC5qb2luKHRtcGRpcigpLCBcImRlY2tjcmFmdC10ZW1hLmRlY2tjcmFmdFwiKSxcbiAgICBdKTtcbiAgICBjb25zdCBiYXJpcyA9IHN0ZG91dFxuICAgICAgLnNwbGl0KC9cXHI/XFxuLylcbiAgICAgIC5maW5kKChiKSA9PiBiLmluY2x1ZGVzKFwiZGVzaWduLnRoZW1lc1wiKSk7XG4gICAgaWYgKCFiYXJpcykgcmV0dXJuIFtdO1xuICAgIGNvbnN0IGpzb24gPSBiYXJpcy5zbGljZShiYXJpcy5pbmRleE9mKFwiXHUyMTkyXCIpICsgMSkudHJpbSgpO1xuICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGpzb24pIGFzIHtcbiAgICAgIHRoZW1lcz86IHsgbmFtZTogc3RyaW5nIH1bXTtcbiAgICAgIGNvbG9yU2NoZW1lcz86IHN0cmluZ1tdO1xuICAgIH07XG4gICAgY29uc3QgZGFyaVRlbWEgPSAoZGF0YS50aGVtZXMgPz8gW10pLm1hcCgodCkgPT4gdC5uYW1lKTtcbiAgICByZXR1cm4gZGFyaVRlbWEubGVuZ3RoID4gMCA/IGRhcmlUZW1hIDogKGRhdGEuY29sb3JTY2hlbWVzID8/IFtdKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG59XG5cbi8qKiBTdGF0dXMgRGVja0NyYWZ0IGRpIG1lc2luIGluaTogYmluYXJ5IGFkYT8gYmlzYSBkaWphbGFua2FuPyB2ZXJzaW55YSBiZXJhcGE/ICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcGVyaWtzYURlY2tjcmFmdChcbiAgYmluUGF0aCA9IGRlZmF1bHRCaW5QYXRoKCksXG4pOiBQcm9taXNlPERlY2tjcmFmdEluZm8+IHtcbiAgaWYgKCFleGlzdHNTeW5jKGJpblBhdGgpKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGJpblBhdGgsXG4gICAgICB2ZXJzaTogXCItXCIsXG4gICAgICB0ZXJzZWRpYTogZmFsc2UsXG4gICAgICB0ZW1hOiBbXSxcbiAgICAgIGdhbGF0OiBcIkJpbmFyeSBkZWNrY3JhZnQtY2xpIHRpZGFrIGRpdGVtdWthbi4gSmFsYW5rYW4gc2tyaXAgdmVuZG9yaW5nLlwiLFxuICAgIH07XG4gIH1cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCwgc3RkZXJyLCBrb2RlIH0gPSBhd2FpdCBqYWxhbmthblNla2FsaShiaW5QYXRoLCBbXCItLXZlcnNpb25cIl0pO1xuICAgIGlmIChrb2RlICE9PSAwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBiaW5QYXRoLFxuICAgICAgICB2ZXJzaTogXCItXCIsXG4gICAgICAgIHRlcnNlZGlhOiBmYWxzZSxcbiAgICAgICAgdGVtYTogW10sXG4gICAgICAgIGdhbGF0OiBzdGRlcnIudHJpbSgpIHx8IFwiZGVja2NyYWZ0LWNsaSBnYWdhbCBkaWphbGFua2FuLlwiLFxuICAgICAgfTtcbiAgICB9XG4gICAgY29uc3QgdmVyc2kgPSBzdGRvdXQudHJpbSgpIHx8IFwiLVwiO1xuICAgIGNvbnN0IHRlbWEgPSBhd2FpdCBiYWNhVGVtYURlY2tjcmFmdChiaW5QYXRoKTtcbiAgICByZXR1cm4geyBiaW5QYXRoLCB2ZXJzaSwgdGVyc2VkaWE6IHRydWUsIHRlbWEgfTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiB7XG4gICAgICBiaW5QYXRoLFxuICAgICAgdmVyc2k6IFwiLVwiLFxuICAgICAgdGVyc2VkaWE6IGZhbHNlLFxuICAgICAgdGVtYTogW10sXG4gICAgICBnYWxhdDogZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogXCJHYWdhbCBtZW5qYWxhbmthbiBkZWNrY3JhZnQtY2xpLlwiLFxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiBTZXNpIE1DUCB5YW5nIGJlcmphbGFuOiBzYXR1IHByb3NlcyBgZGVja2NyYWZ0LWNsaSBtY3BgLCBiYW55YWsgcGVyaW50YWguXG4gKiBTZW5nYWphIGRpdHVsaXMgc2ViYWdhaSBrZWxhcyBhZ2FyIHN0YXRlIHByZXNlbnRhc2kgYmVydGFoYW4gYW50YXIgcGFuZ2dpbGFuLlxuICovXG5leHBvcnQgY2xhc3MgRGVja2NyYWZ0U2Vzc2lvbiB7XG4gIHByaXZhdGUgYW5hazogQ2hpbGRQcm9jZXNzV2l0aG91dE51bGxTdHJlYW1zIHwgbnVsbCA9IG51bGw7XG4gIC8qKiBBbnRyZWFuIHNlcmlhbGl6ZTogc2F0dSBwZXJpbnRhaCBwYWRhIHNhdHUgd2FrdHUuICovXG4gIHByaXZhdGUgYW50cmVhbjogUHJvbWlzZTx2b2lkPiA9IFByb21pc2UucmVzb2x2ZSgpO1xuICBwcml2YXRlIHBlbmdoaXR1bmcgPSAwO1xuICBwcml2YXRlIGJ1ZmZlciA9IFwiXCI7XG4gIHByaXZhdGUgcGVudW5nZ3UgPSBuZXcgTWFwPFxuICAgIG51bWJlcixcbiAgICB7IHJlc29sdmU6ICh2OiB1bmtub3duKSA9PiB2b2lkOyByZWplY3Q6IChlOiBFcnJvcikgPT4gdm9pZCB9XG4gID4oKTtcblxuICBwcml2YXRlIHJlYWRvbmx5IGJpblBhdGg6IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSBha2FyS2VyamE6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICBjb25zdHJ1Y3RvcihiaW5QYXRoOiBzdHJpbmcgPSBkZWZhdWx0QmluUGF0aCgpLCBha2FyS2VyamE/OiBzdHJpbmcpIHtcbiAgICB0aGlzLmJpblBhdGggPSBiaW5QYXRoO1xuICAgIHRoaXMuYWthcktlcmphID0gYWthcktlcmphO1xuICB9XG5cbiAgZ2V0IGFrdGlmKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmFuYWsgIT09IG51bGw7XG4gIH1cblxuICAvKiogTXVsYWkgcHJvc2VzIE1DUCBkYW4gbGFrdWthbiBoYW5kc2hha2UuICovXG4gIGFzeW5jIG11bGFpKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLmFuYWspIHJldHVybjtcbiAgICBjb25zdCBhbmFrID0gc3Bhd24odGhpcy5iaW5QYXRoLCBbXCJtY3BcIl0sIHtcbiAgICAgIHN0ZGlvOiBbXCJwaXBlXCIsIFwicGlwZVwiLCBcInBpcGVcIl0sXG4gICAgICBjd2Q6IHRoaXMuYWthcktlcmphLFxuICAgIH0pO1xuICAgIHRoaXMuYW5hayA9IGFuYWs7XG4gICAgdGhpcy5idWZmZXIgPSBcIlwiO1xuICAgIGFuYWsuc3Rkb3V0LnNldEVuY29kaW5nKFwidXRmOFwiKTtcbiAgICBhbmFrLnN0ZG91dC5vbihcImRhdGFcIiwgKHBvdG9uZ2FuOiBzdHJpbmcpID0+IHRoaXMuc2VyYXAocG90b25nYW4pKTtcbiAgICBhbmFrLnN0ZGVyci5vbihcImRhdGFcIiwgKCkgPT4ge1xuICAgICAgLyogbG9nIHNlcnZlciBkaWFiYWlrYW46IHN0ZG91dCBhZGFsYWgga2FuYWwgcHJvdG9rb2wgKi9cbiAgICB9KTtcbiAgICBhbmFrLm9uKFwiY2xvc2VcIiwgKCkgPT4ge1xuICAgICAgdGhpcy5hbmFrID0gbnVsbDtcbiAgICAgIGZvciAoY29uc3QgeyByZWplY3QgfSBvZiB0aGlzLnBlbnVuZ2d1LnZhbHVlcygpKSB7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJQcm9zZXMgZGVja2NyYWZ0LWNsaSBiZXJoZW50aS5cIikpO1xuICAgICAgfVxuICAgICAgdGhpcy5wZW51bmdndS5jbGVhcigpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5raXJpbShcImluaXRpYWxpemVcIiwge1xuICAgICAgcHJvdG9jb2xWZXJzaW9uOiBcIjIwMjUtMDYtMThcIixcbiAgICAgIGNhcGFiaWxpdGllczoge30sXG4gICAgICBjbGllbnRJbmZvOiB7IG5hbWU6IFwibml0ei05MDlcIiwgdmVyc2lvbjogXCIxXCIgfSxcbiAgICB9KTtcbiAgICAvLyBOb3RpZmlrYXNpOiB0YW5wYSBpZCwgdGFucGEgYmFsYXNhbi5cbiAgICB0aGlzLnR1bGlzKHtcbiAgICAgIGpzb25ycGM6IFwiMi4wXCIsXG4gICAgICBtZXRob2Q6IFwibm90aWZpY2F0aW9ucy9pbml0aWFsaXplZFwiLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqIEhlbnRpa2FuIHByb3NlcyBkZW5nYW4gcmFwaS4gKi9cbiAgYXN5bmMgYmVyaGVudGkoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYW5hayA9IHRoaXMuYW5haztcbiAgICB0aGlzLmFuYWsgPSBudWxsO1xuICAgIGlmICghYW5haykgcmV0dXJuO1xuICAgIGFuYWsuc3RkaW4uZW5kKCk7XG4gICAgYW5hay5raWxsKCk7XG4gICAgZm9yIChjb25zdCB7IHJlamVjdCB9IG9mIHRoaXMucGVudW5nZ3UudmFsdWVzKCkpIHtcbiAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJTZXNpIGRlY2tjcmFmdCBkaXR1dHVwLlwiKSk7XG4gICAgfVxuICAgIHRoaXMucGVudW5nZ3UuY2xlYXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgc2VyYXAocG90b25nYW46IHN0cmluZykge1xuICAgIHRoaXMuYnVmZmVyICs9IHBvdG9uZ2FuO1xuICAgIGxldCBpZHggPSB0aGlzLmJ1ZmZlci5pbmRleE9mKFwiXFxuXCIpO1xuICAgIHdoaWxlIChpZHggPj0gMCkge1xuICAgICAgY29uc3QgYmFyaXMgPSB0aGlzLmJ1ZmZlci5zbGljZSgwLCBpZHgpLnRyaW0oKTtcbiAgICAgIHRoaXMuYnVmZmVyID0gdGhpcy5idWZmZXIuc2xpY2UoaWR4ICsgMSk7XG4gICAgICBpZiAoYmFyaXMpIHRoaXMudGFuZ2FuaShiYXJpcyk7XG4gICAgICBpZHggPSB0aGlzLmJ1ZmZlci5pbmRleE9mKFwiXFxuXCIpO1xuICAgIH1cbiAgICAvLyBEZWNrQ3JhZnQgbWVtYmF0YXNpIGJhbGFzYW4gMTYgTWlCIHBlciBiYXJpcyAodGVybWFzdWsgbmV3bGluZSkuXG4gICAgLy8gQmFyaXMgeWFuZyBtZWxlYmloaSBpdHUgYmVyYXJ0aSBwcm90b2tvbCBydXNhayBcdTIwMTQgc3RvcCBkYXJpcGFkYVxuICAgIC8vIG1lbnVtcHVrIGJ1ZmZlciB0YW5wYSBiYXRhcy5cbiAgICBpZiAodGhpcy5idWZmZXIubGVuZ3RoID4gMTYgKiAxMDI0ICogMTAyNCkge1xuICAgICAgdGhpcy5idWZmZXIgPSBcIlwiO1xuICAgICAgZm9yIChjb25zdCB7IHJlamVjdCB9IG9mIHRoaXMucGVudW5nZ3UudmFsdWVzKCkpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcIkJhbGFzYW4gZGVja2NyYWZ0IG1lbGViaWhpIGJhdGFzIDE2IE1pQi5cIikpO1xuICAgICAgfVxuICAgICAgdGhpcy5wZW51bmdndS5jbGVhcigpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdGFuZ2FuaShiYXJpczogc3RyaW5nKSB7XG4gICAgbGV0IHBlc2FuOiB7IGlkPzogbnVtYmVyOyByZXN1bHQ/OiB1bmtub3duOyBlcnJvcj86IHsgbWVzc2FnZT86IHN0cmluZyB9IH07XG4gICAgdHJ5IHtcbiAgICAgIHBlc2FuID0gSlNPTi5wYXJzZShiYXJpcykgYXMgdHlwZW9mIHBlc2FuO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHBlc2FuLmlkICE9PSBcIm51bWJlclwiKSByZXR1cm47XG4gICAgY29uc3QgdHVuZ2d1ID0gdGhpcy5wZW51bmdndS5nZXQocGVzYW4uaWQpO1xuICAgIGlmICghdHVuZ2d1KSByZXR1cm47XG4gICAgdGhpcy5wZW51bmdndS5kZWxldGUocGVzYW4uaWQpO1xuICAgIGlmIChwZXNhbi5lcnJvcikge1xuICAgICAgdHVuZ2d1LnJlamVjdChcbiAgICAgICAgbmV3IEVycm9yKHBlc2FuLmVycm9yLm1lc3NhZ2UgPz8gXCJLZXNhbGFoYW4gSlNPTi1SUEMgZGFyaSBkZWNrY3JhZnQuXCIpLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdHVuZ2d1LnJlc29sdmUocGVzYW4ucmVzdWx0KTtcbiAgfVxuXG4gIHByaXZhdGUgdHVsaXMocGVzYW46IHVua25vd24pIHtcbiAgICBpZiAoIXRoaXMuYW5haykgdGhyb3cgbmV3IEVycm9yKFwiU2VzaSBkZWNrY3JhZnQgYmVsdW0gZGltdWxhaS5cIik7XG4gICAgdGhpcy5hbmFrLnN0ZGluLndyaXRlKGAke0pTT04uc3RyaW5naWZ5KHBlc2FuKX1cXG5gKTtcbiAgfVxuXG4gIC8qKiBLaXJpbSBzYXR1IHBlcm1pbnRhYW4gSlNPTi1SUEMgZGFuIHR1bmdndSBiYWxhc2FubnlhLiAqL1xuICBwcml2YXRlIGtpcmltKG1ldGhvZDogc3RyaW5nLCBwYXJhbXM6IHVua25vd24pOiBQcm9taXNlPHVua25vd24+IHtcbiAgICBjb25zdCBpZCA9ICsrdGhpcy5wZW5naGl0dW5nO1xuICAgIGNvbnN0IGhhc2lsID0gbmV3IFByb21pc2U8dW5rbm93bj4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5wZW51bmdndS5zZXQoaWQsIHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgIH0pO1xuICAgIHRoaXMudHVsaXMoe1xuICAgICAganNvbnJwYzogXCIyLjBcIixcbiAgICAgIGlkLFxuICAgICAgbWV0aG9kLFxuICAgICAgcGFyYW1zOiBwYXJhbXMgPz8ge30sXG4gICAgfSk7XG4gICAgcmV0dXJuIGhhc2lsO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhbmdnaWwgdG9vbCBNQ1AuIEFudHJpYW4gZGkgc2VyaWFsa2FuIHN1cGF5YSBwZXJpbnRhaCB0aWRhayBzYWxpbmdcbiAgICogbWVuaW1wYSBzdGF0ZSBwcmVzZW50YXNpLlxuICAgKi9cbiAgYXN5bmMgcGFuZ2dpbChcbiAgICBuYW1hOiBzdHJpbmcsXG4gICAgYXJndW1lbjogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fSxcbiAgKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBqYWxhbiA9IHRoaXMuYW50cmVhbi50aGVuKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHRoaXMubXVsYWkoKTtcbiAgICAgIGNvbnN0IGJhbGFzYW4gPSAoYXdhaXQgdGhpcy5raXJpbShcInRvb2xzL2NhbGxcIiwge1xuICAgICAgICBuYW1lOiBuYW1hLFxuICAgICAgICBhcmd1bWVudHM6IGFyZ3VtZW4sXG4gICAgICB9KSkgYXMge1xuICAgICAgICBjb250ZW50PzogeyB0eXBlOiBzdHJpbmc7IHRleHQ/OiBzdHJpbmc7IGRhdGE/OiBzdHJpbmcgfVtdO1xuICAgICAgICBpc0Vycm9yPzogYm9vbGVhbjtcbiAgICAgIH07XG4gICAgICBjb25zdCB0ZWtzID0gKGJhbGFzYW4uY29udGVudCA/PyBbXSlcbiAgICAgICAgLmZpbHRlcigoYykgPT4gYy50eXBlID09PSBcInRleHRcIilcbiAgICAgICAgLm1hcCgoYykgPT4gYy50ZXh0ID8/IFwiXCIpXG4gICAgICAgIC5qb2luKFwiXFxuXCIpO1xuICAgICAgaWYgKGJhbGFzYW4uaXNFcnJvcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IodGVrcyB8fCBgVG9vbCBkZWNrY3JhZnQgXCIke25hbWF9XCIgZ2FnYWwuYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGVrcztcbiAgICB9KTtcbiAgICAvLyBBbnRyZWFuIHRldGFwIGJlcmphbGFuIG1lc2tpIHNhdHUgcGVyaW50YWggZ2FnYWwuXG4gICAgdGhpcy5hbnRyZWFuID0gamFsYW4udGhlbihcbiAgICAgICgpID0+IHVuZGVmaW5lZCxcbiAgICAgICgpID0+IHVuZGVmaW5lZCxcbiAgICApO1xuICAgIHJldHVybiBqYWxhbjtcbiAgfVxuXG4gIC8qKiBKYWxhbmthbiBzZWt1bXB1bGFuIHBlcmludGFoIGVuZ2luZSBkYWxhbSBzYXR1IGJhdGNoLiAqL1xuICBhc3luYyBqYWxhbmthbihwZXJpbnRhaDogRGVja2NyYWZ0Q29tbWFuZFtdKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBpZiAocGVyaW50YWgubGVuZ3RoID09PSAwKSByZXR1cm4gXCJcIjtcbiAgICByZXR1cm4gdGhpcy5wYW5nZ2lsKFwiYmF0Y2hcIiwge1xuICAgICAgY29tbWFuZHM6IHRoaXMucGVyaW50YWhLZUVuZ2luZShwZXJpbnRhaCksXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSmFsYW5rYW4gc2F0dSBwZXJpbnRhaCBlbmdpbmUgZGkgbHVhciBiYXRjaC5cbiAgICpcbiAgICogQmVyYmVkYSBkYXJpIGBwYW5nZ2lsYCAoeWFuZyBtZW1hbmdnaWwgTUNQIHRvb2wpLCBwZXJpbnRhaCBkaSBzaW5pIGFkYWxhaFxuICAgKiBFTkdJTkUgY29tbWFuZCAtIGVnLiBgc2xpZGUuZ29gLCBgc2xpZGUuaW5zcGVjdGAsIGBzaGFwZS5pbnNwZWN0YC4gTUNQXG4gICAqIHRvb2wgYHJ1bl9jb21tYW5kYCBtZW1hbmcgYmlzYSBtZW1hbmdnaWxueWEsIHRhcGkgYGJhdGNoYCBsZWJpaCBtdXJhaFxuICAgKiB1bnR1ayBkZXJldGFuIHBlcmludGFoIGJlcnVydXRhbi5cbiAgICovXG4gIGFzeW5jIGphbGFua2FuRW5naW5lKFxuICAgIHBlcmludGFoOiBzdHJpbmcsXG4gICAgcGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9LFxuICApOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiB0aGlzLnBhbmdnaWwoXCJydW5fY29tbWFuZFwiLCB7IGNvbW1hbmQ6IHBlcmludGFoLCBwYXJhbXMgfSk7XG4gIH1cblxuICAvKipcbiAgICogVWJhaCBkYWZ0YXIgcGVyaW50YWggbWVuamFkaSBiZW50dWsgeWFuZyBiaXNhIGRpa2lyaW0ga2UgZW5naW5lLlxuICAgKlxuICAgKiBQZXJpbnRhaCBgZm9ybWF0LipgIChkYW4gcGVyaW50YWggbGFpbiB5YW5nIGJlcmxha3UgcGFkYSBzZWxlY3Rpb24pXG4gICAqIGhhbnlhIGJlcmxha3UgcGFkYSBzbGlkZSBBS1RJRi4gS2FyZW5hIGl0dSwgc2ViZWx1bSBtZW5qYWxhbmthbiBwZXJpbnRhaFxuICAgKiBmb3JtYXQgcGFkYSBzbGlkZSB0ZXJ0ZW50dSwgYnJpZGdlIG1lbnlpc2lwa2FuIGBzbGlkZS5nbyB7aW5kZXh9YC5cbiAgICpcbiAgICogQnVrdGkgZW1waXJpcyAoRGVja0NyYWZ0IHYwLjguMCwgTUNQKTpcbiAgICogIC0gYGZvcm1hdC5mb250IHtmYW1pbHksIGlkczpbTl19YCBtZW5nYWJhaWthbiBgaWRzYDtcbiAgICogIC0gYGZvcm1hdC5mb250YCB0YW5wYSBzZWxlY3Rpb24gYWt0aWYgPSBuby1vcDtcbiAgICogIC0gYHNsaWRlLmdvIHtpbmRleH1gIG1lbWluZGFoa2FuIHNsaWRlIGFrdGlmLCBkYW4gc2VsZWN0aW9uIHNoYXBlIHBhZGFcbiAgICogICAgc2xpZGUgaXR1IG1lbmphZGkgdGFyZ2V0IHBlcmludGFoIGZvcm1hdC5cbiAgICovXG4gIHByaXZhdGUgcGVyaW50YWhLZUVuZ2luZShwZXJpbnRhaDogRGVja2NyYWZ0Q29tbWFuZFtdKToge1xuICAgIGNvbW1hbmQ6IHN0cmluZztcbiAgICBwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICB9W10ge1xuICAgIGNvbnN0IGhhc2lsOiB7IGNvbW1hbmQ6IHN0cmluZzsgcGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB9W10gPSBbXTtcbiAgICBsZXQgc2xpZGVBa3RpZjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IHAgb2YgcGVyaW50YWgpIHtcbiAgICAgIC8vIGBzbGlkZS5uZXdgIG1lbWluZGFoa2FuIHNsaWRlIGFrdGlmIHNlbmRpcmk7IGphbmdhbiBzZXQgc2xpZGUuZ29cbiAgICAgIC8vIHNlYmVsdW0tbnlhIGthcmVuYSBpbmRla3Mgc2xpZGUgYmFydSBiZWx1bSB0ZW50dSBzYW1hIGRlbmdhblxuICAgICAgLy8gdXJ1dGFuIHBlcmludGFoLlxuICAgICAgaWYgKHAuY29tbWFuZCA9PT0gXCJzbGlkZS5uZXdcIikge1xuICAgICAgICBoYXNpbC5wdXNoKHsgY29tbWFuZDogcC5jb21tYW5kLCBwYXJhbXM6IHAucGFyYW1zID8/IHt9IH0pO1xuICAgICAgICBzbGlkZUFrdGlmID0gbnVsbDtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIHAuc2xpZGUgPT09IFwibnVtYmVyXCIgJiYgcC5zbGlkZSAhPT0gc2xpZGVBa3RpZikge1xuICAgICAgICBoYXNpbC5wdXNoKHsgY29tbWFuZDogXCJzbGlkZS5nb1wiLCBwYXJhbXM6IHsgaW5kZXg6IHAuc2xpZGUgfSB9KTtcbiAgICAgICAgc2xpZGVBa3RpZiA9IHAuc2xpZGU7XG4gICAgICB9XG4gICAgICBoYXNpbC5wdXNoKHsgY29tbWFuZDogcC5jb21tYW5kLCBwYXJhbXM6IHAucGFyYW1zID8/IHt9IH0pO1xuICAgIH1cbiAgICByZXR1cm4gaGFzaWw7XG4gIH1cblxuICAvKiogQmFjYSByaW5na2FzYW4gcHJlc2VudGFzaSB5YW5nIGFrdGlmLiAqL1xuICBhc3luYyBwZXJpa3NhKCk6IFByb21pc2U8RGVja2NyYWZ0RGVjaz4ge1xuICAgIGNvbnN0IHRla3MgPSBhd2FpdCB0aGlzLnBhbmdnaWwoXCJpbnNwZWN0X2RvY3VtZW50XCIsIHt9KTtcbiAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZSh0ZWtzKSBhcyB7XG4gICAgICB0aXRsZT86IHN0cmluZztcbiAgICAgIHRoZW1lPzogc3RyaW5nO1xuICAgICAgc2xpZGVTaXplPzogW251bWJlciwgbnVtYmVyXTtcbiAgICAgIHNsaWRlcz86IHtcbiAgICAgICAgaW5kZXg6IG51bWJlcjtcbiAgICAgICAgaWQ6IG51bWJlcjtcbiAgICAgICAgdGl0bGU6IHN0cmluZztcbiAgICAgICAgbGF5b3V0OiBzdHJpbmc7XG4gICAgICAgIHNoYXBlczogbnVtYmVyO1xuICAgICAgICBoaWRkZW46IGJvb2xlYW47XG4gICAgICB9W107XG4gICAgfTtcbiAgICByZXR1cm4ge1xuICAgICAgdGl0bGU6IGRhdGEudGl0bGUgPz8gXCJcIixcbiAgICAgIHRoZW1lOiBkYXRhLnRoZW1lID8/IFwiXCIsXG4gICAgICBzbGlkZVNpemU6IGRhdGEuc2xpZGVTaXplID8/IFs5NjAsIDU0MF0sXG4gICAgICBzbGlkZXM6IChkYXRhLnNsaWRlcyA/PyBbXSkubWFwKChzKSA9PiAoe1xuICAgICAgICBpbmRleDogcy5pbmRleCxcbiAgICAgICAgaWQ6IHMuaWQsXG4gICAgICAgIHRpdGxlOiBzLnRpdGxlID8/IFwiXCIsXG4gICAgICAgIGxheW91dDogcy5sYXlvdXQgPz8gXCJcIixcbiAgICAgICAgc2hhcGVzOiBzLnNoYXBlcyA/PyAwLFxuICAgICAgICBoaWRkZW46ICEhcy5oaWRkZW4sXG4gICAgICB9KSksXG4gICAgfTtcbiAgfVxuXG4gIC8qKiBSZW5kZXIgc2F0dSBzbGlkZSBqYWRpIFBORyAoYmFzZTY0KSB1bnR1ayBwcmF0aW5qYXUgZGkgYnJvd3Nlci4gKi9cbiAgYXN5bmMgcmVuZGVyU2xpZGUoc2xpZGUgPSAwLCBza2FsYSA9IDEpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGJhbGFzYW4gPSAoYXdhaXQgdGhpcy5raXJpbVRvb2xNZW50YWgoXCJyZW5kZXJfc2xpZGVcIiwge1xuICAgICAgc2xpZGUsXG4gICAgICBzY2FsZTogc2thbGEsXG4gICAgfSkpIGFzIHsgY29udGVudD86IHsgdHlwZTogc3RyaW5nOyBkYXRhPzogc3RyaW5nIH1bXSB9O1xuICAgIGNvbnN0IGdhbWJhciA9IChiYWxhc2FuLmNvbnRlbnQgPz8gW10pLmZpbmQoKGMpID0+IGMudHlwZSA9PT0gXCJpbWFnZVwiKTtcbiAgICBpZiAoIWdhbWJhcj8uZGF0YSkge1xuICAgICAgLy8gQmVkYWthbiBkdWEgc2ViYWI6IHNsaWRlIGRpIGx1YXIgcmVudGFuZywgdnMgZGVjayBrb3NvbmcuXG4gICAgICBjb25zdCBqdW1sYWggPSBhd2FpdCB0aGlzLmhpdHVuZ1NsaWRlKCkuY2F0Y2goKCkgPT4gMCk7XG4gICAgICBpZiAoanVtbGFoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkRlY2tDcmFmdCB0aWRhayBwdW55YSBzbGlkZSB1bnR1ayBkaXJlbmRlci5cIik7XG4gICAgICB9XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBTbGlkZSAke3NsaWRlfSB0aWRhayBhZGEgKGRlY2sgYmVyaXNpICR7anVtbGFofSBzbGlkZSkuYCxcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBnYW1iYXIuZGF0YTtcbiAgfVxuXG4gIC8qKiBKdW1sYWggc2xpZGUgcGFkYSBwcmVzZW50YXNpIGFrdGlmICgwIGJpbGEgdGlkYWsgYWRhIGRlY2spLiAqL1xuICBwcml2YXRlIGFzeW5jIGhpdHVuZ1NsaWRlKCk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3QgdGVrcyA9IGF3YWl0IHRoaXMucGFuZ2dpbChcImluc3BlY3RfZG9jdW1lbnRcIiwge30pO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZSh0ZWtzKSBhcyB7IHNsaWRlcz86IHVua25vd25bXSB9O1xuICAgICAgcmV0dXJuIGRhdGEuc2xpZGVzPy5sZW5ndGggPz8gMDtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMga2lyaW1Ub29sTWVudGFoKFxuICAgIG5hbWE6IHN0cmluZyxcbiAgICBhcmd1bWVuOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgKTogUHJvbWlzZTx1bmtub3duPiB7XG4gICAgY29uc3QgamFsYW4gPSB0aGlzLmFudHJlYW4udGhlbihhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCB0aGlzLm11bGFpKCk7XG4gICAgICByZXR1cm4gdGhpcy5raXJpbShcInRvb2xzL2NhbGxcIiwgeyBuYW1lOiBuYW1hLCBhcmd1bWVudHM6IGFyZ3VtZW4gfSk7XG4gICAgfSk7XG4gICAgdGhpcy5hbnRyZWFuID0gamFsYW4udGhlbihcbiAgICAgICgpID0+IHVuZGVmaW5lZCxcbiAgICAgICgpID0+IHVuZGVmaW5lZCxcbiAgICApO1xuICAgIHJldHVybiBqYWxhbjtcbiAgfVxuXG4gIC8qKiBTaW1wYW4gcHJlc2VudGFzaSBrZSBwYXRoIHRlcnRlbnR1IChla3N0ZW5zaSBtZW5lbnR1a2FuIGZvcm1hdCkuICovXG4gIGFzeW5jIHNpbXBhbihwYXRoVHVqdWFuOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiB0aGlzLnBhbmdnaWwoXCJleHBvcnRcIiwgeyBwYXRoOiBwYXRoVHVqdWFuIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEVrc3BvciBkZWNrIGtlIGZvcm1hdCB0ZXJ0ZW50dSBsZXdhdCB0b29sIE1DUCBgZXhwb3J0YC5cbiAgICpcbiAgICogRm9ybWF0IHlhbmcgZGlkdWt1bmcgZW5naW5lIHYwLjguMDogcG5nLCBqcGVnLCBwcHR4LCBkZWNrY3JhZnQsIG91dGxpbmUsXG4gICAqIHBkZiwgZ2lmLiBFa3N0ZW5zaSBwYXRoIGhhcnVzIGNvY29rIGRlbmdhbiBmb3JtYXQgKGVuZ2luZSBtZW5vbGFrXG4gICAqIGtvbWJpbmFzaSB5YW5nIHRhayBrb25zaXN0ZW4pLlxuICAgKi9cbiAgYXN5bmMgZWtzcG9yKFxuICAgIHBhdGhUdWp1YW46IHN0cmluZyxcbiAgICBmb3JtYXQ6IFwicG5nXCIgfCBcImpwZWdcIiB8IFwicHB0eFwiIHwgXCJkZWNrY3JhZnRcIiB8IFwib3V0bGluZVwiIHwgXCJwZGZcIiB8IFwiZ2lmXCIsXG4gICAgb3BzaToge1xuICAgICAgLyoqIFNlbXVhIHNsaWRlICh1bnR1ayBnYW1iYXIpLiAqL1xuICAgICAgYWxsPzogYm9vbGVhbjtcbiAgICAgIC8qKiBJbmRla3Mgc2xpZGUgdHVuZ2dhbCAodW50dWsgZ2FtYmFyKS4gKi9cbiAgICAgIHNsaWRlPzogbnVtYmVyO1xuICAgICAgLyoqIFBpa3NlbCBwZXIgdGl0aWsgKHVudHVrIGdhbWJhcikuICovXG4gICAgICBzY2FsZT86IG51bWJlcjtcbiAgICAgIC8qKiBEZXRpayBwZXIgc2xpZGUgKEdJRikuICovXG4gICAgICBzZWNvbmRzUGVyU2xpZGU/OiBudW1iZXI7XG4gICAgICAvKiogUHV0YXIgR0lGIHNlbGFtYW55YS4gKi9cbiAgICAgIGxvb3A/OiBib29sZWFuO1xuICAgICAgLyoqIFRhdGEgbGV0YWsgaGFsYW1hbiBQREYuICovXG4gICAgICBsYXlvdXQ/OiBcInNsaWRlc1wiIHwgXCJub3Rlc1wiIHwgXCJoYW5kb3V0c1wiO1xuICAgIH0gPSB7fSxcbiAgKTogUHJvbWlzZTx7IHBhdGg/OiBzdHJpbmc7IGJ5dGVzPzogbnVtYmVyOyBmaWxlcz86IHN0cmluZ1tdIH0+IHtcbiAgICBjb25zdCB0ZWtzID0gYXdhaXQgdGhpcy5wYW5nZ2lsKFwiZXhwb3J0XCIsIHsgcGF0aDogcGF0aFR1anVhbiwgZm9ybWF0LCAuLi5vcHNpIH0pO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gSlNPTi5wYXJzZSh0ZWtzKSBhcyB7XG4gICAgICAgIHBhdGg/OiBzdHJpbmc7XG4gICAgICAgIGJ5dGVzPzogbnVtYmVyO1xuICAgICAgICBmaWxlcz86IHN0cmluZ1tdO1xuICAgICAgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVuZGVyIHNlbXVhIHNsaWRlIGphZGkgUE5HIChiYXNlNjQpIHVudHVrIGZpbG1zdHJpcCBwcmF0aW5qYXUuXG4gICAqXG4gICAqIFJlbmRlciBwZXItc2xpZGUgKGJ1a2FuIGBleHBvcnQgYWxsYCkga2FyZW5hIGhhc2lsbnlhIGxhbmdzdW5nIGphZGlcbiAgICogZGF0YS1VUkwgZGkgcmVzcG9ucyBKU09OLCB0YW5wYSBmaWxlIHNlbWVudGFyYSBkaSBzZXJ2ZXIuXG4gICAqL1xuICBhc3luYyByZW5kZXJTZW11YShcbiAgICBqdW1sYWhTbGlkZTogbnVtYmVyLFxuICAgIHNrYWxhID0gMC4zNSxcbiAgKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IGhhc2lsOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwganVtbGFoU2xpZGU7IGkrKykge1xuICAgICAgaGFzaWwucHVzaChhd2FpdCB0aGlzLnJlbmRlclNsaWRlKGksIHNrYWxhKSk7XG4gICAgfVxuICAgIHJldHVybiBoYXNpbDtcbiAgfVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxNUlBcXFxccHJveWVrIDIwMjZcXFxcTml0Wi05MDlcXFxcc3JjXFxcXGxpYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcTVJQXFxcXHByb3llayAyMDI2XFxcXE5pdFotOTA5XFxcXHNyY1xcXFxsaWJcXFxcZGVja2NyYWZ0LXBwdC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovTVJQL3Byb3llayUyMDIwMjYvTml0Wi05MDkvc3JjL2xpYi9kZWNrY3JhZnQtcHB0LnRzXCI7LyoqXG4gKiBLb252ZXJ0ZXIga29udGVuIE5pdFotOTA5IFx1MjE5MiBwZXJpbnRhaCBEZWNrQ3JhZnQuXG4gKlxuICogSXNpIGthbnZhcyBOaXRaLTkwOSAoYENvbnRlbnRCbG9ja1tdYCkgZGl0ZXJqZW1haGthbiBtZW5qYWRpIHVydXRhbiBwZXJpbnRhaFxuICogZW5naW5lIERlY2tDcmFmdC4gRHVhIGphbHVyIHRlcnNlZGlhOlxuICpcbiAqICAxLiBgYmxva0tlUGVyaW50YWhgIFx1MjAxNCBidWlsZCBla3NwbGlzaXQgcGVyIHNsaWRlLiBNZW1iZXJpIGtlbmRhbGkgcGVudWg6XG4gKiAgICAganVkdWwgc2xpZGUsIHRhYmVsLCBncmFmaWssIGdhbWJhciwgU21hcnRBcnQsIGNhdGF0YW4gcGVtYmljYXJhLlxuICogIDIuIGBibG9rS2VPdXRsaW5lYCBcdTIwMTQgbWFya2Rvd24gcmluZ2thcyB5YW5nIGRpc2VyYWhrYW4ga2UgYHNsaWRlLmZyb21PdXRsaW5lYC5cbiAqICAgICBDZXBhdCwgZGFuIERlY2tDcmFmdCB5YW5nIG1lbmF0YSBoaWVyYXJraSBidWxsZXQuXG4gKlxuICogQXR1cmFuIHRhdGEgbGV0YWsgbWVuZ2lrdXRpIHNsaWRlIDE2OjkgRGVja0NyYWZ0OiA5NjAgXHUwMEQ3IDU0MCBwdC5cbiAqIE1hcmdpbiBraXJpIDYwIHB0LCBsZWJhciBrb250ZW4gODQwIHB0LlxuICovXG5pbXBvcnQgdHlwZSB7XG4gIENoYXJ0QmxvY2ssXG4gIENvZGVCbG9jayxcbiAgQ29udGVudEJsb2NrLFxuICBEaWFncmFtQmxvY2ssXG4gIEltYWdlQmxvY2ssXG4gIExpc3RJdGVtLFxuICBUYWJsZUJsb2NrLFxufSBmcm9tIFwiLi4vdHlwZXNcIjtcbmltcG9ydCB0eXBlIHsgRGVja2NyYWZ0Q29tbWFuZCB9IGZyb20gXCIuL2RlY2tjcmFmdFwiO1xuXG4vKiogR2VvbWV0cmkgc2xpZGUgRGVja0NyYWZ0IDE2OjkgKHRpdGlrID0gMS83MiBpbmNpKS4gKi9cbmV4cG9ydCBjb25zdCBTTElERV9XID0gOTYwO1xuZXhwb3J0IGNvbnN0IFNMSURFX0ggPSA1NDA7XG5jb25zdCBNQVJHSU5fWCA9IDYwO1xuY29uc3QgS09OVEVOX1cgPSA4NDA7XG5cbi8qKiBUZW1hIERlY2tDcmFmdCB5YW5nIHRlcnNlZGlhIGRpIHYwLjguMC4gKi9cbmV4cG9ydCBjb25zdCBURU1BX0RFQ0tDUkFGVCA9IFtcbiAgXCJEZWNrQ3JhZnRcIixcbiAgXCJIYXJib3JcIixcbiAgXCJFbWJlclwiLFxuICBcIk1lYWRvd1wiLFxuICBcIk5vY3R1cm5lXCIsXG4gIFwiUGFwZXJcIixcbiAgXCJDb3JhbCBSZWVmXCIsXG4gIFwiU2xhdGVcIixcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCB0eXBlIFRlbWFEZWNrY3JhZnQgPSAodHlwZW9mIFRFTUFfREVDS0NSQUZUKVtudW1iZXJdO1xuXG4vKiogUGVtZXRhYW4gdGlwZSBncmFmaWsgTml0Wi05MDkgXHUyMTkyIHRpcGUgZ3JhZmlrIERlY2tDcmFmdC4gKi9cbmNvbnN0IFRJUEVfR1JBRklLOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBiYXI6IFwiY29sdW1uXCIsXG4gIGxpbmU6IFwibGluZVwiLFxuICBwaWU6IFwicGllXCIsXG4gIGFyZWE6IFwiYXJlYVwiLFxuICBzY2F0dGVyOiBcInNjYXR0ZXJcIixcbn07XG5cbi8qKlxuICogRm9udCBtb25vc3BhY2UgdW50dWsgYmxvayBrb2RlLlxuICpcbiAqIFBJTElIQU46IFwiTGliZXJhdGlvbiBNb25vXCIsIGJ1a2FuIFwiQ29uc29sYXNcIi5cbiAqXG4gKiBBbGFzYW5ueWEgKGJ1a2FuIHNlbGVyYSwgdGFwaSBoYXNpbCB1amkpOlxuICpcbiAqICAxLiAqKkxpc2Vuc2kuKiogTGliZXJhdGlvbiBNb25vIGFkYWxhaCBTSUwgT3BlbiBGb250IExpY2Vuc2UgZGFuXG4gKiAgICAgRElCVU5ERUwgZGkgZGFsYW0gYmluYXJ5IERlY2tDcmFmdC4gQ29uc29sYXMgYWRhbGFoIGZvbnQgTWljcm9zb2Z0IC1cbiAqICAgICBkYW4gRGVja0NyYWZ0IHNlbmRpcmkgbWVsYXJhbmcgYXNldCBNaWNyb3NvZnQgKEFHRU5UUy5tZCBcdTAwQTcxLjEpLlxuICpcbiAqICAyLiAqKktvbnNpc3RlbnNpIGxpbnRhcyBtZXNpbi4qKiBMaWJlcmF0aW9uIE1vbm8gc2VsYWx1IGFkYSBkaSBiaW5hcnlcbiAqICAgICBEZWNrQ3JhZnQsIGphZGkgaGFzaWwgcmVuZGVyIHNhbWEgZGkgbWVzaW4gbWFuYSBwdW4uIENvbnNvbGFzIGhhbnlhXG4gKiAgICAgYWRhIGRpIFdpbmRvd3MgZGVuZ2FuIGxpc2Vuc2kgTWljcm9zb2Z0OyBkaSBMaW51eC9tYWNPUyBlbmdpbmVcbiAqICAgICBtZW1ldGFrYW5ueWEga2Ugc3Vic3RpdHVzaSAtIGphZGkgbmFtYSBcIkNvbnNvbGFzXCIgeWFuZyB0ZXJjYXRhdCBkaVxuICogICAgIFBQVFggYmlzYSBiYWl0IFBvd2VyUG9pbnQgZGkgbWVzaW4gbGFpbi5cbiAqXG4gKiAgMy4gKipUZXJidWt0aSBkaXJlbmRlciwgYnVrYW4gZmFsbGJhY2suKiogRGl1amkgZGVuZ2FuIG1lbWJhbmRpbmdrYW5cbiAqICAgICBoYXNoIFBORyByZW5kZXIgdW50dWsgYmViZXJhcGEgbmFtYSBmb250OlxuICogICAgICAgTGliZXJhdGlvbiBNb25vICAtPiBoYXNoIEJFREEgZGFyaSBmb250IHRhayBkaWtlbmFsIChmYWxsYmFjaylcbiAqICAgICAgIENvbnNvbGFzICAgICAgICAgLT4gaGFzaCBCRURBIGp1Z2EgKGFkYSBkaSBtZXNpbiBpbmkpXG4gKiAgICAgICBEZWphVnUgU2FucyBNb25vLCBKZXRCcmFpbnMgTW9ubywgRmlyYSBDb2RlIC0+IGhhc2ggU0FNQSBkZW5nYW5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICBmb250IHRhayBkaWtlbmFsID0gRkFMTEJBQ0ssIHRhayBiZW5hci1iZW5hclxuICogICAgICAgICAgICAgICAgICAgICAgICAgIGRpcmVuZGVyLlxuICpcbiAqIENhdGF0YW46IERlY2tDcmFmdCBtZW1ldGFrYW4gXCJjb25zb2xhc1wiIGtlIFtcIkxpYmVyYXRpb24gTW9ub1wiLFxuICogXCJDb3VyaWVyIE5ld1wiLCBcIk1lbmxvXCIsIFwiQ291cmllclwiXSAoY3JhdGVzL2ZvbnRzL3NyYy9mb250ZGIucnMpLCBqYWRpXG4gKiBQUFRYIGJlci1mb250IENvbnNvbGFzIHB1biBiZXJha2hpciBkaWdhbWJhciBkZW5nYW4gTGliZXJhdGlvbiBNb25vIGRpXG4gKiBtZXNpbiB0YW5wYSBDb25zb2xhcyAtIHRhcGkgYmxvayBrb2RlIGRpIGRhbGFtIGRlY2sgaW5pIG1lbWFrYWkgbmFtYVxuICogeWFuZyBsYW5nc3VuZyBtZW51bmp1ayBmb250IGJlYmFzIGxpc2Vuc2lueWEuXG4gKi9cbmV4cG9ydCBjb25zdCBGT05UX0tPREUgPSBcIkxpYmVyYXRpb24gTW9ub1wiO1xuXG4vKipcbiAqIEZvbnQgY2FkYW5nYW4ga2FsYXUgbmFtYSB1dGFtYSB0YWsgZGl0ZW11a2FuLlxuICpcbiAqIFVydXRhbiBtZW5naWt1dGkgcGV0YSBzdWJzdGl0dXNpIGVuZ2luZTogTGliZXJhdGlvbiBNb25vIC0+IENvdXJpZXIgTmV3XG4gKiAtPiBNZW5sbyAtPiBDb3VyaWVyLiBTZW11YSBiZXJsaXNlbnNpIGJlYmFzIGF0YXUgc3VkYWggamFkaSBzdGFuZCBpbmR1c3RyaS5cbiAqL1xuZXhwb3J0IGNvbnN0IEZPTlRfS09ERV9DQURBTkdBTiA9IFtcIkNvdXJpZXIgTmV3XCIsIFwiTWVubG9cIiwgXCJDb3VyaWVyXCJdO1xuXG4vKipcbiAqIFVrdXJhbiBmb250IChwdCkgdW50dWsgdGVrcyBrb2RlIGRpIHNsaWRlLlxuICpcbiAqIFNsaWRlIERlY2tDcmFmdCAxNjo5IGxlYmFybnlhIDk2MCBwdCAoPSAxMywzIGluY2kpLCBqYWRpIHVrdXJhbiBjb21wYXJhYmxlXG4gKiBkZW5nYW4gc2xpZGUgUG93ZXJQb2ludCAxMywzIGluY2kuIEJvZHkgdGV4dCBwcmVzZW50YXNpIGJpYXNhbnlhIDE4LTI0IHB0O1xuICoga29kZSBzZWRpa2l0IGxlYmloIGtlY2lsIGthcmVuYSBsZWJpaCByYXBhdCwgdGFwaSAxMyBwdCB0ZXJsYWx1IGtlY2lsIHVudHVrXG4gKiBkaWJhY2EgZGFyaSBqYXVoLiAxNiBwdCBhZGFsYWggdGl0aWsgdGVuZ2FoIHlhbmcgdGVyYmFjYSBkaSBwcm95ZWt0b3IuXG4gKi9cbmV4cG9ydCBjb25zdCBVS1VSQU5fRk9OVF9LT0RFID0gMTg7XG5cbi8qKlxuICogTGViYXIgaW5kdXN0cmkgKGRhbGFtIGthcmFrdGVyKSB1bnR1ayBzYXR1IGJhcmlzIGtvZGUuXG4gKlxuICogRm9udCBtb25vc3BhY2UgcHVueWEgbGViYXIga2FyYWt0ZXIgdGV0YXAsIGphZGkgbGViYXIgYmFyaXMgYmlzYSBkaWhpdHVuZ1xuICogZGFyaSBqdW1sYWgga2FyYWt0ZXIuIDAsNjIgZW0gcGVyIGthcmFrdGVyIHVudHVrIExpYmVyYXRpb24gTW9ubyBwYWRhXG4gKiAxOCBwdCBcdTIyNDggMTEsMiBwdCBwZXIga2FyYWt0ZXIuXG4gKi9cbmNvbnN0IExFQkFSX0tBUkFLVEVSX1BUID0gMTEuMjtcblxuLyoqIExlYmFyIG1pbmltdW0gJiBtYWtzaW11bSB0ZXh0IGJveCBrb2RlIChwdCkuICovXG5jb25zdCBMRUJBUl9LT0RFX01JTiA9IDM2MDtcbmNvbnN0IExFQkFSX0tPREVfTUFYID0gS09OVEVOX1c7XG5cbi8qKlxuICogV2FybmEgdGVrcyBibG9rIGtvZGUuXG4gKlxuICogZ2VsYXAgZGkgYXRhcyBsYXRhciB0ZXJhbmcgLSBrb250cmFzIDE1LDg6MSwgamF1aCBkaSBhdGFzIGFtYmFuZyBBQVxuICogKDQsNToxKSB1bnR1ayB0ZWtzIGJpYXNhIGRhbiA3OjEgdW50dWsgdGVrcyBiZXNhci5cbiAqL1xuZXhwb3J0IGNvbnN0IFdBUk5BX1RFS1NUX0tPREUgPSBcIjExMTgyN1wiO1xuXG4vKipcbiAqIFdhcm5hIGxhdGFyIGJsb2sga29kZS5cbiAqXG4gKiBBYnUtYWJ1IG11ZGEsIGJ1a2FuIHB1dGloIG11cm5pOmxhdGFyIHB1dGloIGJpa2luIGJsb2sga29kZSBcInRlcmJlbmFtXCJcbiAqIGRpIHNsaWRlIHlhbmcgbGF0YXIgcHV0aWhueWEgc2FtYSwgc2VkYW5na2FuIGFidS1hYnUgbWVtYnVhdG55YSB0ZXJiYWNhXG4gKiBzZWJhZ2FpIGJsb2sgdGVycGlzYWggdGFucGEgaGFydXMgZ2FyaXMgdGViYWwuXG4gKi9cbmV4cG9ydCBjb25zdCBXQVJOQV9MQVRBUl9LT0RFID0gXCJFRUYwRjNcIjtcblxuLyoqIEdhcmlzIHRlcGkgYmxvayBrb2RlLiAqL1xuZXhwb3J0IGNvbnN0IFdBUk5BX0dBUklTX0tPREUgPSBcIkM4Q0RENFwiO1xuXG4vKipcbiAqIFBlcmludGFoIERlY2tDcmFmdCArIHNsaWRlIHRlbXBhdCBwZXJpbnRhaCBpdHUgYmVybGFrdS5cbiAqXG4gKiBQRU5USU5HIC0gaW5pbGFoIHlhbmcgbWVtYnVhdCBibG9rIGtvZGUgYmlzYSBiZXItZm9udCBtb25vc3BhY2UuXG4gKiBQZXJpbnRhaCBgZm9ybWF0LipgIChmb3JtYXQuZm9udCwgZm9ybWF0LnNpemUsIC4uLikgZGkgZW5naW5lIGJlcmxha3UgcGFkYVxuICogKipzZWxlY3Rpb24gc2FhdCBpbmkqKiwgYnVrYW4gcGFkYSBpZCB5YW5nIGRpYmVyaS4gSmFkaSBwZXJpbnRhaCBmb3JtYXRcbiAqIGhhcnVzIGRpamFsYW5rYW4gdGVwYXQgc2V0ZWxhaCBzaGFwZS1ueWEgZGlidWF0LCBwYWRhIHNsaWRlIHlhbmcgYmVuYXIuXG4gKlxuICogQnVrdGkgZW1waXJpcyAocHJvYmUgTUNQIHYwLjguMCk6XG4gKiAgLSBgZm9ybWF0LmZvbnQge2ZhbWlseSwgaWRzOltOXX1gIE1FTkdBQkFJS0FOIGBpZHNgOyBoYXNpbG55YSBudWxsIGRhblxuICogICAgc2hhcGUgdGFrIGJlcnViYWg7XG4gKiAgLSBgc2VsZWN0aW9uLnNlbGVjdCB7aWRzOltOXX1gIGxhbHUgYGZvcm1hdC5mb250YCAtPiBmb250IG1lbmVtcGVsO1xuICogIC0gYHNoYXBlLmluc3BlY3RgIGhhbnlhIG1lbmNhcmkgc2hhcGUgZGkgc2xpZGUgQUtUSUYgLT4gcGVybHUgYHNsaWRlLmdvYC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBEZWNrY3JhZnRQZXJpbnRhaCBleHRlbmRzIERlY2tjcmFmdENvbW1hbmQge1xuICAvKiogSW5kZWtzIHNsaWRlIHRlbXBhdCBwZXJpbnRhaCBpbmkgYmVybGFrdSAoMC1iYXNlZCkuICovXG4gIHNsaWRlPzogbnVtYmVyO1xufVxuXG4vKiogU2l0YXNpIERpYWdyYW0gKE1lcm1haWQpIHNlYmFnYWkgU21hcnRBcnQgcHJvc2VzIFx1MjAxNCBwYWRhbmFuIHZpc3VhbCB0ZXJkZWthdC4gKi9cbmZ1bmN0aW9uIHNtYXJ0QXJ0RGFyaURpYWdyYW0oYjogRGlhZ3JhbUJsb2NrKTogRGVja2NyYWZ0Q29tbWFuZCB8IG51bGwge1xuICBjb25zdCBzdW1iZXIgPSBiLnNvdXJjZSB8fCBcIlwiO1xuICBpZiAoIS8tLT4vLnRlc3Qoc3VtYmVyKSkgcmV0dXJuIG51bGw7XG4gIC8vIEt1bXB1bGthbiBzZWx1cnVoIGxhYmVsIG5vZGUgYmVydXJ1dGFuOiBBW1Jpc2V0XSAtLT4gQltEZXNhaW5dIC0tPiBDW1JpbGlzXS5cbiAgY29uc3QgbGFiZWwgPSBbLi4uc3VtYmVyLm1hdGNoQWxsKC9cXFsoW15cXF1dKylcXF0vZyldLm1hcCgobSkgPT4gbVsxXS50cmltKCkpO1xuICBjb25zdCB0YWhhcCA9IGxhYmVsLmxlbmd0aCA+IDAgPyBsYWJlbCA6IFtdO1xuICBpZiAodGFoYXAubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHtcbiAgICBjb21tYW5kOiBcImluc2VydC5zbWFydEFydFwiLFxuICAgIHBhcmFtczoge1xuICAgICAga2luZDogXCJwcm9jZXNzXCIsXG4gICAgICBpdGVtczogdGFoYXAsXG4gICAgICAvLyBUaWRhayBhZGEgYHJlY3RgOiBgaW5zZXJ0LnNtYXJ0QXJ0YCB0aWRhayBtZW5lcmltYW55YSBkYW4gbWVuZ2FiYWlrYW5ueWEuXG4gICAgICAvLyBTbWFydEFydCBkaXBvc2lzaWthbiBvdG9tYXRpcyBvbGVoIGVuZ2luZSAoMTAlXHUyMDEzOTAlIGxlYmFyIHNsaWRlLFxuICAgICAgLy8gMjglXHUyMDEzODglIHRpbmdnaSkgXHUyMDE0IGxpaGF0IGNyYXRlcy9lbmdpbmUvc3JjL2NtZC9zbWFydGFydC5ycy5cbiAgICB9LFxuICB9O1xufVxuXG4vKiogUmF0YWthbiBpdGVtIGxpc3QgKGJlcm5lc3RlZCkgbWVuamFkaSBiYXJpcyBiZXJ0aW5na2F0IChpbmRlbnQgPSB0YWIpLiAqL1xuZnVuY3Rpb24gbGlzdEtlQmFyaXMoXG4gIGl0ZW1zOiBMaXN0SXRlbVtdLFxuICBsZXZlbCA9IDAsXG4gIGtlbHVhcjogc3RyaW5nW10gPSBbXSxcbik6IHN0cmluZ1tdIHtcbiAgZm9yIChjb25zdCBpdCBvZiBpdGVtcykge1xuICAgIGtlbHVhci5wdXNoKGAke1wiXFx0XCIucmVwZWF0KGxldmVsKX0ke2l0LnRleHR9YCk7XG4gICAgaWYgKGl0LmNoaWxkcmVuPy5sZW5ndGgpIGxpc3RLZUJhcmlzKGl0LmNoaWxkcmVuLCBsZXZlbCArIDEsIGtlbHVhcik7XG4gIH1cbiAgcmV0dXJuIGtlbHVhcjtcbn1cblxuLyoqXG4gKiBUZXJqZW1haGthbiBzZWx1cnVoIGthbnZhcyBtZW5qYWRpIHBlcmludGFoIERlY2tDcmFmdC5cbiAqXG4gKiBTdHJhdGVnaTogYmxvayBgaGVhZGluZ2AgZGVuZ2FuIGxldmVsIFx1MjI2NCAyIG1lbmphZGkgcGVtaXNhaCBzbGlkZTsgYmxvayBsYWluXG4gKiBkaWtlbG9tcG9ra2FuIHBlciBzbGlkZS4gVGFiZWwsIGdyYWZpaywgZ2FtYmFyLCBkYW4gZGlhZ3JhbSBtZW5kYXBhdCBzbGlkZVxuICogc2VuZGlyaSBrYXJlbmEgbWFzaW5nLW1hc2luZyBidXR1aCBhcmVhIGdhbWJhciBwZW51aC5cbiAqXG4gKiBTZXRpYXAgcGVyaW50YWggbWVtYmF3YSBgc2xpZGVgID0gaW5kZWtzIHNsaWRlIHRlbXBhdCBpYSBiZXJsYWt1LCBrYXJlbmFcbiAqIHBlcmludGFoIGBmb3JtYXQuKmAgZGkgZW5naW5lIGJla2VyamEgcGFkYSBzZWxlY3Rpb24gc2xpZGUgQUtUSUYuIFRhbnBhXG4gKiBpbmZvcm1hc2kgaXR1LCBibG9rIGtvZGUgdGFrIGJpc2EgZGliZXJpIGZvbnQgbW9ub3NwYWNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYmxva0tlUGVyaW50YWgoXG4gIGJsb2NrczogQ29udGVudEJsb2NrW10sXG4gIG9wdGlvbnM6IHtcbiAgICBqdWR1bD86IHN0cmluZztcbiAgICB0ZW1hPzogc3RyaW5nO1xuICAgIC8qKiBTaXNpcGthbiBzbGlkZSBzYW1wdWwgZGkgZnJvbnQuICovXG4gICAgc2FtcHVsPzogYm9vbGVhbjtcbiAgfSA9IHt9LFxuKTogRGVja2NyYWZ0UGVyaW50YWhbXSB7XG4gIGNvbnN0IHBlcmludGFoOiBEZWNrY3JhZnRQZXJpbnRhaFtdID0gW107XG4gIGNvbnN0IHRlbWEgPSBvcHRpb25zLnRlbWEgfHwgXCJTbGF0ZVwiO1xuXG4gIGlmIChvcHRpb25zLnNhbXB1bCAmJiBvcHRpb25zLmp1ZHVsKSB7XG4gICAgcGVyaW50YWgucHVzaCh7XG4gICAgICBjb21tYW5kOiBcImZpbGUubmV3XCIsXG4gICAgICBwYXJhbXM6IHsgdGhlbWU6IHRlbWEsIGJsYW5rOiB0cnVlIH0sXG4gICAgfSk7XG4gICAgcGVyaW50YWgucHVzaCh7XG4gICAgICBjb21tYW5kOiBcInNsaWRlLm5ld1wiLFxuICAgICAgcGFyYW1zOiB7XG4gICAgICAgIGxheW91dDogXCJ0aXRsZU9ubHlcIixcbiAgICAgICAgdGl0bGU6IG9wdGlvbnMuanVkdWwsXG4gICAgICB9LFxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIC8vIGBmaWxlLm5ld2AgbWVtYnVrYSBwcmVzZW50YXNpIGtvc29uZzsgYGRlc2lnbi50aGVtZWAgYmFydSBzYWggc2V0ZWxhaCBpdHUuXG4gICAgcGVyaW50YWgucHVzaCh7XG4gICAgICBjb21tYW5kOiBcImZpbGUubmV3XCIsXG4gICAgICBwYXJhbXM6IHsgdGhlbWU6IHRlbWEsIGJsYW5rOiB0cnVlIH0sXG4gICAgfSk7XG4gIH1cblxuICAvLyBKdWR1bCBwcmVzZW50YXNpIHNlYmFnYWkgcHJvcGVydGkgYmVya2FzLlxuICBpZiAob3B0aW9ucy5qdWR1bCkge1xuICAgIHBlcmludGFoLnB1c2goe1xuICAgICAgY29tbWFuZDogXCJmaWxlLnByb3BlcnRpZXNcIixcbiAgICAgIHBhcmFtczogeyB0aXRsZTogb3B0aW9ucy5qdWR1bCwgYXV0aG9yOiBcIk5pdFotOTA5XCIgfSxcbiAgICB9KTtcbiAgfVxuICAvLyBNb2RlbCB0YXRhIGxldGFrOiBzZXRpYXAgc2xpZGUgbWVtYWthaSBsYXlvdXQgYHRpdGxlT25seWAgKGhhbnlhIGp1ZHVsKSxcbiAgLy8gbGFsdSBpc2lhbiBkaXRhbWJhaGthbiBzZWJhZ2FpIHRleHQgYm94IC8gdGFiZWwgLyBncmFmaWsgZGVuZ2FuIGtvb3JkaW5hdFxuICAvLyBla3NwbGlzaXQuIEFsYXNhbm55YTogbGF5b3V0IGB0aXRsZUFuZENvbnRlbnRgIG1lbmFydWggdGVrcyBkaSBwbGFjZWhvbGRlclxuICAvLyB5YW5nIHBvc2lzaW55YSB0aWRhayBiaXNhIGRpa29udHJvbCwgc2VoaW5nZ2EgaXNpYW4gYmVydHVtcHVrIGRlbmdhblxuICAvLyBwbGFjZWhvbGRlci4gRGVuZ2FuIGB0aXRsZU9ubHlgIHNlbXVhIGlzaSBiaXNhIGRpdGVtcGF0a2FuIHRlcGF0LlxuICBsZXQgc2xpZGVCYXJ1OiBEZWNrY3JhZnRQZXJpbnRhaFtdID0gW107XG4gIC8qKiBKdWR1bCBoZWFkaW5nIHlhbmcgbWVudW5nZ3UgaXNpIChiZWx1bSBqYWRpIHNsaWRlKS4gKi9cbiAgbGV0IGp1ZHVsTWVudW5nZ3UgPSBvcHRpb25zLmp1ZHVsIHx8IFwiTWF0ZXJpXCI7XG4gIC8qKiBJc2kgc2xpZGUgYmVyamFsYW4gc3VkYWggdGVyaXNpIGF0YXUgYmVsdW0uICovXG4gIGxldCBzbGlkZVRlcmlzaSA9IGZhbHNlO1xuICAvKiogS3Vyc29yIHZlcnRpa2FsOiBwb3Npc2kgdGV4dCBib3ggYmVyaWt1dG55YSwgZGFsYW0gcHQuICovXG4gIGxldCBrdXJzb3JZID0gMTQwO1xuXG4gIGNvbnN0IGZsdXNoU2xpZGUgPSAoKSA9PiB7XG4gICAgaWYgKHNsaWRlQmFydS5sZW5ndGggPiAwKSB7XG4gICAgICBwZXJpbnRhaC5wdXNoKC4uLnNsaWRlQmFydSk7XG4gICAgfVxuICAgIHNsaWRlQmFydSA9IFtdO1xuICAgIHNsaWRlVGVyaXNpID0gZmFsc2U7XG4gICAga3Vyc29yWSA9IDE0MDtcbiAgfTtcblxuICAvKiogTXVsYWkgc2xpZGUgYmFydSBkZW5nYW4gbGF5b3V0IGB0aXRsZU9ubHlgLiAqL1xuICBjb25zdCBtdWxhaVNsaWRlID0gKGp1ZHVsOiBzdHJpbmcpID0+IHtcbiAgICBmbHVzaFNsaWRlKCk7XG4gICAgc2xpZGVCYXJ1ID0gW1xuICAgICAgeyBjb21tYW5kOiBcInNsaWRlLm5ld1wiLCBwYXJhbXM6IHsgbGF5b3V0OiBcInRpdGxlT25seVwiLCB0aXRsZToganVkdWwgfSB9LFxuICAgIF07XG4gICAgc2xpZGVUZXJpc2kgPSBmYWxzZTtcbiAgICBrdXJzb3JZID0gMTQwO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUYW1iYWhrYW4gYmxvayB0ZWtzLiBUZWtzIGJlcmJhcmlzIGJhbnlhayAocGFyYWdyYWYgcGFuamFuZywgYnVsbGV0KVxuICAgKiBkaWxldGFra2FuIGRhbGFtIHNhdHUgdGV4dCBib3ggYWdhciByYXBpLlxuICAgKi9cbiAgY29uc3QgdGFtYmFoVGVrcyA9ICh0ZWtzOiBzdHJpbmcsIG9wc2k6IHsgYnVsbGV0PzogYm9vbGVhbiB9ID0ge30pID0+IHtcbiAgICBpZiAoc2xpZGVCYXJ1Lmxlbmd0aCA9PT0gMCkgbXVsYWlTbGlkZShqdWR1bE1lbnVuZ2d1KTtcbiAgICBjb25zdCBiYXJpcyA9IHRla3Muc3BsaXQoXCJcXG5cIik7XG4gICAgY29uc3QgdGluZ2dpID0gTWF0aC5taW4oTWF0aC5tYXgoYmFyaXMubGVuZ3RoICogMjYsIDM0KSwgMzAwKTtcbiAgICBzbGlkZUJhcnUucHVzaCh7XG4gICAgICBjb21tYW5kOiBcImluc2VydC50ZXh0Qm94XCIsXG4gICAgICBwYXJhbXM6IHsgcmVjdDogW01BUkdJTl9YLCBrdXJzb3JZLCBLT05URU5fVywgdGluZ2dpXSwgdGV4dDogdGVrcyB9LFxuICAgIH0pO1xuICAgIGlmIChvcHNpLmJ1bGxldCkge1xuICAgICAgc2xpZGVCYXJ1LnB1c2goe1xuICAgICAgICBjb21tYW5kOiBcImZvcm1hdC5idWxsZXRzXCIsXG4gICAgICAgIHBhcmFtczogeyBvbjogdHJ1ZSwgY2hhcjogXCJcdTIwMjJcIiB9LFxuICAgICAgfSk7XG4gICAgfVxuICAgIGt1cnNvclkgKz0gdGluZ2dpICsgMTY7XG4gICAgc2xpZGVUZXJpc2kgPSB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTbGlkZSB1bnR1ayBvYmplayBiZXNhciAodGFiZWwvZ3JhZmlrL2dhbWJhci9kaWFncmFtKTogbGF5b3V0IGB0aXRsZU9ubHlgXG4gICAqIHN1cGF5YSBhcmVhIG9iamVrIG1lbWFrYWkgbGViYXIgcGVudWguIEthbGF1IHNsaWRlIGJlcmphbGFuIG1hc2loIGtvc29uZyxcbiAgICogb2JqZWsgbWFzdWsga2Ugc2xpZGUgaXR1OyBrYWxhdSBzdWRhaCB0ZXJpc2ksIHNsaWRlIGJhcnUgZGlidWF0LlxuICAgKi9cbiAgY29uc3QgbXVsYWlTbGlkZU9iamVrID0gKGp1ZHVsOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoc2xpZGVCYXJ1Lmxlbmd0aCA9PT0gMCB8fCBzbGlkZVRlcmlzaSkge1xuICAgICAgZmx1c2hTbGlkZSgpO1xuICAgICAgc2xpZGVCYXJ1ID0gW1xuICAgICAgICB7IGNvbW1hbmQ6IFwic2xpZGUubmV3XCIsIHBhcmFtczogeyBsYXlvdXQ6IFwidGl0bGVPbmx5XCIsIHRpdGxlOiBqdWR1bCB9IH0sXG4gICAgICBdO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTbGlkZSBiZXJqYWxhbiBtYXNpaCBrb3Nvbmc6IGdhbnRpIGxheW91dC1ueWEgamFkaSB0aXRsZU9ubHkuXG4gICAgICBzbGlkZUJhcnUgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICBjb21tYW5kOiBcInNsaWRlLm5ld1wiLFxuICAgICAgICAgIHBhcmFtczogeyBsYXlvdXQ6IFwidGl0bGVPbmx5XCIsIHRpdGxlOiBqdWR1bCB9LFxuICAgICAgICB9LFxuICAgICAgXTtcbiAgICB9XG4gICAgc2xpZGVUZXJpc2kgPSB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUYW1iYWhrYW4gYmxvayBrb2RlOiB0ZXh0IGJveCBkZW5nYW4gZm9udCBtb25vc3BhY2UsIGxhdGFyLCBkYW4gZ2FyaXMuXG4gICAqXG4gICAqIFBlcmludGFobnlhIGhhcnVzIGJlcnVydXRhbjogYGluc2VydC50ZXh0Qm94YCAtPiBgZm9ybWF0LmZvbnRgIC0+XG4gICAqIGBmb3JtYXQuc2l6ZWAgLT4gYHNoYXBlLmZpbGxgIC0+IGBzaGFwZS5saW5lYC4gU2VtdWFueWEgYmVybGFrdSBwYWRhXG4gICAqIHNlbGVjdGlvbiwgZGFuIHNoYXBlIGJhcnUgb3RvbWF0aXMgamFkaSBzZWxlY3Rpb24uXG4gICAqL1xuICBjb25zdCB0YW1iYWhLb2RlID0gKGI6IENvZGVCbG9jaykgPT4ge1xuICAgIGlmIChzbGlkZUJhcnUubGVuZ3RoID09PSAwKSBtdWxhaVNsaWRlKGp1ZHVsTWVudW5nZ3UpO1xuICAgIGNvbnN0IGJhcmlzID0gYi5jb2RlLnNwbGl0KFwiXFxuXCIpO1xuICAgIC8vIFRpbmdnaSBtZW5naWt1dGkganVtbGFoIGJhcmlzLCBkZW5nYW4gcnVhbmcgZXh0cmEgc3VwYXlhIGJsb2sgdGFrXG4gICAgLy8gdGVybGloYXQgXCJwZW51aFwiIGRpIHNsaWRlLiBCYXRhcyBhdGFzIDM0MCBwdCAoNjMlIHRpbmdnaSBzbGlkZSkuXG4gICAgY29uc3QgdGluZ2dpID0gTWF0aC5taW4oTWF0aC5tYXgoYmFyaXMubGVuZ3RoICogMjYgKyAyOCwgNzIpLCAzNDApO1xuICAgIC8vIExlYmFyIG1lbmdpa3V0aSBiYXJpcyB0ZXJwYW5qYW5nOiB0ZXh0IGJveCBzZWxlYmFyIHNsaWRlIHVudHVrIGtvZGVcbiAgICAvLyAzIGJhcmlzIHBlbmRlayB0ZXJsaWhhdCByYXBpIGtvc29uZy4gS2FyYWt0ZXIgbW9ub3NwYWNlIHB1bnlhIGxlYmFyXG4gICAgLy8gdGV0YXAsIGphZGkgaW5pIGJpc2EgZGloaXR1bmcuXG4gICAgY29uc3Qga2FyYWt0ZXJUZXJwYW5qYW5nID0gYmFyaXMucmVkdWNlKFxuICAgICAgKG1ha3MsIGIyKSA9PiBNYXRoLm1heChtYWtzLCBiMi5sZW5ndGgpLFxuICAgICAgMCxcbiAgICApO1xuICAgIGNvbnN0IGxlYmFySWRlYWwgPSBrYXJha3RlclRlcnBhbmphbmcgKiBMRUJBUl9LQVJBS1RFUl9QVCArIDM2O1xuICAgIGNvbnN0IGxlYmFyID0gTWF0aC5taW4oTWF0aC5tYXgobGViYXJJZGVhbCwgTEVCQVJfS09ERV9NSU4pLCBMRUJBUl9LT0RFX01BWCk7XG4gICAgc2xpZGVCYXJ1LnB1c2goe1xuICAgICAgY29tbWFuZDogXCJpbnNlcnQudGV4dEJveFwiLFxuICAgICAgcGFyYW1zOiB7XG4gICAgICAgIHJlY3Q6IFtNQVJHSU5fWCwga3Vyc29yWSwgbGViYXIsIHRpbmdnaV0sXG4gICAgICAgIHRleHQ6IGIuY29kZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgc2xpZGVCYXJ1LnB1c2goe1xuICAgICAgY29tbWFuZDogXCJmb3JtYXQuZm9udFwiLFxuICAgICAgcGFyYW1zOiB7IGZhbWlseTogRk9OVF9LT0RFIH0sXG4gICAgfSk7XG4gICAgc2xpZGVCYXJ1LnB1c2goe1xuICAgICAgY29tbWFuZDogXCJmb3JtYXQuc2l6ZVwiLFxuICAgICAgcGFyYW1zOiB7IHNpemU6IFVLVVJBTl9GT05UX0tPREUgfSxcbiAgICB9KTtcbiAgICAvLyBXYXJuYSB0ZWtzIGVrc3BsaXNpdDogdGFucGEgaW5pLCB0ZWtzIGtvZGUgbWVtYWthaSB3YXJuYSB0ZWtzIHRlbWEsXG4gICAgLy8geWFuZyBkaSBzbGlkZSB0ZXJhbmcgYmlzYSBqYWRpIHRlcmxhbHUgdGVyYW5nIGRpIGF0YXMgbGF0YXIgYWJ1LWFidS5cbiAgICBzbGlkZUJhcnUucHVzaCh7XG4gICAgICBjb21tYW5kOiBcImZvcm1hdC5jb2xvclwiLFxuICAgICAgcGFyYW1zOiB7IGNvbG9yOiBXQVJOQV9URUtTVF9LT0RFIH0sXG4gICAgfSk7XG4gICAgc2xpZGVCYXJ1LnB1c2goe1xuICAgICAgY29tbWFuZDogXCJzaGFwZS5maWxsXCIsXG4gICAgICBwYXJhbXM6IHsgY29sb3I6IFdBUk5BX0xBVEFSX0tPREUgfSxcbiAgICB9KTtcbiAgICBzbGlkZUJhcnUucHVzaCh7XG4gICAgICBjb21tYW5kOiBcInNoYXBlLmxpbmVcIixcbiAgICAgIHBhcmFtczogeyBjb2xvcjogV0FSTkFfR0FSSVNfS09ERSwgd2lkdGg6IDEgfSxcbiAgICB9KTtcbiAgICBrdXJzb3JZICs9IHRpbmdnaSArIDE2O1xuICAgIHNsaWRlVGVyaXNpID0gdHJ1ZTtcbiAgfTtcblxuICBmb3IgKGNvbnN0IGIgb2YgYmxvY2tzKSB7XG4gICAgc3dpdGNoIChiLnR5cGUpIHtcbiAgICAgIGNhc2UgXCJoZWFkaW5nXCI6IHtcbiAgICAgICAgaWYgKGIubGV2ZWwgPD0gMikge1xuICAgICAgICAgIC8vIEhlYWRpbmcgbWVuamFkaSBwZW1pc2FoIHNsaWRlOiBmbHVzaCBpc2kgc2ViZWx1bW55YSwgc2ltcGFuIGp1ZHVsLlxuICAgICAgICAgIGZsdXNoU2xpZGUoKTtcbiAgICAgICAgICBqdWR1bE1lbnVuZ2d1ID0gYi50ZXh0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRhbWJhaFRla3MoYi50ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY2FzZSBcInBhcmFncmFwaFwiOiB7XG4gICAgICAgIHRhbWJhaFRla3MoYi50ZXh0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNhc2UgXCJsaXN0XCI6IHtcbiAgICAgICAgY29uc3QgaXNpID0gbGlzdEtlQmFyaXMoYi5pdGVtcyk7XG4gICAgICAgIGlmIChpc2kubGVuZ3RoID09PSAwKSBicmVhaztcbiAgICAgICAgaWYgKHNsaWRlQmFydS5sZW5ndGggPT09IDApIG11bGFpU2xpZGUoanVkdWxNZW51bmdndSk7XG4gICAgICAgIGNvbnN0IHRpbmdnaSA9IE1hdGgubWluKGlzaS5sZW5ndGggKiAyNiwgMzAwKTtcbiAgICAgICAgc2xpZGVCYXJ1LnB1c2goe1xuICAgICAgICAgIGNvbW1hbmQ6IFwiaW5zZXJ0LnRleHRCb3hcIixcbiAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIHJlY3Q6IFtNQVJHSU5fWCwga3Vyc29yWSwgS09OVEVOX1csIHRpbmdnaV0sXG4gICAgICAgICAgICB0ZXh0OiBpc2kuam9pbihcIlxcblwiKSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgc2xpZGVCYXJ1LnB1c2goe1xuICAgICAgICAgIGNvbW1hbmQ6IFwiZm9ybWF0LmJ1bGxldHNcIixcbiAgICAgICAgICBwYXJhbXM6IHsgb246IHRydWUsIGNoYXI6IFwiXHUyMDIyXCIgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGt1cnNvclkgKz0gdGluZ2dpICsgMTY7XG4gICAgICAgIHNsaWRlVGVyaXNpID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNhc2UgXCJ0YWJsZVwiOiB7XG4gICAgICAgIGNvbnN0IHQgPSBiIGFzIFRhYmxlQmxvY2s7XG4gICAgICAgIC8vIFRhYmVsIG1lbmRhcGF0IHNsaWRlIHBlbnVoOiBsYXlvdXQgdGl0bGVPbmx5IHN1cGF5YSB0YWJlbCBwdW55YVxuICAgICAgICAvLyBhcmVhIHdpZGVzdCBwb3NzaWJsZSwgZGFuIGp1ZHVsIHNsaWRlIG1lbWFrYWkgaGVhZGluZyB0ZXJha2hpci5cbiAgICAgICAgbXVsYWlTbGlkZU9iamVrKGp1ZHVsTWVudW5nZ3UgfHwgb3B0aW9ucy5qdWR1bCB8fCBcIlRhYmVsXCIpO1xuICAgICAgICBzbGlkZUJhcnUucHVzaCh7XG4gICAgICAgICAgY29tbWFuZDogXCJpbnNlcnQudGFibGVcIixcbiAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIHJvd3M6IHQucm93cy5sZW5ndGggKyAxLFxuICAgICAgICAgICAgY29sczogdC5oZWFkZXJzLmxlbmd0aCxcbiAgICAgICAgICAgIGRhdGE6IFt0LmhlYWRlcnMsIC4uLnQucm93c10sXG4gICAgICAgICAgICByZWN0OiBbTUFSR0lOX1gsIDE1MCwgS09OVEVOX1csIDMwMF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIFwiY2hhcnRcIjoge1xuICAgICAgICBjb25zdCBjID0gYiBhcyBDaGFydEJsb2NrO1xuICAgICAgICBtdWxhaVNsaWRlT2JqZWsoanVkdWxNZW51bmdndSB8fCBvcHRpb25zLmp1ZHVsIHx8IFwiR3JhZmlrXCIpO1xuICAgICAgICBzbGlkZUJhcnUucHVzaCh7XG4gICAgICAgICAgY29tbWFuZDogXCJpbnNlcnQuY2hhcnRcIixcbiAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIHR5cGU6IFRJUEVfR1JBRklLW2MuY2hhcnRUeXBlXSA/PyBcImNvbHVtblwiLFxuICAgICAgICAgICAgY2F0ZWdvcmllczogYy5kYXRhLmxhYmVscyxcbiAgICAgICAgICAgIHNlcmllczogYy5kYXRhLmRhdGFzZXRzLm1hcCgoZCkgPT4gKHtcbiAgICAgICAgICAgICAgbmFtZTogZC5sYWJlbCxcbiAgICAgICAgICAgICAgdmFsdWVzOiBkLmRhdGEsXG4gICAgICAgICAgICB9KSksXG4gICAgICAgICAgICByZWN0OiBbTUFSR0lOX1gsIDE0MCwgS09OVEVOX1csIDMzMF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIFwiaW1hZ2VcIjoge1xuICAgICAgICBjb25zdCBnID0gYiBhcyBJbWFnZUJsb2NrO1xuICAgICAgICBtdWxhaVNsaWRlT2JqZWsoanVkdWxNZW51bmdndSB8fCBvcHRpb25zLmp1ZHVsIHx8IFwiR2FtYmFyXCIpO1xuICAgICAgICBpZiAoL15kYXRhOmltYWdlXFwvL2kudGVzdChnLnNyYykpIHtcbiAgICAgICAgICBjb25zdCBkYXRhID0gZy5zcmMuc3BsaXQoXCIsXCIpWzFdID8/IFwiXCI7XG4gICAgICAgICAgc2xpZGVCYXJ1LnB1c2goe1xuICAgICAgICAgICAgY29tbWFuZDogXCJpbnNlcnQucGljdHVyZVwiLFxuICAgICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgIG5hbWU6IGcuYWx0IHx8IFwiZ2FtYmFyXCIsXG4gICAgICAgICAgICAgIHJlY3Q6IFtNQVJHSU5fWCwgMTQwLCBLT05URU5fVywgMzAwXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gVVJMIHJlbW90ZSB0aWRhayBiaXNhIGRpc2FsaW4gRGVja0NyYWZ0IHRhbnBhIHVuZHVoYW47IHBha2FpIGtldGVyYW5nYW4uXG4gICAgICAgICAgc2xpZGVCYXJ1LnB1c2goe1xuICAgICAgICAgICAgY29tbWFuZDogXCJpbnNlcnQudGV4dEJveFwiLFxuICAgICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICAgIHJlY3Q6IFtNQVJHSU5fWCwgMjAwLCBLT05URU5fVywgMTIwXSxcbiAgICAgICAgICAgICAgdGV4dDogZy5jYXB0aW9uIHx8IGcuYWx0IHx8IFwiR2FtYmFyXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIFwiZGlhZ3JhbVwiOiB7XG4gICAgICAgIGNvbnN0IHNtYXJ0ID0gc21hcnRBcnREYXJpRGlhZ3JhbShiIGFzIERpYWdyYW1CbG9jayk7XG4gICAgICAgIG11bGFpU2xpZGVPYmplayhqdWR1bE1lbnVuZ2d1IHx8IG9wdGlvbnMuanVkdWwgfHwgXCJEaWFncmFtXCIpO1xuICAgICAgICBpZiAoc21hcnQpIHtcbiAgICAgICAgICBzbGlkZUJhcnUucHVzaChzbWFydCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2xpZGVCYXJ1LnB1c2goe1xuICAgICAgICAgICAgY29tbWFuZDogXCJpbnNlcnQudGV4dEJveFwiLFxuICAgICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICAgIHJlY3Q6IFtNQVJHSU5fWCwgMTUwLCBLT05URU5fVywgMzAwXSxcbiAgICAgICAgICAgICAgdGV4dDogKGIgYXMgRGlhZ3JhbUJsb2NrKS5zb3VyY2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIFwiY29kZVwiOiB7XG4gICAgICAgIHRhbWJhaEtvZGUoYiBhcyBDb2RlQmxvY2spO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY2FzZSBcImRpdmlkZXJcIjoge1xuICAgICAgICAvLyBQZXJpbnRhaG55YSBgc2hhcGUuaW5zZXJ0YCAoYnVrYW4gYGluc2VydC5zaGFwZWApIFx1MjAxNCBsaWhhdFxuICAgICAgICAvLyBgZGVja2NyYWZ0LWNsaSBjb21tYW5kc2AuXG4gICAgICAgIHNsaWRlQmFydS5wdXNoKHtcbiAgICAgICAgICBjb21tYW5kOiBcInNoYXBlLmluc2VydFwiLFxuICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgcHJlc2V0OiBcImxpbmVcIixcbiAgICAgICAgICAgIHJlY3Q6IFtNQVJHSU5fWCwgMzAwLCBLT05URU5fVywgMl0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgZmx1c2hTbGlkZSgpO1xuXG4gIC8vIEtlbG9tcG9ra2FuIHBlcmludGFoIHBlciBzbGlkZTogc2VidWFoIGBzbGlkZS5uZXdgIG1lbWJ1a2Egc2xpZGUsIGRhblxuICAvLyBwZXJpbnRhaCBzZXN1ZGFobnlhIG1lbmdpc2lueWEuIFNsaWRlIHRhbnBhIHBlbmdpc2kgZGlidWFuZyBrYXJlbmEgaGFueWFcbiAgLy8gbWVuZ2hhc2lsa2FuIGhhbGFtYW4ga29zb25nLlxuICAvL1xuICAvLyBTZXRpYXAgcGVyaW50YWgganVnYSBkaWJlcmkgbm9tb3Igc2xpZGUgKGBzbGlkZWApLCBrYXJlbmEgcGVyaW50YWhcbiAgLy8gYGZvcm1hdC4qYCBiZXJsYWt1IHBhZGEgc2VsZWN0aW9uIHNsaWRlIEFLVElGLiBUYW5wYSBub21vciBpbmksIGJsb2sga29kZVxuICAvLyB5YW5nIGFkbWlyZS1mb250IGhhcnVzIGRpamFsYW5rYW4gZGkgc2xpZGUgeWFuZyBiZW5hciAtIGthbGF1IHRpZGFrLCBmb250XG4gIC8vIHRlbXBlbGFuIGtlIHNsaWRlIGxhaW4gZGFuIGJsb2sga29kZSB0YW1waWwgZGVuZ2FuIGZvbnQgYmlhc2EuXG4gIGNvbnN0IHByZWFtYmxlOiBEZWNrY3JhZnRQZXJpbnRhaFtdID0gW107XG4gIGNvbnN0IGdyb3Vwczoge1xuICAgIHNsaWRlOiBEZWNrY3JhZnRQZXJpbnRhaDtcbiAgICBpc2k6IERlY2tjcmFmdFBlcmludGFoW107XG4gIH1bXSA9IFtdO1xuICBsZXQgc2VrYXJhbmc6ICh0eXBlb2YgZ3JvdXBzKVtudW1iZXJdIHwgbnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBwIG9mIHBlcmludGFoKSB7XG4gICAgaWYgKHAuY29tbWFuZCA9PT0gXCJzbGlkZS5uZXdcIikge1xuICAgICAgc2VrYXJhbmcgPSB7IHNsaWRlOiBwLCBpc2k6IFtdIH07XG4gICAgICBncm91cHMucHVzaChzZWthcmFuZyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKCFzZWthcmFuZykge1xuICAgICAgcHJlYW1ibGUucHVzaChwKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBzZWthcmFuZy5pc2kucHVzaChwKTtcbiAgfVxuXG4gIC8vIE5vbW9yIHNsaWRlIGRpaGl0dW5nIHNldGVsYWggc2xpZGUga29zb25nIGRpYnVhbmcsIHN1cGF5YSBub21vcm55YSBzYW1hXG4gIC8vIGRlbmdhbiBpbmRla3Mgc2xpZGUgc3VuZ2d1aGFuIGRpIGRlY2sgaGFzaWwgYnVpbGQuXG4gIGNvbnN0IHBlcmludGFoQmVyc2loOiBEZWNrY3JhZnRQZXJpbnRhaFtdID0gWy4uLnByZWFtYmxlXTtcbiAgbGV0IG5vbW9yU2xpZGUgPSAwO1xuICBmb3IgKGNvbnN0IGcgb2YgZ3JvdXBzKSB7XG4gICAgaWYgKGcuaXNpLmxlbmd0aCA9PT0gMCkgY29udGludWU7XG4gICAgcGVyaW50YWhCZXJzaWgucHVzaCh7IC4uLmcuc2xpZGUsIHNsaWRlOiBub21vclNsaWRlIH0pO1xuICAgIGZvciAoY29uc3QgaXNpIG9mIGcuaXNpKSB7XG4gICAgICBwZXJpbnRhaEJlcnNpaC5wdXNoKHsgLi4uaXNpLCBzbGlkZTogbm9tb3JTbGlkZSB9KTtcbiAgICB9XG4gICAgbm9tb3JTbGlkZSArPSAxO1xuICB9XG5cbiAgLy8gS2FsYXUgdGlkYWsgYWRhIHNsaWRlIHNhbWEgc2VrYWxpLCBidWF0IHNhdHUgc2xpZGUgcmluZ2thcy5cbiAgY29uc3QgYWRhU2xpZGUgPSBwZXJpbnRhaEJlcnNpaC5zb21lKChwKSA9PiBwLmNvbW1hbmQgPT09IFwic2xpZGUubmV3XCIpO1xuICBpZiAoIWFkYVNsaWRlKSB7XG4gICAgcGVyaW50YWhCZXJzaWgucHVzaCh7XG4gICAgICBjb21tYW5kOiBcInNsaWRlLm5ld1wiLFxuICAgICAgcGFyYW1zOiB7XG4gICAgICAgIGxheW91dDogXCJ0aXRsZU9ubHlcIixcbiAgICAgICAgdGl0bGU6IG9wdGlvbnMuanVkdWwgfHwgXCJQcmVzZW50YXNpIE5pdFotOTA5XCIsXG4gICAgICB9LFxuICAgICAgc2xpZGU6IDAsXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gcGVyaW50YWhCZXJzaWg7XG59XG5cbi8qKlxuICogVmVyc2kgbWFya2Rvd24gcmluZ2thcyB1bnR1ayBgc2xpZGUuZnJvbU91dGxpbmVgLiBEaXBha2FpIHNlYmFnYWkgamFsdXJcbiAqIGNlcGF0IHNhYXQgcGVuZ2d1bmEgaGFueWEgYnV0dWggZGVjayBiZXJ0aXRlbCArIGJ1bGxldC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJsb2tLZU91dGxpbmUoYmxvY2tzOiBDb250ZW50QmxvY2tbXSk6IHN0cmluZyB7XG4gIGNvbnN0IGJhcmlzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IGIgb2YgYmxvY2tzKSB7XG4gICAgc3dpdGNoIChiLnR5cGUpIHtcbiAgICAgIGNhc2UgXCJoZWFkaW5nXCI6XG4gICAgICAgIC8vIExldmVsIGhlYWRpbmcgZGlwZXJ0YWhhbmthbiBhZ2FyIGhpZXJhcmtpIG1hcmtkb3duIHRldGFwIHV0dWg6XG4gICAgICAgIC8vIERlY2tDcmFmdCBtZW1ha2FpIGAjYCB1bnR1ayBzbGlkZSBkYW4gYCMjYCB1bnR1ayBzdWItYmFnaWFuLlxuICAgICAgICBpZiAoYi5sZXZlbCA8PSAzKSBiYXJpcy5wdXNoKGAke1wiI1wiLnJlcGVhdChiLmxldmVsKX0gJHtiLnRleHR9YCk7XG4gICAgICAgIGVsc2UgYmFyaXMucHVzaChgLSAke2IudGV4dH1gKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwicGFyYWdyYXBoXCI6XG4gICAgICAgIGJhcmlzLnB1c2goYi50ZXh0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwibGlzdFwiOlxuICAgICAgICBmb3IgKGNvbnN0IGl0IG9mIGIuaXRlbXMpIGJhcmlzLnB1c2goYC0gJHtpdC50ZXh0fWApO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJ0YWJsZVwiOlxuICAgICAgICBiYXJpcy5wdXNoKGAtICR7Yi5oZWFkZXJzLmpvaW4oXCIgfCBcIil9YCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImNoYXJ0XCI6XG4gICAgICAgIGJhcmlzLnB1c2goYC0gR3JhZmlrICR7Yi5jaGFydFR5cGV9OiAke2IuZGF0YS5sYWJlbHMuam9pbihcIiwgXCIpfWApO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJpbWFnZVwiOlxuICAgICAgICBiYXJpcy5wdXNoKGAtICR7Yi5jYXB0aW9uIHx8IGIuYWx0IHx8IFwiR2FtYmFyXCJ9YCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImRpYWdyYW1cIjpcbiAgICAgICAgYmFyaXMucHVzaChgLSBEaWFncmFtYCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImNvZGVcIjpcbiAgICAgICAgYmFyaXMucHVzaChcIi0gS29kZVwiKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwiZGl2aWRlclwiOlxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYmFyaXMuam9pbihcIlxcblwiKTtcbn0iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXE1SUFxcXFxwcm95ZWsgMjAyNlxcXFxOaXRaLTkwOVxcXFxzZXJ2ZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXE1SUFxcXFxwcm95ZWsgMjAyNlxcXFxOaXRaLTkwOVxcXFxzZXJ2ZXJcXFxcZGVja2NyYWZ0LWFwaS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovTVJQL3Byb3llayUyMDIwMjYvTml0Wi05MDkvc2VydmVyL2RlY2tjcmFmdC1hcGkudHNcIjsvKipcbiAqIFNlcnZlciBBUEkgRGVja0NyYWZ0IHVudHVrIE5pdFotOTA5LlxuICpcbiAqIEJlcmphbGFuIHNlYmFnYWkgbWlkZGxld2FyZSBWaXRlIChtb2RlIGRldikgYXRhdSBzZWJhZ2FpIHNlcnZlciBOb2RlXG4gKiBtYW5kaXJpIChtb2RlIHByb2R1a3NpKS4gTWVueWVkaWFrYW46XG4gKlxuICogICBHRVQgIC9hcGkvZGVja2NyYWZ0L3N0YXR1cyAgICAgICAgICAgIFx1MjE5MiB2ZXJzaSwga2V0ZXJzZWRpYWFuLCBkYWZ0YXIgdGVtYVxuICogICBQT1NUIC9hcGkvZGVja2NyYWZ0L2J1aWxkICAgICAgICAgICAgXHUyMTkyIGJ1aWxkIGRlY2sgZGFyaSBDb250ZW50QmxvY2tbXVxuICogICBQT1NUIC9hcGkvZGVja2NyYWZ0L2V4cG9ydCAgICAgICAgICAgIFx1MjE5MiBidWlsZCArIHNpbXBhbiBQUFRYLCBrZW1iYWxpa2FuIGZpbGVcbiAqICAgR0VUICAvYXBpL2RlY2tjcmFmdC9wcmV2aWV3P3NsaWRlPU4gICBcdTIxOTIgUE5HIHNsaWRlIChiYXNlNjQgSlNPTilcbiAqICAgR0VUICAvYXBpL2RlY2tjcmFmdC9maWxtc3RyaXAgICAgICAgICBcdTIxOTIgUE5HIHNlbXVhIHNsaWRlIChiYXNlNjQgSlNPTilcbiAqICAgUE9TVCAvYXBpL2RlY2tjcmFmdC9leHBvcnQtZm9ybWF0ICAgICBcdTIxOTIgYnVpbGQgKyBla3Nwb3IgUERGL0dJRi9QUFRYXG4gKlxuICogU2VzaSBEZWNrQ3JhZnQgZGlwYWthaSBiZXJzYW1hIGFudGFyIHBlcm1pbnRhYW46IHNhdHUgcHJvc2VzIE1DUCwgZGVja1xuICogZGliYW5ndW4gdWxhbmcgdGlhcCBrYWxpIGBidWlsZGAgZGlwYW5nZ2lsLlxuICovXG5pbXBvcnQgdHlwZSB7IEluY29taW5nTWVzc2FnZSwgU2VydmVyUmVzcG9uc2UgfSBmcm9tIFwibm9kZTpodHRwXCI7XG5pbXBvcnQgeyBta2R0ZW1wU3luYywgcmVhZEZpbGVTeW5jLCBybVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgdG1wZGlyIH0gZnJvbSBcIm5vZGU6b3NcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7XG4gIERlY2tjcmFmdFNlc3Npb24sXG4gIHBlcmlrc2FEZWNrY3JhZnQsXG4gIHR5cGUgRGVja2NyYWZ0RGVjayxcbn0gZnJvbSBcIi4uL3NyYy9saWIvZGVja2NyYWZ0LnRzXCI7XG5pbXBvcnQge1xuICBibG9rS2VQZXJpbnRhaCxcbiAgVEVNQV9ERUNLQ1JBRlQsXG59IGZyb20gXCIuLi9zcmMvbGliL2RlY2tjcmFmdC1wcHQudHNcIjtcbmltcG9ydCB0eXBlIHsgQ29udGVudEJsb2NrIH0gZnJvbSBcIi4uL3NyYy90eXBlcy9pbmRleC50c1wiO1xuXG4vKiogQmF0YXMgdWt1cmFuIGJvZHkgSlNPTiAocGVybWludGFhbiBidWlsZCBiaXNhIGJlc2FyKS4gKi9cbmNvbnN0IEJBVEFTX0JPRFkgPSA4ICogMTAyNCAqIDEwMjQ7XG5cbmludGVyZmFjZSBQZXJtaW50YWFuQnVpbGQge1xuICBibG9ja3M6IENvbnRlbnRCbG9ja1tdO1xuICBqdWR1bD86IHN0cmluZztcbiAgdGVtYT86IHN0cmluZztcbn1cblxuLyoqIEZvcm1hdCBla3Nwb3IgeWFuZyBkaWR1a3VuZyBlbmdpbmUgRGVja0NyYWZ0IHYwLjguMC4gKi9cbnR5cGUgRm9ybWF0RWtzcG9yID0gXCJwcHR4XCIgfCBcInBkZlwiIHwgXCJnaWZcIjtcblxuLyoqIFBldGEgZm9ybWF0IFx1MjE5MiBla3N0ZW5zaSBiZXJrYXMgZGFuIE1JTUUgSFRUUC4gKi9cbmNvbnN0IEZPUk1BVF9FS1NQT1I6IFJlY29yZDxcbiAgRm9ybWF0RWtzcG9yLFxuICB7IGVrc3RlbnNpOiBzdHJpbmc7IG1pbWU6IHN0cmluZyB9XG4+ID0ge1xuICBwcHR4OiB7XG4gICAgZWtzdGVuc2k6IFwicHB0eFwiLFxuICAgIG1pbWU6IFwiYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnByZXNlbnRhdGlvbm1sLnByZXNlbnRhdGlvblwiLFxuICB9LFxuICBwZGY6IHsgZWtzdGVuc2k6IFwicGRmXCIsIG1pbWU6IFwiYXBwbGljYXRpb24vcGRmXCIgfSxcbiAgZ2lmOiB7IGVrc3RlbnNpOiBcImdpZlwiLCBtaW1lOiBcImltYWdlL2dpZlwiIH0sXG59O1xuXG5pbnRlcmZhY2UgU2VzaVRlcmJ1a2Ege1xuICBzZXNpOiBEZWNrY3JhZnRTZXNzaW9uO1xuICBkZWNrOiBEZWNrY3JhZnREZWNrO1xufVxuXG5sZXQgc2VzaVRlcmJ1a2E6IFNlc2lUZXJidWthIHwgbnVsbCA9IG51bGw7XG5sZXQgaW5mb0RlY2tjcmFmdDogQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBwZXJpa3NhRGVja2NyYWZ0Pj4gfCBudWxsID0gbnVsbDtcblxuLyoqIEJhY2EgYm9keSBIVFRQIHNlYmFnYWkgdGVrcyAoZGVuZ2FuIGJhdGFzIHVrdXJhbikuICovXG5mdW5jdGlvbiBiYWNhQm9keShyZXE6IEluY29taW5nTWVzc2FnZSk6IFByb21pc2U8c3RyaW5nPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgbGV0IGRhdGEgPSBcIlwiO1xuICAgIGxldCB1a3VyYW4gPSAwO1xuICAgIHJlcS5vbihcImRhdGFcIiwgKHBvdG9uZ2FuOiBCdWZmZXIpID0+IHtcbiAgICAgIHVrdXJhbiArPSBwb3Rvbmdhbi5sZW5ndGg7XG4gICAgICBpZiAodWt1cmFuID4gQkFUQVNfQk9EWSkge1xuICAgICAgICByZWplY3QobmV3IEVycm9yKFwiQmFkYW4gcGVybWludGFhbiB0ZXJsYWx1IGJlc2FyLlwiKSk7XG4gICAgICAgIHJlcS5kZXN0cm95KCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGRhdGEgKz0gcG90b25nYW4udG9TdHJpbmcoXCJ1dGY4XCIpO1xuICAgIH0pO1xuICAgIHJlcS5vbihcImVuZFwiLCAoKSA9PiByZXNvbHZlKGRhdGEpKTtcbiAgICByZXEub24oXCJlcnJvclwiLCByZWplY3QpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24ga2lyaW1Kc29uKHJlczogU2VydmVyUmVzcG9uc2UsIGtvZGU6IG51bWJlciwgZGF0YTogdW5rbm93bikge1xuICBjb25zdCBiYWRhbiA9IEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuICByZXMud3JpdGVIZWFkKGtvZGUsIHtcbiAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLThcIixcbiAgICBcIkNvbnRlbnQtTGVuZ3RoXCI6IEJ1ZmZlci5ieXRlTGVuZ3RoKGJhZGFuKSxcbiAgICBcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1zdG9yZVwiLFxuICB9KTtcbiAgcmVzLmVuZChiYWRhbik7XG59XG5cbi8qKlxuICogQmFuZ3VuIGRlY2sgZGFyaSBibG9rIGtvbnRlbjsgbWVuZ2VtYmFsaWthbiBkZWNrIHlhbmcgYWt0aWYuXG4gKlxuICogU2VzaSBEZWNrQ3JhZnQgZGlwYWthaSBiZXJzYW1hLCBqYWRpIGJ1aWxkIGhhcnVzIGRpc2VyaWFsa2FuOiBkdWEgcGVybWludGFhblxuICogYmVyc2FtYWFuIChtaXMuIGJ1aWxkICsgZXhwb3J0KSBha2FuIHNhbGluZyBtZW5pbXBhIHByZXNlbnRhc2kga2FsYXUgdGlkYWsuXG4gKiBBbnRyZWFuIGluaSBtZW1idWF0IHNldGlhcCBvcGVyYXNpIERlY2tDcmFmdCBiZXJqYWxhbiBzYXR1IHBlciBzYXR1LlxuICovXG5sZXQgYW50cmVhbkRlY2s6IFByb21pc2U8dW5rbm93bj4gPSBQcm9taXNlLnJlc29sdmUoKTtcblxuZnVuY3Rpb24gc2VyaWFsa2FuPFQ+KGtlcmphOiAoKSA9PiBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG4gIGNvbnN0IGphbGFuID0gYW50cmVhbkRlY2sudGhlbihrZXJqYSwga2VyamEpO1xuICAvLyBBbnRyZWFuIHRldGFwIGhpZHVwIG1lc2tpIHNhdHUgb3BlcmFzaSBnYWdhbC5cbiAgYW50cmVhbkRlY2sgPSBqYWxhbi50aGVuKFxuICAgICgpID0+IHVuZGVmaW5lZCxcbiAgICAoKSA9PiB1bmRlZmluZWQsXG4gICk7XG4gIHJldHVybiBqYWxhbjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYmFuZ3VuRGVjayhcbiAgYmxvY2tzOiBDb250ZW50QmxvY2tbXSxcbiAganVkdWw6IHN0cmluZyxcbiAgdGVtYTogc3RyaW5nLFxuKTogUHJvbWlzZTxEZWNrY3JhZnREZWNrPiB7XG4gIHJldHVybiBzZXJpYWxrYW4oYXN5bmMgKCkgPT4ge1xuICAgIGlmICghc2VzaVRlcmJ1a2EpIHtcbiAgICAgIHNlc2lUZXJidWthID0geyBzZXNpOiBuZXcgRGVja2NyYWZ0U2Vzc2lvbigpLCBkZWNrOiBudWxsIGFzIG5ldmVyIH07XG4gICAgfVxuICAgIGNvbnN0IHBlcmludGFoID0gYmxva0tlUGVyaW50YWgoYmxvY2tzLCB7IGp1ZHVsLCB0ZW1hIH0pO1xuICAgIGF3YWl0IHNlc2lUZXJidWthLnNlc2kuamFsYW5rYW4ocGVyaW50YWgpO1xuICAgIGNvbnN0IGRlY2sgPSBhd2FpdCBzZXNpVGVyYnVrYS5zZXNpLnBlcmlrc2EoKTtcbiAgICBzZXNpVGVyYnVrYS5kZWNrID0gZGVjaztcbiAgICByZXR1cm4gZGVjaztcbiAgfSk7XG59XG5cbi8qKiBSdXRlIEFQSS4gTWVuZ2VtYmFsaWthbiB0cnVlIGJpbGEgcGVybWludGFhbiBzdWRhaCBkaXRhbmdhbmkuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdGFuZ2FuaUFwaShcbiAgcmVxOiBJbmNvbWluZ01lc3NhZ2UsXG4gIHJlczogU2VydmVyUmVzcG9uc2UsXG4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgdXJsID0gbmV3IFVSTChyZXEudXJsID8/IFwiL1wiLCBcImh0dHA6Ly9sb2NhbGhvc3RcIik7XG4gIGlmICghdXJsLnBhdGhuYW1lLnN0YXJ0c1dpdGgoXCIvYXBpL2RlY2tjcmFmdFwiKSkgcmV0dXJuIGZhbHNlO1xuXG4gIHRyeSB7XG4gICAgaWYgKHVybC5wYXRobmFtZSA9PT0gXCIvYXBpL2RlY2tjcmFmdC9zdGF0dXNcIiAmJiByZXEubWV0aG9kID09PSBcIkdFVFwiKSB7XG4gICAgICBpZiAoIWluZm9EZWNrY3JhZnQpIHtcbiAgICAgICAgaW5mb0RlY2tjcmFmdCA9IGF3YWl0IHBlcmlrc2FEZWNrY3JhZnQoKTtcbiAgICAgIH1cbiAgICAgIGtpcmltSnNvbihyZXMsIDIwMCwge1xuICAgICAgICB0ZXJzZWRpYTogaW5mb0RlY2tjcmFmdC50ZXJzZWRpYSxcbiAgICAgICAgdmVyc2k6IGluZm9EZWNrY3JhZnQudmVyc2ksXG4gICAgICAgIGJpblBhdGg6IGluZm9EZWNrY3JhZnQuYmluUGF0aCxcbiAgICAgICAgdGVtYTogaW5mb0RlY2tjcmFmdC50ZW1hLmxlbmd0aCA+IDAgPyBpbmZvRGVja2NyYWZ0LnRlbWEgOiBbLi4uVEVNQV9ERUNLQ1JBRlRdLFxuICAgICAgICBnYWxhdDogaW5mb0RlY2tjcmFmdC5nYWxhdCA/PyBudWxsLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodXJsLnBhdGhuYW1lID09PSBcIi9hcGkvZGVja2NyYWZ0L2J1aWxkXCIgJiYgcmVxLm1ldGhvZCA9PT0gXCJQT1NUXCIpIHtcbiAgICAgIGNvbnN0IGJvZHkgPSBKU09OLnBhcnNlKChhd2FpdCBiYWNhQm9keShyZXEpKSB8fCBcInt9XCIpIGFzIFBlcm1pbnRhYW5CdWlsZDtcbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShib2R5LmJsb2NrcykgfHwgYm9keS5ibG9ja3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGtpcmltSnNvbihyZXMsIDQwMCwgeyBnYWxhdDogXCJUaWRhayBhZGEgYmxvayBrb250ZW4uXCIgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKCFpbmZvRGVja2NyYWZ0KSBpbmZvRGVja2NyYWZ0ID0gYXdhaXQgcGVyaWtzYURlY2tjcmFmdCgpO1xuICAgICAgaWYgKCFpbmZvRGVja2NyYWZ0LnRlcnNlZGlhKSB7XG4gICAgICAgIGtpcmltSnNvbihyZXMsIDUwMywge1xuICAgICAgICAgIGdhbGF0OiBpbmZvRGVja2NyYWZ0LmdhbGF0ID8/IFwiRGVja0NyYWZ0IHRpZGFrIHRlcnNlZGlhLlwiLFxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBjb25zdCBkZWNrID0gYXdhaXQgYmFuZ3VuRGVjayhcbiAgICAgICAgYm9keS5ibG9ja3MsXG4gICAgICAgIGJvZHkuanVkdWwgfHwgXCJQcmVzZW50YXNpIE5pdFotOTA5XCIsXG4gICAgICAgIGJvZHkudGVtYSB8fCBcIlNsYXRlXCIsXG4gICAgICApO1xuICAgICAga2lyaW1Kc29uKHJlcywgMjAwLCB7IGRlY2sgfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodXJsLnBhdGhuYW1lID09PSBcIi9hcGkvZGVja2NyYWZ0L3ByZXZpZXdcIiAmJiByZXEubWV0aG9kID09PSBcIkdFVFwiKSB7XG4gICAgICBpZiAoIXNlc2lUZXJidWthKSB7XG4gICAgICAgIGtpcmltSnNvbihyZXMsIDQwOSwgeyBnYWxhdDogXCJCYW5ndW4gZGVjayBkdWx1IHNlYmVsdW0gbWVtaW50YSBwcmF0aW5qYXUuXCIgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgY29uc3Qgc2xpZGUgPSBOdW1iZXIodXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJzbGlkZVwiKSA/PyBcIjBcIik7XG4gICAgICBjb25zdCBza2FsYSA9IE51bWJlcih1cmwuc2VhcmNoUGFyYW1zLmdldChcInNjYWxlXCIpID8/IFwiMVwiKTtcbiAgICAgIC8vIFNlcmlhbGthbiBkZW5nYW4gYnVpbGQ6IHByYXRpbmphdSBkZWNrIHlhbmcgc2VkYW5nIGRpYmFuZ3VuIGFrYW5cbiAgICAgIC8vIG1lbmFtcGlsa2FuIHNsaWRlIHNldGVuZ2FoIGphZGkuXG4gICAgICBjb25zdCBwbmcgPSBhd2FpdCBzZXJpYWxrYW4oKCkgPT5cbiAgICAgICAgc2VzaVRlcmJ1a2EhLnNlc2kucmVuZGVyU2xpZGUoXG4gICAgICAgICAgTnVtYmVyLmlzRmluaXRlKHNsaWRlKSA/IHNsaWRlIDogMCxcbiAgICAgICAgICBOdW1iZXIuaXNGaW5pdGUoc2thbGEpID8gc2thbGEgOiAxLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGtpcmltSnNvbihyZXMsIDIwMCwgeyBwbmcsIHNsaWRlIH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHVybC5wYXRobmFtZSA9PT0gXCIvYXBpL2RlY2tjcmFmdC9maWxtc3RyaXBcIiAmJiByZXEubWV0aG9kID09PSBcIkdFVFwiKSB7XG4gICAgICBpZiAoIXNlc2lUZXJidWthKSB7XG4gICAgICAgIGtpcmltSnNvbihyZXMsIDQwOSwgeyBnYWxhdDogXCJCYW5ndW4gZGVjayBkdWx1IHNlYmVsdW0gbWVtaW50YSBmaWxtc3RyaXAuXCIgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgY29uc3Qgc2thbGEgPSBOdW1iZXIodXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJzY2FsZVwiKSA/PyBcIjAuMzVcIik7XG4gICAgICAvLyBTZXJpYWxrYW4gZGVuZ2FuIGJ1aWxkOiBmaWxtc3RyaXAgZGVjayB5YW5nIHNlZGFuZyBkaWJhbmd1biBha2FuXG4gICAgICAvLyBtZW5hbXBpbGthbiBzbGlkZSBzZXRlbmdhaCBqYWRpLlxuICAgICAgY29uc3QgZ2FtYmFyID0gYXdhaXQgc2VyaWFsa2FuKGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgZGVjayA9IGF3YWl0IHNlc2lUZXJidWthIS5zZXNpLnBlcmlrc2EoKTtcbiAgICAgICAgLy8gQmF0YXNpIGp1bWxhaCBzbGlkZTogZmlsbXN0cmlwIHlhbmcgc2FuZ2F0IGJlc2FyIGFrYW4gbWVtYmFuamlyaVxuICAgICAgICAvLyByZXNwb25zIEpTT04gZGFuIGxhbWJhdCBkaXJlbmRlciBkaSBicm93c2VyLlxuICAgICAgICBjb25zdCBqdW1sYWggPSBNYXRoLm1pbihkZWNrLnNsaWRlcy5sZW5ndGgsIDQwKTtcbiAgICAgICAgcmV0dXJuIHNlc2lUZXJidWthIS5zZXNpLnJlbmRlclNlbXVhKFxuICAgICAgICAgIGp1bWxhaCxcbiAgICAgICAgICBOdW1iZXIuaXNGaW5pdGUoc2thbGEpID8gc2thbGEgOiAwLjM1LFxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgICBraXJpbUpzb24ocmVzLCAyMDAsIHsgZ2FtYmFyIH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHVybC5wYXRobmFtZSA9PT0gXCIvYXBpL2RlY2tjcmFmdC9leHBvcnRcIiAmJiByZXEubWV0aG9kID09PSBcIlBPU1RcIikge1xuICAgICAgY29uc3QgYm9keSA9IEpTT04ucGFyc2UoKGF3YWl0IGJhY2FCb2R5KHJlcSkpIHx8IFwie31cIikgYXMgUGVybWludGFhbkJ1aWxkO1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGJvZHkuYmxvY2tzKSB8fCBib2R5LmJsb2Nrcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAga2lyaW1Kc29uKHJlcywgNDAwLCB7IGdhbGF0OiBcIlRpZGFrIGFkYSBibG9rIGtvbnRlbi5cIiB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBpZiAoIWluZm9EZWNrY3JhZnQpIGluZm9EZWNrY3JhZnQgPSBhd2FpdCBwZXJpa3NhRGVja2NyYWZ0KCk7XG4gICAgICBpZiAoIWluZm9EZWNrY3JhZnQudGVyc2VkaWEpIHtcbiAgICAgICAga2lyaW1Kc29uKHJlcywgNTAzLCB7XG4gICAgICAgICAgZ2FsYXQ6IGluZm9EZWNrY3JhZnQuZ2FsYXQgPz8gXCJEZWNrQ3JhZnQgdGlkYWsgdGVyc2VkaWEuXCIsXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGp1ZHVsID0gYm9keS5qdWR1bCB8fCBcIlByZXNlbnRhc2kgTml0Wi05MDlcIjtcbiAgICAgIGNvbnN0IHRlbWEgPSBib2R5LnRlbWEgfHwgXCJTbGF0ZVwiO1xuXG4gICAgICAvLyBCdWlsZCArIHNpbXBhbiBkYWxhbSBzYXR1IG9wZXJhc2kgc2VyaWFsOiB0aWRhayBib2xlaCBkaXNlbGFcbiAgICAgIC8vIHBlcm1pbnRhYW4gbGFpbiB5YW5nIG1lbmd1YmFoIGRlY2sgZGkgdGVuZ2FoIGphbGFuLlxuICAgICAgY29uc3QgaGFzaWwgPSBhd2FpdCBzZXJpYWxrYW4oYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAoIXNlc2lUZXJidWthKSB7XG4gICAgICAgICAgc2VzaVRlcmJ1a2EgPSB7IHNlc2k6IG5ldyBEZWNrY3JhZnRTZXNzaW9uKCksIGRlY2s6IG51bGwgYXMgbmV2ZXIgfTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwZXJpbnRhaCA9IGJsb2tLZVBlcmludGFoKGJvZHkuYmxvY2tzLCB7IGp1ZHVsLCB0ZW1hIH0pO1xuICAgICAgICBhd2FpdCBzZXNpVGVyYnVrYS5zZXNpLmphbGFua2FuKHBlcmludGFoKTtcbiAgICAgICAgY29uc3QgZGVjayA9IGF3YWl0IHNlc2lUZXJidWthLnNlc2kucGVyaWtzYSgpO1xuICAgICAgICBzZXNpVGVyYnVrYS5kZWNrID0gZGVjaztcblxuICAgICAgICBjb25zdCBkaXIgPSBta2R0ZW1wU3luYyhwYXRoLmpvaW4odG1wZGlyKCksIFwibml0ei1kZWNrY3JhZnQtXCIpKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBuYW1hID0gYCR7anVkdWwucmVwbGFjZSgvW1xcXFwvOio/XCI8PnxdKy9nLCBcIi1cIikuc2xpY2UoMCwgMTAwKSB8fCBcIlByZXNlbnRhc2lcIn0ucHB0eGA7XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gcGF0aC5qb2luKGRpciwgbmFtYSk7XG4gICAgICAgICAgYXdhaXQgc2VzaVRlcmJ1a2Euc2VzaS5zaW1wYW4odGFyZ2V0KTtcbiAgICAgICAgICByZXR1cm4geyBkYXRhOiByZWFkRmlsZVN5bmModGFyZ2V0KSwgbmFtYSB9O1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgIHJtU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7XG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6XG4gICAgICAgICAgXCJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQucHJlc2VudGF0aW9ubWwucHJlc2VudGF0aW9uXCIsXG4gICAgICAgIFwiQ29udGVudC1MZW5ndGhcIjogaGFzaWwuZGF0YS5sZW5ndGgsXG4gICAgICAgIFwiQ29udGVudC1EaXNwb3NpdGlvblwiOiBgYXR0YWNobWVudDsgZmlsZW5hbWU9XCIke2hhc2lsLm5hbWF9XCJgLFxuICAgICAgICBcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1zdG9yZVwiLFxuICAgICAgfSk7XG4gICAgICByZXMuZW5kKGhhc2lsLmRhdGEpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHVybC5wYXRobmFtZSA9PT0gXCIvYXBpL2RlY2tjcmFmdC9leHBvcnQtZm9ybWF0XCIgJiYgcmVxLm1ldGhvZCA9PT0gXCJQT1NUXCIpIHtcbiAgICAgIGNvbnN0IGJvZHkgPSBKU09OLnBhcnNlKChhd2FpdCBiYWNhQm9keShyZXEpKSB8fCBcInt9XCIpIGFzIFBlcm1pbnRhYW5CdWlsZCAmIHtcbiAgICAgICAgZm9ybWF0Pzogc3RyaW5nO1xuICAgICAgICAvKiogRGV0aWsgcGVyIHNsaWRlIHVudHVrIEdJRi4gKi9cbiAgICAgICAgc2Vjb25kc1BlclNsaWRlPzogbnVtYmVyO1xuICAgICAgfTtcbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShib2R5LmJsb2NrcykgfHwgYm9keS5ibG9ja3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGtpcmltSnNvbihyZXMsIDQwMCwgeyBnYWxhdDogXCJUaWRhayBhZGEgYmxvayBrb250ZW4uXCIgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgZm9ybWF0ID0gYm9keS5mb3JtYXQgYXMgRm9ybWF0RWtzcG9yO1xuICAgICAgaWYgKCFmb3JtYXQgfHwgIShmb3JtYXQgaW4gRk9STUFUX0VLU1BPUikpIHtcbiAgICAgICAga2lyaW1Kc29uKHJlcywgNDAwLCB7XG4gICAgICAgICAgZ2FsYXQ6IGBGb3JtYXQgXCIke2JvZHkuZm9ybWF0ID8/IFwiKGtvc29uZylcIn1cIiB0aWRhayBkaWR1a3VuZy4gUGlsaWhhbjogJHtPYmplY3Qua2V5cyhGT1JNQVRfRUtTUE9SKS5qb2luKFwiLCBcIil9LmAsXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICghaW5mb0RlY2tjcmFmdCkgaW5mb0RlY2tjcmFmdCA9IGF3YWl0IHBlcmlrc2FEZWNrY3JhZnQoKTtcbiAgICAgIGlmICghaW5mb0RlY2tjcmFmdC50ZXJzZWRpYSkge1xuICAgICAgICBraXJpbUpzb24ocmVzLCA1MDMsIHtcbiAgICAgICAgICBnYWxhdDogaW5mb0RlY2tjcmFmdC5nYWxhdCA/PyBcIkRlY2tDcmFmdCB0aWRhayB0ZXJzZWRpYS5cIixcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgY29uc3QganVkdWwgPSBib2R5Lmp1ZHVsIHx8IFwiUHJlc2VudGFzaSBOaXRaLTkwOVwiO1xuICAgICAgY29uc3QgdGVtYSA9IGJvZHkudGVtYSB8fCBcIlNsYXRlXCI7XG4gICAgICBjb25zdCBtZXRhID0gRk9STUFUX0VLU1BPUltmb3JtYXRdO1xuXG4gICAgICAvLyBCdWlsZCArIGVrc3BvciBkYWxhbSBzYXR1IG9wZXJhc2kgc2VyaWFsLCBzYW1hIHNlcGVydGkgL2V4cG9ydC5cbiAgICAgIGNvbnN0IGhhc2lsID0gYXdhaXQgc2VyaWFsa2FuKGFzeW5jICgpID0+IHtcbiAgICAgICAgaWYgKCFzZXNpVGVyYnVrYSkge1xuICAgICAgICAgIHNlc2lUZXJidWthID0geyBzZXNpOiBuZXcgRGVja2NyYWZ0U2Vzc2lvbigpLCBkZWNrOiBudWxsIGFzIG5ldmVyIH07XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGVyaW50YWggPSBibG9rS2VQZXJpbnRhaChib2R5LmJsb2NrcywgeyBqdWR1bCwgdGVtYSB9KTtcbiAgICAgICAgYXdhaXQgc2VzaVRlcmJ1a2Euc2VzaS5qYWxhbmthbihwZXJpbnRhaCk7XG4gICAgICAgIGNvbnN0IGRlY2sgPSBhd2FpdCBzZXNpVGVyYnVrYS5zZXNpLnBlcmlrc2EoKTtcbiAgICAgICAgc2VzaVRlcmJ1a2EuZGVjayA9IGRlY2s7XG5cbiAgICAgICAgY29uc3QgZGlyID0gbWtkdGVtcFN5bmMocGF0aC5qb2luKHRtcGRpcigpLCBcIm5pdHotZGVja2NyYWZ0LVwiKSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgbmFtYSA9XG4gICAgICAgICAgICBqdWR1bC5yZXBsYWNlKC9bXFxcXC86Kj9cIjw+fF0rL2csIFwiLVwiKS5zbGljZSgwLCAxMDApIHx8XG4gICAgICAgICAgICBcIlByZXNlbnRhc2lcIjtcbiAgICAgICAgICBjb25zdCB0YXJnZXQgPSBwYXRoLmpvaW4oZGlyLCBgJHtuYW1hfS4ke21ldGEuZWtzdGVuc2l9YCk7XG4gICAgICAgICAgYXdhaXQgc2VzaVRlcmJ1a2Euc2VzaS5la3Nwb3IodGFyZ2V0LCBmb3JtYXQsIHtcbiAgICAgICAgICAgIC4uLihmb3JtYXQgPT09IFwiZ2lmXCJcbiAgICAgICAgICAgICAgPyB7XG4gICAgICAgICAgICAgICAgICBzZWNvbmRzUGVyU2xpZGU6IE51bWJlci5pc0Zpbml0ZShib2R5LnNlY29uZHNQZXJTbGlkZSlcbiAgICAgICAgICAgICAgICAgICAgPyBNYXRoLm1pbihNYXRoLm1heChib2R5LnNlY29uZHNQZXJTbGlkZSA/PyAzLCAwLjEpLCA2MDApXG4gICAgICAgICAgICAgICAgICAgIDogMyxcbiAgICAgICAgICAgICAgICAgIGxvb3A6IHRydWUsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICA6IHt9KSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm4geyBkYXRhOiByZWFkRmlsZVN5bmModGFyZ2V0KSwgbmFtYTogYCR7bmFtYX0uJHttZXRhLmVrc3RlbnNpfWAgfTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICBybVN5bmMoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICByZXMud3JpdGVIZWFkKDIwMCwge1xuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBtZXRhLm1pbWUsXG4gICAgICAgIFwiQ29udGVudC1MZW5ndGhcIjogaGFzaWwuZGF0YS5sZW5ndGgsXG4gICAgICAgIFwiQ29udGVudC1EaXNwb3NpdGlvblwiOiBgYXR0YWNobWVudDsgZmlsZW5hbWU9XCIke2hhc2lsLm5hbWF9XCJgLFxuICAgICAgICBcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1zdG9yZVwiLFxuICAgICAgfSk7XG4gICAgICByZXMuZW5kKGhhc2lsLmRhdGEpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAga2lyaW1Kc29uKHJlcywgNDA0LCB7IGdhbGF0OiBcIlJ1dGUgdGlkYWsgZGlrZW5hbC5cIiB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGtpcmltSnNvbihyZXMsIDUwMCwge1xuICAgICAgZ2FsYXQ6IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFwiS2VzYWxhaGFuIHRhayBkaWtldGFodWkuXCIsXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuLyoqIFR1dHVwIHNlc2kgRGVja0NyYWZ0IHNhYXQgc2VydmVyIGJlcmhlbnRpLiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHR1dHVwRGVja2NyYWZ0KCkge1xuICBpZiAoc2VzaVRlcmJ1a2EpIHtcbiAgICBhd2FpdCBzZXNpVGVyYnVrYS5zZXNpLmJlcmhlbnRpKCk7XG4gICAgc2VzaVRlcmJ1a2EgPSBudWxsO1xuICB9XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXE1SUFxcXFxwcm95ZWsgMjAyNlxcXFxOaXRaLTkwOVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcTVJQXFxcXHByb3llayAyMDI2XFxcXE5pdFotOTA5XFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9NUlAvcHJveWVrJTIwMjAyNi9OaXRaLTkwOS92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIHR5cGUgUGx1Z2luIH0gZnJvbSBcInZpdGVcIjtcblxuLyoqXG4gKiBNaWRkbGV3YXJlIEFQSSBEZWNrQ3JhZnQgdW50dWsgZGV2IHNlcnZlciBWaXRlLlxuICogUnV0ZSBgL2FwaS9kZWNrY3JhZnQvKmAgZGl0YW5nYW5pIGRpIGx1YXIgYnVuZGVsIGJyb3dzZXIga2FyZW5hIG1lbWFrYWlcbiAqIGBjaGlsZF9wcm9jZXNzYCBkYW4gYG5vZGU6ZnNgLlxuICpcbiAqIE1vZHVsIGRpaW1wb3Igc2VjYXJhIGRpbmFtaXMgKyBhbWFuLCBrYXJlbmEgZmlsZSBpbmkganVnYSBkaXBha2FpIGRpXG4gKiBtaXJyb3IgYERlcGxveSBHaXRodWIvYCB5YW5nXHU1MDVBXHU3Njg0XHU1QzMxXHU2NjJGIGtlIFZlcmNlbC4gRGkgbWlycm9yIGl0dSBmb2xkZXJcbiAqIGBzZXJ2ZXIvYCB0aWRhayBhZGEgKFZlcmNlbCBtZWxheWFuaSBhcGxpa2FzaSBzdGF0aXMpLCBqYWRpIGltcG9ydCBzdGF0aXNcbiAqIGFrYW4gbWVuZ2dhZ2Fsa2FuIGJ1aWxkIGRlbmdhbiBcImNhbm5vdCBmaW5kIG1vZHVsZVwiLlxuICpcbiAqIEthbGF1IG1vZHVsIHRhayBhZGEsIG1pZGRsZXdhcmUgZGlsZXdhdGk6IHNpc2FueWEgYXBsaWthc2kgdGV0YXAgamFsYW4sXG4gKiBkYW4gcGFuZWwgRGVja0NyYWZ0IFN0dWRpbyBtZW5hbXBpbGthbiBwZXNhbiB5YW5nIHRlcGF0IChcIlNlcnZlciBpbmkgdGlkYWtcbiAqIG1lbnllZGlha2FuIEFQSSBEZWNrQ3JhZnRcIikga2FyZW5hIHJ1dGUgQVBJIGphdHVoIGtlIGhhbGFtYW4gSFRNTC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gbXVhdEFwaURlY2tjcmFmdCgpOiBQcm9taXNlPFBsdWdpbiB8IG51bGw+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBtb2R1bCA9IGF3YWl0IGltcG9ydChcIi4vc2VydmVyL2RlY2tjcmFmdC1hcGkudHNcIik7XG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6IFwibml0ei1kZWNrY3JhZnQtYXBpXCIsXG4gICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgICAgdm9pZCBtb2R1bC50YW5nYW5pQXBpKHJlcSwgcmVzKS50aGVuKCh0ZXJ0YW5nYW5pKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRlcnRhbmdhbmkpIG5leHQoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH07XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyhhc3luYyAoKSA9PiB7XG4gIGNvbnN0IGFwaSA9IGF3YWl0IG11YXRBcGlEZWNrY3JhZnQoKTtcbiAgcmV0dXJuIHtcbiAgICAvLyBBc2V0IHJlbGF0aWY6IGhhc2lsIGJ1aWxkIGJpc2EgZGlidWthIGRhcmkgc3ViZGlyZWt0b3JpIG1hbmEgcHVuXG4gICAgLy8gKEdpdEh1YiBQYWdlcyAvQXV0by1HZW5lcmF0b3ItT2ZmaWNlLywgVmVyY2VsLCBhdGF1IGZvbGRlciBsb2thbCkuXG4gICAgLy8gVGFucGEgaW5pLCBWaXRlIG1lbnVsaXMgXCIvYXNzZXRzL1x1MjAyNlwiIHlhbmcgcHV0dXMgZGkgUGFnZXMgcHJvamVjdCBzaXRlLlxuICAgIGJhc2U6IFwiLi9cIixcbiAgICBwbHVnaW5zOiBhcGkgPyBbcmVhY3QoKSwgYXBpXSA6IFtyZWFjdCgpXSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIG9wZW46IGZhbHNlLFxuICAgIH0sXG4gICAgdGVzdDoge1xuICAgICAgLy8gYERlcGxveSBHaXRodWIvYCBhZGFsYWggc2FsaW5hbiBtaXJyb3IgdW50dWsgaG9zdGluZyBzdGF0aXMuIEJlcmthc1xuICAgICAgLy8gdWppbnlhIGlkZW50aWsgZGVuZ2FuIHlhbmcgZGkgYHNyYy9gLCBqYWRpIHRhbnBhIHBlbmdlY3VhbGlhbiBpbmlcbiAgICAgIC8vIHZpdGVzdCBtZW5qYWxhbmthbiBzZXRpYXAgdGVzIGR1YSBrYWxpIGRhbiBqdW1sYWggdGVzbnlhIG1lbmlwdS5cbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgXCIqKi9ub2RlX21vZHVsZXMvKipcIixcbiAgICAgICAgXCIqKi9kaXN0LyoqXCIsXG4gICAgICAgIFwiKiovRGVwbG95IEdpdGh1Yi8qKlwiLFxuICAgICAgXSxcbiAgICB9LFxuICB9O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQW1CQSxTQUFTLGFBQWtEO0FBQzNELFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsY0FBYztBQUN2QixPQUFPLFVBQVU7QUE0RFYsU0FBUyxpQkFBeUI7QUFDdkMsUUFBTSxVQUFVLFFBQVEsSUFBSSxlQUFlLEtBQUs7QUFDaEQsTUFBSSxRQUFTLFFBQU87QUFFcEIsUUFBTSxPQUFPLFFBQVEsSUFBSTtBQUN6QixRQUFNLE1BQU0sS0FBSyxLQUFLLE1BQU0sV0FBVyxpQkFBaUIsS0FBSztBQUU3RCxNQUFJLFFBQVEsYUFBYSxTQUFTO0FBQ2hDLFdBQU8sS0FBSztBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0EsTUFBSSxRQUFRLGFBQWEsVUFBVTtBQUNqQyxXQUFPLEtBQUs7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUVBLFNBQU8sS0FBSztBQUFBLElBQ1Y7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGO0FB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QztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUEsRUFDRixRQUFRO0FBQ04sV0FBTztBQUFBLEVBQ1Q7QUFDRjtBQUVBLElBQU8sc0JBQVEsYUFBYSxZQUFZO0FBQ3RDLFFBQU0sTUFBTSxNQUFNLGlCQUFpQjtBQUNuQyxTQUFPO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFJTCxNQUFNO0FBQUEsSUFDTixTQUFTLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQUEsSUFDeEMsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsS0FBS0MsTUFBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUN0QztBQUFBLElBQ0Y7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxNQUFNO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFJSixTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsidG1wZGlyIiwgInBhdGgiLCAicGF0aCIsICJwYXRoIl0KfQo=
