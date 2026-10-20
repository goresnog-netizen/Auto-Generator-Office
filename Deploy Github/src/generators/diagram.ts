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
import { exec } from 'child_process';

const execAsync = promisify(exec);

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

    const outputPath = this.options.outputPath || `./output/${config.title}-diagram.${this.options.format || 'svg'}`;

    // Ensure output directory exists
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(outputPath);
    await fs.promises.mkdir(dir, { recursive: true });

    // Write mermaid file
    const mmdPath = outputPath.replace(/\.(svg|png|pdf)$/, '.mmd');
    await fs.promises.writeFile(mmdPath, mermaidCode);

    // Try to render with mermaid-cli
    try {
      const theme = this.options.theme === 'dark' ? 'dark' : 'default';
      const cmd = `npx -y @mermaid-js/mermaid-cli -i "${mmdPath}" -o "${outputPath}" -t ${theme} -b ${this.options.backgroundColor || 'transparent'} ${this.options.width ? `-w ${this.options.width}` : ''} ${this.options.height ? `-H ${this.options.height}` : ''}`;

      await execAsync(cmd);

      const buffer = await fs.promises.readFile(outputPath);
      return { success: true, outputPath, buffer };
    } catch (error) {
      // Fallback: return mermaid source
      return {
        success: true,
        outputPath: mmdPath,
        buffer: Buffer.from(mermaidCode),
        metadata: { fallback: true, message: 'Mermaid CLI not available, returned source' }
      };
    }
  }

  private async renderPlantUML(source: string, config: DocumentConfig): Promise<GeneratorResult> {
    const outputPath = this.options.outputPath || `./output/${config.title}-diagram.${this.options.format || 'svg'}`;

    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(outputPath);
    await fs.promises.mkdir(dir, { recursive: true });

    // Write plantuml file
    const pumlPath = outputPath.replace(/\.(svg|png|pdf)$/, '.puml');
    await fs.promises.writeFile(pumlPath, source);

    try {
      // Try plantuml via java
      const cmd = `java -jar plantuml.jar -t${this.options.format || 'svg'} "${pumlPath}" -o "${path.dirname(outputPath)}"`;
      await execAsync(cmd);

      const buffer = await fs.promises.readFile(outputPath);
      return { success: true, outputPath, buffer };
    } catch (error) {
      return {
        success: true,
        outputPath: pumlPath,
        buffer: Buffer.from(source),
        metadata: { fallback: true, message: 'PlantUML not available, returned source' }
      };
    }
  }
}

export default DiagramGenerator;