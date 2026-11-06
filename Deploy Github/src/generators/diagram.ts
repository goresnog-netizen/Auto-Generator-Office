/**
 * Diagram Generator
 * Generates diagrams using Mermaid
 */

// Hanya TIPE yang diimpor. Kalau nilai diimpor sebagai nilai, Node ESM
// mengharuskan modul itu benar-benar mengekspor simbol runtime-nya -
// dan `src/types/index.ts` hanya berisi type, jadi import-nya gagal:
// "does not provide an export named 'ChartBlock'".
import type {
  DocumentGenerator,
  DocumentConfig,
  DocumentContent,
  GeneratorResult,
  ValidationResult,
  GeneratorOptions,
  DiagramBlock,
  ChartBlock,
} from '../types/index.ts';

import { promisify } from 'util';
import { execFile } from 'child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Semua perintah eksternal dijalankan lewat `execFile` (tanpa shell),
// bukan `exec`. Dengan begitu path berkas dan judul dokumen yang
// mengandung karakter shell tak bisa menyuntik perintah lain.
const execFileAsync = promisify(execFile);

/**
 * Lokasi paket Node yang bisa dipakai untuk cari `mmdc`.
 *
 * Di repo ini, `@mermaid-js/mermaid-cli` adalah devDependency LOKAL
 * (dipasang `scripts/pasang-mermaid.ps1`), jadi binary-nya ada di
 * `node_modules/`. Ini lebih aman daripada `npx -y` yang mengunduh
 * paket dari jaringan setiap kali render.
 *
 * CATATAN - dua jebakan yang sudah ditangani:
 *
 *  1. Pakai `fileURLToPath`, bukan `new URL(...).pathname` langsung.
 *     `pathname` mengembalikan URL dengan percent-encoding yang belum
 *     di-decode, dan di Windows meninggalkan awalan `/C:/...`.
 *
 *  2. Akar proyek TIDAK bisa dihitung dari `import.meta.url` saja.
 *     Berkas ini bisa dimuat dari beberapa tempat: sumber langsung
 *     (`src/generators/`), hasil bundle esbuild di `node_modules/.cache/`,
 *     atau build produksi. Masing-masing menghasilkan akar yang berbeda,
 *     jadi `AKAR_PROYEK` di bawah hanya dipakai sebagai salah satu
 *     kandidat - pencarian `cli.js` mencoba beberapa lokasi.
 */
const AKAR_PROYEK = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

/**
 * Path konfigurasi Puppeteer (ditulis oleh scripts/pasang-mermaid.ps1).
 *
 * Diambil dari kandidat pertama yang benar-benar ada, karena lokasi
 * berkasnya berbeda tergantung dari mana modul ini dimuat.
 */
function cariPathPuppeteerConfig(): string | null {
  const kandidat = [
    path.join(AKAR_PROYEK, 'config', 'puppeteer.config.json'),
    path.resolve(AKAR_PROYEK, '..', '..', 'config', 'puppeteer.config.json'),
    path.resolve(AKAR_PROYEK, '..', '..', '..', 'config', 'puppeteer.config.json'),
    path.join(process.cwd(), 'config', 'puppeteer.config.json'),
  ];
  for (const k of [...new Set(kandidat)]) {
    if (existsSync(k)) return k;
  }
  return null;
}

/**
 * Kandidat lokasi `mermaid-cli/src/cli.js`.
 *
 * Diuji berurutan; yang pertama ada yang dipakai. Alasan banyak kandidat:
 * berkas ini dimuat dari `src/generators/` saat dev, dari
 * `node_modules/.cache/` saat di-bundle skrip verifikasi, dan dari
 * `dist/` saat build produksi - masing-masing dengan kedalaman folder
 * berbeda.
 */
function kandidatCliMmdc(): string[] {
  const kandidat: string[] = [];
  const tambah = (akar: string) => {
    if (!akar) return;
    kandidat.push(
      path.join(akar, 'node_modules', '@mermaid-js', 'mermaid-cli', 'src', 'cli.js'),
    );
  };
  // Sumber langsung: src/generators/ -> akar proyek.
  tambah(path.resolve(AKAR_PROYEK));
  // Bundle di node_modules/.cache/<x>/ -> akar proyek.
  tambah(path.resolve(AKAR_PROYEK, '..', '..'));
  // Build produksi (dist/assets/).
  tambah(path.resolve(AKAR_PROYEK, '..', '..', '..'));
  // Akar proses (cwd saat skrip dijalankan).
  tambah(process.cwd());
  return [...new Set(kandidat)];
}

/**
 * Cari binary `mmdc` yang bisa dijalankan tanpa shell.
 *
 * Di Windows, `node_modules/.bin/mmdc.cmd` adalah BATCH FILE. Node menolak
 * extension .cmd/.bat lewat `execFile` tanpa shell demi keamanan
 * (CVE-2024-27980), dan memanggilnya lewat `cmd.exe /c` berbahaya: path
 * yang mengandung spasi ("C:\MRP\proyek 2026\...") dipecah jadi argumen
 * terpisah dan perintah gagal.
 *
 * Karena itu skrip ini TIDAK memakai file .cmd sama sekali. `mmdc` hanyalah
 * wrapper yang memanggil `src/cli.js` dengan Node - jadi kita panggil
 * `cli.js` itu langsung:
 *
 *   1. `node_modules/@mermaid-js/mermaid-cli/src/cli.js` (instalasi lokal)
 *   2. `mmdc` di PATH sebagai executable native (Linux/macOS)
 *   3. `npx` + `npx-cli.js` (fallback; mengunduh paket, jadi lambat)
 *
 * Semua tanpa shell: argumen tetap array, tak ada interpolasi.
 *
 * @returns perintah + awalan argumen, atau null bila tak ada yang bisa dipakai.
 */
function cariMmdc(): { cmd: string; awalan: string[] } | null {
  // 1. Instalasi lokal: jalankan cli.js langsung dengan Node.
  for (const kandidat of kandidatCliMmdc()) {
    if (existsSync(kandidat)) {
      return { cmd: process.execPath, awalan: [kandidat] };
    }
  }

  // 2. mmdc di PATH sebagai executable native (Linux/macOS).
  if (process.platform !== 'win32') {
    return { cmd: 'mmdc', awalan: [] };
  }

  // 3. Fallback: npx-cli.js di sebelah node.exe.
  const besideNode = path.join(
    path.dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npx-cli.js',
  );
  if (existsSync(besideNode)) {
    return {
      cmd: process.execPath,
      awalan: [besideNode, '-y', '@mermaid-js/mermaid-cli'],
    };
  }

  // 4. Fallback terakhir: npx.cmd (butuh shell, argumen tetap array).
  return { cmd: 'npx.cmd', awalan: ['-y', '@mermaid-js/mermaid-cli'] };
}

export interface DiagramGeneratorOptions extends Omit<GeneratorOptions, 'theme'> {
  format?: 'svg' | 'png' | 'pdf';
  /** Tema Mermaid (bukan tema dokumen). */
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
  width?: number;
  height?: number;
  backgroundColor?: string;
}

export class DiagramGenerator implements DocumentGenerator {
  private options: DiagramGeneratorOptions;

  constructor(options: DiagramGeneratorOptions = { outputPath: '' }) {
    this.options = {
      format: options.format ?? 'svg',
      theme: options.theme ?? 'default',
      ...options,
    };
  }

  validate(config: DocumentConfig, content: DocumentContent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    // `config` belum dipakai untuk validasi diagram, tapi tetap bagian kontrak.
    void config;
    const diagramBlocks = content.blocks.filter(b => b.type === 'diagram' || b.type === 'chart');
    if (diagramBlocks.length === 0) {
      warnings.push('No diagram or chart blocks found in content');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async generate(config: DocumentConfig, content: DocumentContent): Promise<GeneratorResult> {
    try {
      const diagramBlocks = content.blocks.filter(
        b => b.type === 'diagram' || b.type === 'chart'
      ) as (DiagramBlock | ChartBlock)[];

      const results: GeneratorResult[] = [];

      for (const block of diagramBlocks) {
        let result: GeneratorResult;

        if (block.type === 'diagram') {
          result = await this.generateDiagram(block as DiagramBlock, config);
        } else {
          result = await this.generateChart(block as ChartBlock, config);
        }

        results.push(result);
      }

      // Return combined result.
      //
      // CATATAN: metadata dari hasil per-blok HARUS diteruskan. Sebelumnya
      // metadata dibuang di sini, sehingga pesan fallback (mis. "Chrome tidak
      // ditemukan" atau "sintaks Mermaid salah") hilang total - user cuma
      // melihat diagram gagal tanpa tahu apa yang kurang.
      const allSuccess = results.every(r => r.success);
      const metadataGabung = results
        .map(r => r.metadata)
        .filter((m): m is NonNullable<typeof m> => !!m)
        .reduce<Record<string, unknown>>((acc, m) => ({ ...acc, ...m }), {});
      return {
        success: allSuccess,
        outputPath: this.options.outputPath,
        buffer: results[0]?.buffer,
        error: allSuccess ? undefined : results.find(r => !r.success)?.error,
        ...(Object.keys(metadataGabung).length > 0
          ? { metadata: metadataGabung }
          : {}),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating diagram'
      };
    }
  }

  private async generateDiagram(block: DiagramBlock, config: DocumentConfig): Promise<GeneratorResult> {
    const { diagramType, source } = block;

    if (diagramType === 'mermaid') {
      return this.renderMermaid(source, config);
    } else if (diagramType === 'plantuml') {
      return this.renderPlantUML(source, config);
    }

    return { success: false, error: `Unsupported diagram type: ${diagramType}` };
  }

  private async generateChart(block: ChartBlock, config: DocumentConfig): Promise<GeneratorResult> {
    // Convert chart to mermaid
    const mermaidSource = this.chartToMermaid(block);
    return this.renderMermaid(mermaidSource, config);
  }

  private chartToMermaid(block: ChartBlock): string {
    const { chartType, data } = block;

    switch (chartType) {
      case 'bar':
        return this.barToMermaid(data);
      case 'line':
        return this.lineToMermaid(data);
      case 'pie':
        return this.pieToMermaid(data);
      default:
        return `%% Unsupported chart type: ${chartType}`;
    }
  }

  private barToMermaid(data: { labels: string[]; datasets: { label: string; data: number[] }[] }): string {
    let mermaid = '```mermaid\n';
    mermaid += 'barChart\n';
    mermaid += `    title "${data.datasets[0]?.label || 'Chart'}"\n`;

    for (let i = 0; i < data.labels.length; i++) {
      const values = data.datasets.map(ds => ds.data[i]).join(', ');
      mermaid += `    "${data.labels[i]}" : ${values}\n`;
    }

    mermaid += '```';
    return mermaid;
  }

  private lineToMermaid(data: { labels: string[]; datasets: { label: string; data: number[] }[] }): string {
    let mermaid = '```mermaid\n';
    mermaid += 'lineChart\n';
    mermaid += `    title "${data.datasets[0]?.label || 'Chart'}"\n`;

    for (let i = 0; i < data.labels.length; i++) {
      const values = data.datasets.map(ds => ds.data[i]).join(', ');
      mermaid += `    "${data.labels[i]}" : ${values}\n`;
    }

    mermaid += '```';
    return mermaid;
  }

  private pieToMermaid(data: { labels: string[]; datasets: { label: string; data: number[] }[] }): string {
    let mermaid = '```mermaid\n';
    mermaid += 'pie\n';
    mermaid += `    title "${data.datasets[0]?.label || 'Chart'}"\n`;

    for (let i = 0; i < data.labels.length; i++) {
      mermaid += `    "${data.labels[i]}" : ${data.datasets[0]?.data[i] || 0}\n`;
    }

    mermaid += '```';
    return mermaid;
  }

  private async renderMermaid(source: string, config: DocumentConfig): Promise<GeneratorResult> {
    // Extract mermaid code from markdown fences
    const mermaidMatch = source.match(/```mermaid\n([\s\S]*?)\n```/);
    const mermaidCode = mermaidMatch ? mermaidMatch[1].trim() : source;

    // Judul dokumen masuk ke nama berkas. Sanitasi supaya tak ada
    // karakter jalur yang bisa keluar dari direktori target, dan supaya
    // tak ada tanda kutip yang bisa menutup argumen perintah.
    const judulAman = String(config.title ?? 'diagram')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'diagram';
    const outputPath =
      this.options.outputPath ||
      `./output/${judulAman}-diagram.${this.options.format || 'svg'}`;

    // Ensure output directory exists
    const fs = await import('fs');
    const path = await import('path');
    // Path absolut: `outputPath` bisa relatif (mis. "./output/x.svg"),
    // sedangkan perintah dijalankan dengan `cwd` lain. Path relatif akan
    // ditafsirkan relatif terhadap cwd itu dan berkas tak ditemukan.
    const outputAbs = path.resolve(outputPath);
    const dir = path.dirname(outputAbs);
    await fs.promises.mkdir(dir, { recursive: true });

    // Write mermaid file
    const mmdAbs = outputAbs.replace(/\.(svg|png|pdf)$/, '.mmd');
    await fs.promises.writeFile(mmdAbs, mermaidCode);

    // Try to render with mermaid-cli.
    //
    // Pakai `execFile` (bukan `exec`): perintah dijalankan tanpa shell,
    // jadi judul dokumen atau path yang berisi karakter shell tak bisa
    // menyuntik perintah lain.
    try {
      const theme = this.options.theme === 'dark' ? 'dark' : 'default';
      const mmdc = cariMmdc();
      if (!mmdc) {
        throw new Error('mermaid-cli tidak ditemukan di sistem.');
      }
      const args = [
        ...mmdc.awalan,
        '-i', mmdAbs,
        '-o', outputAbs,
        '-t', theme,
        '-b', this.options.backgroundColor || 'transparent',
      ];
      // Konfigurasi Puppeteer: menunjuk Chrome yang terpasang di mesin ini
      // dan menambahkan --no-sandbox (wajib di banyak CI).
      const configPuppeteer = cariPathPuppeteerConfig();
      if (configPuppeteer) {
        args.push('-p', configPuppeteer);
      }
      if (this.options.width) args.push('-w', String(this.options.width));
      if (this.options.height) args.push('-H', String(this.options.height));

      await execFileAsync(mmdc.cmd, args, { cwd: dir });

      // Validasi hasil: berkas keluaran WAJIB ada dan berisi SVG. Tanpa
      // cek ini, `readFile` bisa saja membaca berkas lain (mis. sumber
      // .mmd) dan hasilnya dilaporkan "sukses" padahal tak ada render.
      if (!existsSync(outputAbs)) {
        throw new Error(
          'mermaid-cli selesai tanpa menulis berkas keluaran: ' + outputAbs,
        );
      }
      const buffer = await fs.promises.readFile(outputAbs);
      const kepala = buffer.subarray(0, 512).toString('utf8');
      if (!kepala.includes('<svg')) {
        throw new Error(
          'berkas keluaran bukan SVG (mungkin diagram gagal di-parse): ' +
            outputAbs,
        );
      }
      return { success: true, outputPath, buffer };
    } catch (error) {
      // Fallback: return mermaid source.
      //
      // Tiga sebab yang berbeda dan perlu dibedakan user:
      //  1. mermaid-cli tak terpasang → sumber .mmd dikembalikan;
      //  2. mermaid-cli jalan TAPI Chrome/headless tak ada → pesan menyebut
      //     kebutuhan Chrome;
      //  3. mermaid-cli jalan, Chrome jalan, tapi diagramnya sendiri
      //     salah sintaks → pesan menyebut kesalahan Mermaid.
      const pesanError =
        error instanceof Error ? error.message : String(error);
      const butuhChrome =
        /could not find chrome|browser was not found|chromium is not installed|chrome.*not found|failed to launch the browser process/i.test(
          pesanError,
        );
      const salahSintaks =
        /parse error|lexing error|no diagram type detected|unknowndiagramerror|error parsing/i.test(
          pesanError,
        );
      const pesan = butuhChrome
        ? 'Mermaid CLI berjalan tetapi Chrome/Chromium tidak ditemukan. ' +
          'Jalankan `pnpm pasang:mermaid` (mencari Chrome yang terpasang) ' +
          'atau set PUPPETEER_EXECUTABLE_PATH. ' +
          'Sementara itu sumber Mermaid dikembalikan sebagai .mmd.'
        : salahSintaks
          ? 'Mermaid CLI berjalan, tapi diagramnya gagal di-parse. ' +
            'Periksa sintaks Mermaid. ' +
            'Sementara itu sumber Mermaid dikembalikan sebagai .mmd.'
          : 'Mermaid CLI tidak tersedia atau gagal. Sumber Mermaid dikembalikan sebagai .mmd. ' +
            'Jalankan `pnpm pasang:mermaid` untuk memasang mermaid-cli + Chrome.';
      return {
        success: true,
        outputPath: mmdAbs,
        buffer: Buffer.from(mermaidCode),
        metadata: {
          fallback: true,
          butuhChrome,
          salahSintaks,
          message: pesan,
          // Detail teknis disimpan terpisah supaya pesan user tetap ringkas.
          detail: pesanError.slice(0, 500),
        },
      };
    }
  }

  private async renderPlantUML(source: string, config: DocumentConfig): Promise<GeneratorResult> {
    const judulAman = String(config.title ?? 'diagram')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'diagram';
    const outputPath =
      this.options.outputPath ||
      `./output/${judulAman}-diagram.${this.options.format || 'svg'}`;

    const fs = await import('fs');
    const path = await import('path');
    // Path absolut: perintah dijalankan dengan `cwd` sendiri, jadi path
    // relatif tak akan ketemu. Lihat renderMermaid.
    const outputAbs = path.resolve(outputPath);
    const dir = path.dirname(outputAbs);
    await fs.promises.mkdir(dir, { recursive: true });

    // Write plantuml file
    const pumlAbs = outputAbs.replace(/\.(svg|png|pdf)$/, '.puml');
    await fs.promises.writeFile(pumlAbs, source);

    try {
      // Try plantuml via java.
      // `execFile` tanpa shell: argumen tak bisa diselipkan perintah lain.
      await execFileAsync(
        'java',
        [
          '-jar', 'plantuml.jar',
          `-t${this.options.format || 'svg'}`,
          pumlAbs,
          '-o', dir,
        ],
        { cwd: process.cwd() },
      );

      const buffer = await fs.promises.readFile(outputAbs);
      return { success: true, outputPath, buffer };
    } catch (error) {
      const pesanError = error instanceof Error ? error.message : String(error);
      return {
        success: true,
        outputPath: pumlAbs,
        buffer: Buffer.from(source),
        metadata: {
          fallback: true,
          message:
            'PlantUML/Java tidak tersedia. Sumber PlantUML dikembalikan sebagai .puml.',
          detail: pesanError.slice(0, 500),
        },
      };
    }
  }
}

export default DiagramGenerator;