/**
 * Diagram Generator
 * Generates diagrams using Mermaid
 */

import {
  DocumentGenerator,
  DocumentConfig,
  DocumentContent,
  GeneratorResult,
  ValidationResult,
  GeneratorOptions,
  DiagramBlock,
  ChartBlock
} from '../types/index.ts';

import { promisify } from 'util';
import { execFile } from 'child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Semua perintah eksternal dijalankan lewat `execFile` (tanpa shell),
// bukan `exec`. Dengan begitu path berkas dan judul dokumen yang
// mengandung karakter shell tak bisa menyuntik perintah lain.
const execFileAsync = promisify(execFile);

/**
 * Cari npx yang bisa dijalankan tanpa shell.
 *
 * Di Windows, `npx` adalah berkas `.cmd` (batch). `execFile` tanpa shell
 * tak bisa menjalankan batch file - Node menolak extension .cmd/.bat demi
 * keamanan (CVE-2024-27980). Solusinya: jalankan `npx-cli.js` langsung
 * dengan Node, tanpa shell sama sekali.
 *
 * @returns perintah + awalan argumen, atau null bila npx tak ditemukan.
 */
function cariNpx(): { cmd: string; awalan: string[] } | null {
  // 1. npx-cli.js di sebelah node.exe (layout instalasi Node standar).
  const besideNode = path.join(
    path.dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npx-cli.js',
  );
  if (existsSync(besideNode)) {
    return { cmd: process.execPath, awalan: [besideNode] };
  }

  // 2. npx di PATH sebagai executable native (Linux/macOS).
  if (process.platform !== 'win32') {
    return { cmd: 'npx', awalan: [] };
  }

  // 3. Fallback terakhir di Windows: .cmd butuh shell. Hanya dipakai
  //    kalau npx-cli.js tak ditemukan, dan argumennya tetap array
  //    (bukan string) sehingga tak ada interpolasi shell.
  return { cmd: 'npx.cmd', awalan: [] };
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

      // Return combined result
      const allSuccess = results.every(r => r.success);
      return {
        success: allSuccess,
        outputPath: this.options.outputPath,
        buffer: results[0]?.buffer,
        error: allSuccess ? undefined : results.find(r => !r.success)?.error
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
      const npx = cariNpx();
      if (!npx) {
        throw new Error('npx tidak ditemukan di sistem.');
      }
      const args = [
        ...npx.awalan,
        '-y',
        '@mermaid-js/mermaid-cli',
        '-i', mmdAbs,
        '-o', outputAbs,
        '-t', theme,
        '-b', this.options.backgroundColor || 'transparent',
      ];
      if (this.options.width) args.push('-w', String(this.options.width));
      if (this.options.height) args.push('-H', String(this.options.height));

      await execFileAsync(npx.cmd, args, { cwd: dir });

      const buffer = await fs.promises.readFile(outputAbs);
      return { success: true, outputPath, buffer };
    } catch (error) {
      // Fallback: return mermaid source.
      //
      // Dua sebab yang berbeda dan perlu dibedakan user:
      //  1. mermaid-cli tak terpasang / gagal — sumber .mmd dikembalikan;
      //  2. mermaid-cli jalan TAPI Chrome/headless tak ada — error-nya
      //     khas ("Could not find Chrome", "browser was not found").
      //     Di kasus ini sumber .mmd tetap dikembalikan, tapi pesannya
      //     menyebut kebutuhan Chrome supaya user tahu apa yang kurang.
      const pesanError =
        error instanceof Error ? error.message : String(error);
      const butuhChrome =
        /could not find chrome|browser was not found|chromium is not installed|chrome.*not found/i.test(
          pesanError,
        );
      const pesan = butuhChrome
        ? 'Mermaid CLI berjalan tetapi Chrome/Chromium tidak ditemukan. ' +
          'Pasang Chrome (atau set PUPPETEER_EXECUTABLE_PATH) lalu ulangi. ' +
          'Sementara itu sumber Mermaid dikembalikan sebagai .mmd.'
        : 'Mermaid CLI tidak tersedia atau gagal. Sumber Mermaid dikembalikan sebagai .mmd. ' +
          'Pasang @mermaid-js/mermaid-cli (npm i -g @mermaid-js/mermaid-cli) untuk render SVG.';
      return {
        success: true,
        outputPath: mmdAbs,
        buffer: Buffer.from(mermaidCode),
        metadata: {
          fallback: true,
          butuhChrome,
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