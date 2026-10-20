/**
 * Generators Index
 * Exports all document generators
 */

export { WordGenerator } from './word';
export { PPTXGenerator } from './pptx';
export { XLSXGenerator } from './xlsx';
export { PDFGenerator } from './pdf';
export { DiagramGenerator } from './diagram';

import { WordGenerator } from './word';
import { PPTXGenerator } from './pptx';
import { XLSXGenerator } from './xlsx';
import { PDFGenerator } from './pdf';
import { DiagramGenerator } from './diagram';

import { NitZ909, DocumentGenerator, DocumentConfig, DocumentContent, GeneratorResult } from '../index';
import { ThemeTokens } from '../types';

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