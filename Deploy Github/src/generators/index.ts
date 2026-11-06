/**
 * Generators Index
 * Exports all document generators
 */

export { WordGenerator } from './word.ts';
export { PPTXGenerator } from './pptx.ts';
export { XLSXGenerator } from './xlsx.ts';
export { PDFGenerator } from './pdf.ts';
export { DiagramGenerator } from './diagram.ts';

import { WordGenerator } from './word.ts';
import { PPTXGenerator } from './pptx.ts';
import { XLSXGenerator } from './xlsx.ts';
import { PDFGenerator } from './pdf.ts';
import { DiagramGenerator } from './diagram.ts';

import { NitZ909 } from '../index.ts';
import type {
  DocumentGenerator,
  DocumentConfig,
  DocumentContent,
  GeneratorResult,
} from '../types/index.ts';
import type { ThemeTokens } from '../types/index.ts';

/**
 * Create a fully configured NitZ-909 instance with all generators
 */
export function createFullNitZ909(themeTokens?: Partial<ThemeTokens>): NitZ909 {
  const app = new NitZ909(themeTokens as ThemeTokens);

  app.registerGenerator('word', new WordGenerator());
  app.registerGenerator('pptx', new PPTXGenerator());
  app.registerGenerator('xlsx', new XLSXGenerator());
  app.registerGenerator('pdf', new PDFGenerator());
  app.registerGenerator('diagram', new DiagramGenerator());

  return app;
}

/**
 * Quick generate function for single document
 */
export async function generateDocument(
  type: 'word' | 'pptx' | 'xlsx' | 'pdf' | 'diagram',
  config: DocumentConfig,
  content: DocumentContent,
  options?: Record<string, unknown>
): Promise<GeneratorResult> {
  let generator: DocumentGenerator;

  switch (type) {
    case 'word':
      generator = new WordGenerator(options as any);
      break;
    case 'pptx':
      generator = new PPTXGenerator(options as any);
      break;
    case 'xlsx':
      generator = new XLSXGenerator(options as any);
      break;
    case 'pdf':
      generator = new PDFGenerator(options as any);
      break;
    case 'diagram':
      generator = new DiagramGenerator(options as any);
      break;
    default:
      return { success: false, error: `Unknown generator type: ${type}` };
  }

  const validation = generator.validate(config, content);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  return generator.generate(config, content);
}

export default {
  WordGenerator,
  PPTXGenerator,
  XLSXGenerator,
  PDFGenerator,
  DiagramGenerator,
  createFullNitZ909,
  generateDocument
};