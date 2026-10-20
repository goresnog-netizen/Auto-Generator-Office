/**
 * NitZ-909 - Document Generation Platform
 * Main entry point
 */

import { DocumentConfig, DocumentContent, ThemeTokens, GeneratorResult } from './types';
import type { DocumentGenerator, ValidationResult } from './types';

// Re-export types (termasuk DocumentGenerator & ValidationResult).
export * from './types';

// Theme manager
export class ThemeManager {
  private tokens: ThemeTokens;

  constructor(tokens: ThemeTokens) {
    this.tokens = tokens;
  }

  getTokens(): ThemeTokens {
    return this.tokens;
  }

  getColorTokens() {
    return this.tokens.colors;
  }

  getTypographyTokens() {
    return this.tokens.typography;
  }

  applyTheme(mode: 'light' | 'dark'): ThemeTokens {
    // Implementation would switch theme tokens
    return this.tokens;
  }
}

// Main application class
export class NitZ909 {
  private generators: Map<string, DocumentGenerator> = new Map();
  private themeManager: ThemeManager;

  constructor(themeTokens: ThemeTokens) {
    this.themeManager = new ThemeManager(themeTokens);
  }

  registerGenerator(type: string, generator: DocumentGenerator): void {
    this.generators.set(type, generator);
  }

  getGenerator(type: string): DocumentGenerator | undefined {
    return this.generators.get(type);
  }

  async generateDocument(
    config: DocumentConfig,
    content: DocumentContent
  ): Promise<GeneratorResult> {
    const generator = this.getGenerator(config.type);
    if (!generator) {
      return {
        success: false,
        error: `No generator registered for type: ${config.type}`
      };
    }

    const validation = generator.validate(config, content);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('; ')
      };
    }

    return generator.generate(config, content);
  }

  getThemeManager(): ThemeManager {
    return this.themeManager;
  }
}

// Factory function for easy initialization
export function createNitZ909(themeTokens?: Partial<ThemeTokens>): NitZ909 {
  // Default tokens would be imported from tokens.css
  const defaultTokens: ThemeTokens = {
    colors: {},
    typography: {},
    spacing: {},
    borderRadius: {},
    motion: {},
    layout: {}
  };

  const mergedTokens: ThemeTokens = {
    ...defaultTokens,
    ...themeTokens
  } as ThemeTokens;

  return new NitZ909(mergedTokens);
}

// Export default instance
export const nitz = createNitZ909();

export default NitZ909;