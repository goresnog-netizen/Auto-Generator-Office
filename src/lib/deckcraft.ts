/**
 * Bridge DeckCraft — mesin render/ekspor presentasi mutakhir.
 *
 * DeckCraft (storytold/deckcraft) adalah reimplementasi PowerPoint open-source
 * dalam Rust murni. Binernya (`deckcraft-cli`) bisa berjalan tanpa jendela:
 *
 *   deckcraft-cli mcp        → server MCP di stdio (JSON-RPC 2.0 per baris)
 *   deckcraft-cli run        → menjalankan perintah pada deck lalu menyimpan
 *   deckcraft-cli render     → menggambar slide jadi PNG
 *
 * Modul ini berbicara protokol MCP di stdio karena:
 *  1. tidak ada batas panjang baris perintah Windows (8 KB) seperti `--cmd`;
 *  2. satu proses bertahan → presentasi bisa dibangun bertahap;
 *  3. `render_slide` mengembalikan PNG dalam respons yang sama → pratinjau
 *     di dalam browser tanpa perlu file sementara.
 *
 * Batas yang disengaja: bridge ini berjalan di Node (bukan browser), memakai
 * `child_process`. Dipakai oleh sisi server/agen, bukan oleh bundel browser.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Perintah engine DeckCraft (id yang diterima `batch` dan `run_command`). */
export interface DeckcraftCommand {
  command: string;
  params?: Record<string, unknown>;
  /**
   * Indeks slide tempat perintah ini berlaku (0-based).
   *
   * Perintah `format.*` di engine bekerja pada SELECTION slide aktif, bukan
   * pada id yang diberi. Tanpa informasi slide, perintah format bisa
   // menempel ke shape di slide lain. Bridge memakai field ini untuk
   * menyisipkan `slide.go` yang tepat sebelum perintah format.
   */
  slide?: number;
}

export interface DeckcraftSlide {
  index: number;
  id: number;
  title: string;
  layout: string;
  shapes: number;
  hidden: boolean;
}

export interface DeckcraftDeck {
  title: string;
  theme: string;
  slideSize: [number, number];
  slides: DeckcraftSlide[];
}

export type DeckcraftStatus = "siap" | "berjalan" | "gagal";

export interface DeckcraftInfo {
  /** Path absolut binary deckcraft-cli. */
  binPath: string;
  /** Versi yang dilaporkan binary. */
  versi: string;
  /** true bila binary ditemukan dan bisa dijalankan. */
  tersedia: boolean;
  /** Tema yang tersedia di binary tersebut. */
  tema: string[];
  /** Pesan error terakhir (bila ada). */
  galat?: string;
}

/**
 * Lokasi default binary. Bisa dioverride lewat environment DECKCRAFT_CLI.
 *
 * Tiap platform punya nama folder & nama berkas berbeda:
 *   Windows  vendors/deckcraft-bin/app/deckcraft-0.8.0-windows-x64-portable/deckcraft-cli.exe
 *   Linux    vendors/deckcraft-bin/app/deckcraft-0.8.0-linux-x86_64/bin/deckcraft-cli
 *   macOS    vendors/deckcraft-bin/app/deckcraft-cli-0.8.0-macos-universal/deckcraft-cli
 *
 * Sebelumnya fungsi ini hanya menunjuk jalur Windows, sehingga instalasi
 * Linux/macOS (termasuk container Docker) selalu melaporkan "binary tidak
 * ditemukan" meski berkasnya ada.
 */
export function defaultBinPath(): string {
  const dariEnv = process.env.DECKCRAFT_CLI?.trim();
  if (dariEnv) return dariEnv;

  const akar = process.cwd();
  const app = path.join(akar, "vendors", "deckcraft-bin", "app");

  if (process.platform === "win32") {
    return path.join(
      app,
      "deckcraft-0.8.0-windows-x64-portable",
      "deckcraft-cli.exe",
    );
  }
  if (process.platform === "darwin") {
    return path.join(
      app,
      "deckcraft-cli-0.8.0-macos-universal",
      "deckcraft-cli",
    );
  }
  // Linux: arsip resmi menaruh binary di dalam subfolder bin/.
  return path.join(
    app,
    "deckcraft-0.8.0-linux-x86_64",
    "bin",
    "deckcraft-cli",
  );
}

/**
 * Satu perintah yang dijalankan lalu proses ditutup. Dipakai untuk
 * memeriksa ketersediaan binary dan membaca daftar tema.
 */
function jalankanSekali(
  binPath: string,
  args: string[],
  input?: string,
): Promise<{ kode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const anak = spawn(binPath, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    anak.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    anak.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });
    anak.on("error", (e) => reject(e));
    anak.on("close", (code) =>
      resolve({ kode: code ?? -1, stdout, stderr }),
    );
    if (input !== undefined) {
      anak.stdin.end(input);
    } else {
      anak.stdin.end();
    }
  });
}

/** Ambil daftar tema dari binary lewat perintah `design.themes`. */
export async function bacaTemaDeckcraft(
  binPath = defaultBinPath(),
): Promise<string[]> {
  try {
    const { stdout } = await jalankanSekali(binPath, [
      "run",
      "--cmd",
      "design.themes",
      "--print",
      "--save",
      path.join(tmpdir(), "deckcraft-tema.deckcraft"),
    ]);
    const baris = stdout
      .split(/\r?\n/)
      .find((b) => b.includes("design.themes"));
    if (!baris) return [];
    const json = baris.slice(baris.indexOf("→") + 1).trim();
    const data = JSON.parse(json) as {
      themes?: { name: string }[];
      colorSchemes?: string[];
    };
    const dariTema = (data.themes ?? []).map((t) => t.name);
    return dariTema.length > 0 ? dariTema : (data.colorSchemes ?? []);
  } catch {
    return [];
  }
}

/** Status DeckCraft di mesin ini: binary ada? bisa dijalankan? versinya berapa? */
export async function periksaDeckcraft(
  binPath = defaultBinPath(),
): Promise<DeckcraftInfo> {
  if (!existsSync(binPath)) {
    return {
      binPath,
      versi: "-",
      tersedia: false,
      tema: [],
      galat: "Binary deckcraft-cli tidak ditemukan. Jalankan skrip vendoring.",
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
        galat: stderr.trim() || "deckcraft-cli gagal dijalankan.",
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
      galat: e instanceof Error ? e.message : "Gagal menjalankan deckcraft-cli.",
    };
  }
}

/**
 * Sesi MCP yang berjalan: satu proses `deckcraft-cli mcp`, banyak perintah.
 * Sengaja ditulis sebagai kelas agar state presentasi bertahan antar panggilan.
 */
export class DeckcraftSession {
  private anak: ChildProcessWithoutNullStreams | null = null;
  /** Antrean serialize: satu perintah pada satu waktu. */
  private antrean: Promise<void> = Promise.resolve();
  private penghitung = 0;
  private buffer = "";
  private penunggu = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  private readonly binPath: string;
  private readonly akarKerja: string | undefined;

  constructor(binPath: string = defaultBinPath(), akarKerja?: string) {
    this.binPath = binPath;
    this.akarKerja = akarKerja;
  }

  get aktif(): boolean {
    return this.anak !== null;
  }

  /** Mulai proses MCP dan lakukan handshake. */
  async mulai(): Promise<void> {
    if (this.anak) return;
    const anak = spawn(this.binPath, ["mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: this.akarKerja,
    });
    this.anak = anak;
    this.buffer = "";
    anak.stdout.setEncoding("utf8");
    anak.stdout.on("data", (potongan: string) => this.serap(potongan));
    anak.stderr.on("data", () => {
      /* log server diabaikan: stdout adalah kanal protokol */
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
      clientInfo: { name: "nitz-909", version: "1" },
    });
    // Notifikasi: tanpa id, tanpa balasan.
    this.tulis({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
  }

  /** Hentikan proses dengan rapi. */
  async berhenti(): Promise<void> {
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

  private serap(potongan: string) {
    this.buffer += potongan;
    let idx = this.buffer.indexOf("\n");
    while (idx >= 0) {
      const baris = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (baris) this.tangani(baris);
      idx = this.buffer.indexOf("\n");
    }
    // DeckCraft membatasi balasan 16 MiB per baris (termasuk newline).
    // Baris yang melebihi itu berarti protokol rusak — stop daripada
    // menumpuk buffer tanpa batas.
    if (this.buffer.length > 16 * 1024 * 1024) {
      this.buffer = "";
      for (const { reject } of this.penunggu.values()) {
        reject(new Error("Balasan deckcraft melebihi batas 16 MiB."));
      }
      this.penunggu.clear();
    }
  }

  private tangani(baris: string) {
    let pesan: { id?: number; result?: unknown; error?: { message?: string } };
    try {
      pesan = JSON.parse(baris) as typeof pesan;
    } catch {
      return;
    }
    if (typeof pesan.id !== "number") return;
    const tunggu = this.penunggu.get(pesan.id);
    if (!tunggu) return;
    this.penunggu.delete(pesan.id);
    if (pesan.error) {
      tunggu.reject(
        new Error(pesan.error.message ?? "Kesalahan JSON-RPC dari deckcraft."),
      );
      return;
    }
    tunggu.resolve(pesan.result);
  }

  private tulis(pesan: unknown) {
    if (!this.anak) throw new Error("Sesi deckcraft belum dimulai.");
    this.anak.stdin.write(`${JSON.stringify(pesan)}\n`);
  }

  /** Kirim satu permintaan JSON-RPC dan tunggu balasannya. */
  private kirim(method: string, params: unknown): Promise<unknown> {
    const id = ++this.penghitung;
    const hasil = new Promise<unknown>((resolve, reject) => {
      this.penunggu.set(id, { resolve, reject });
    });
    this.tulis({
      jsonrpc: "2.0",
      id,
      method,
      params: params ?? {},
    });
    return hasil;
  }

  /**
   * Panggil tool MCP. Antrian di serialkan supaya perintah tidak saling
   * menimpa state presentasi.
   */
  async panggil(
    nama: string,
    argumen: Record<string, unknown> = {},
  ): Promise<string> {
    const jalan = this.antrean.then(async () => {
      await this.mulai();
      const balasan = (await this.kirim("tools/call", {
        name: nama,
        arguments: argumen,
      })) as {
        content?: { type: string; text?: string; data?: string }[];
        isError?: boolean;
      };
      const teks = (balasan.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n");
      if (balasan.isError) {
        throw new Error(teks || `Tool deckcraft "${nama}" gagal.`);
      }
      return teks;
    });
    // Antrean tetap berjalan meski satu perintah gagal.
    this.antrean = jalan.then(
      () => undefined,
      () => undefined,
    );
    return jalan;
  }

  /** Jalankan sekumpulan perintah engine dalam satu batch. */
  async jalankan(perintah: DeckcraftCommand[]): Promise<string> {
    if (perintah.length === 0) return "";
    return this.panggil("batch", {
      commands: this.perintahKeEngine(perintah),
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
  async jalankanEngine(
    perintah: string,
    params: Record<string, unknown> = {},
  ): Promise<string> {
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
  private perintahKeEngine(perintah: DeckcraftCommand[]): {
    command: string;
    params: Record<string, unknown>;
  }[] {
    const hasil: { command: string; params: Record<string, unknown> }[] = [];
    let slideAktif: number | null = null;

    for (const p of perintah) {
      // `slide.new` memindahkan slide aktif sendiri; jangan set slide.go
      // sebelum-nya karena indeks slide baru belum tentu sama dengan
      // urutan perintah.
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
  async periksa(): Promise<DeckcraftDeck> {
    const teks = await this.panggil("inspect_document", {});
    const data = JSON.parse(teks) as {
      title?: string;
      theme?: string;
      slideSize?: [number, number];
      slides?: {
        index: number;
        id: number;
        title: string;
        layout: string;
        shapes: number;
        hidden: boolean;
      }[];
    };
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
        hidden: !!s.hidden,
      })),
    };
  }

  /** Render satu slide jadi PNG (base64) untuk pratinjau di browser. */
  async renderSlide(slide = 0, skala = 1): Promise<string> {
    const balasan = (await this.kirimToolMentah("render_slide", {
      slide,
      scale: skala,
    })) as { content?: { type: string; data?: string }[] };
    const gambar = (balasan.content ?? []).find((c) => c.type === "image");
    if (!gambar?.data) {
      // Bedakan dua sebab: slide di luar rentang, vs deck kosong.
      const jumlah = await this.hitungSlide().catch(() => 0);
      if (jumlah === 0) {
        throw new Error("DeckCraft tidak punya slide untuk dirender.");
      }
      throw new Error(
        `Slide ${slide} tidak ada (deck berisi ${jumlah} slide).`,
      );
    }
    return gambar.data;
  }

  /** Jumlah slide pada presentasi aktif (0 bila tidak ada deck). */
  private async hitungSlide(): Promise<number> {
    const teks = await this.panggil("inspect_document", {});
    try {
      const data = JSON.parse(teks) as { slides?: unknown[] };
      return data.slides?.length ?? 0;
    } catch {
      return 0;
    }
  }

  private async kirimToolMentah(
    nama: string,
    argumen: Record<string, unknown>,
  ): Promise<unknown> {
    const jalan = this.antrean.then(async () => {
      await this.mulai();
      return this.kirim("tools/call", { name: nama, arguments: argumen });
    });
    this.antrean = jalan.then(
      () => undefined,
      () => undefined,
    );
    return jalan;
  }

  /** Simpan presentasi ke path tertentu (ekstensi menentukan format). */
  async simpan(pathTujuan: string): Promise<string> {
    return this.panggil("export", { path: pathTujuan });
  }

  /**
   * Ekspor deck ke format tertentu lewat tool MCP `export`.
   *
   * Format yang didukung engine v0.8.0: png, jpeg, pptx, deckcraft, outline,
   * pdf, gif. Ekstensi path harus cocok dengan format (engine menolak
   * kombinasi yang tak konsisten).
   */
  async ekspor(
    pathTujuan: string,
    format: "png" | "jpeg" | "pptx" | "deckcraft" | "outline" | "pdf" | "gif",
    opsi: {
      /** Semua slide (untuk gambar). */
      all?: boolean;
      /** Indeks slide tunggal (untuk gambar). */
      slide?: number;
      /** Piksel per titik (untuk gambar). */
      scale?: number;
      /** Detik per slide (GIF). */
      secondsPerSlide?: number;
      /** Putar GIF selamanya. */
      loop?: boolean;
      /** Tata letak halaman PDF. */
      layout?: "slides" | "notes" | "handouts";
    } = {},
  ): Promise<{ path?: string; bytes?: number; files?: string[] }> {
    const teks = await this.panggil("export", { path: pathTujuan, format, ...opsi });
    try {
      return JSON.parse(teks) as {
        path?: string;
        bytes?: number;
        files?: string[];
      };
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
  async renderSemua(
    jumlahSlide: number,
    skala = 0.35,
  ): Promise<string[]> {
    const hasil: string[] = [];
    for (let i = 0; i < jumlahSlide; i++) {
      hasil.push(await this.renderSlide(i, skala));
    }
    return hasil;
  }
}
