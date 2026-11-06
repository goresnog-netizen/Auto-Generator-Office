/**
 * NitZ-909 - Document Generation Platform
 * Main entry point
 */

import type {
  DocumentConfig,
  DocumentContent,
  ThemeTokens,
  GeneratorResult,
} from './types/index.ts';
import type { DocumentGenerator } from './types/index.ts';

// Re-export types (termasuk DocumentGenerator & ValidationResult).
export * from './types/index.ts';

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
    // Token warna bersifat tematik; modelight/gelap ditangani di CSS
    // (`:root[data-theme="light"]`). Di sini mode hanya dicatat agar
    // pemanggil tahu mode mana yang aktif.
    void mode;
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
  // Token default mencerminkan palet Freebuff yang dipakai `tokens.css`
  // (shell-dark). Nilai CSS tetap jadi sumber kebenaran untuk tampilan;
  // token di sini dipakai generator yang butuh warna saat menulis berkas.
  const defaultTokens: ThemeTokens = {
    colors: {
      bg: '#1c1d1c',
      surface: '#222423',
      surface2: '#282a29',
      raised: '#303330',
      border: '#2f322f',
      chrome: '#292b2a',
      text: '#dedfdd',
      muted: '#a0a39f',
      faint: '#858984',
      brand: '#b5cea5',
      brandDim: '#9db58b',
      primaryAction: '#b5cea5',
      primaryActionText: '#1c211b',
      bubble: '#282a29',
      accent: '#dedfdd',
      accentDim: '#858984',
      premium: '#d8a14a',
      green: '#b5cea5',
      danger: '#cf2f2f',
      ok: '#b5cea5',
      warn: '#f59e0b',
      info: '#c1f5f4',
      successText: '#b5cea5',
      dangerText: '#e7a3a3',
      warningText: '#f5c86f',
      shadow: '#000000',
      controlBg: '#282a29',
      controlBgHover: '#2e302f',
      controlBgPressed: '#343836',
      controlBorder: '#3a3d3a',
      controlBorderHover: '#4a4e4a',
      focusHalo: 'rgba(222, 223, 221, 0.12)',
    },
    typography: {
      fontSizes: {
        caption: '10px',
        label: '11px',
        ui: '12px',
        body: '13px',
        message: '14px',
        title: '15px',
        heading: '20px',
        display: '24px',
      },
      fontWeights: {
        light: 300,
        regular: 400,
        medium: 450,
        semibold: 500,
        bold: 600,
      },
      fontMono: '"DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSans:
        '"Google Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    },
    spacing: {
      space: {
        '0': '0',
        '1': '2px',
        '2': '4px',
        '3': '6px',
        '4': '8px',
        '5': '12px',
        '6': '16px',
        '7': '24px',
        '8': '32px',
      },
    },
    borderRadius: {
      radius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        round: '999px',
      },
    },
    motion: {
      ease: 'cubic-bezier(0.32, 0.72, 0, 1)',
      durationIn: '0.32s',
      durationOut: '0.24s',
    },
    layout: {
      tabbarHeight: '60px',
      tabHeight: '30px',
      chatContentMaxWidth: '720px',
      explorerWidth: '440px',
    },
  };

  const mergedTokens: ThemeTokens = {
    ...defaultTokens,
    ...themeTokens,
    colors: { ...defaultTokens.colors, ...themeTokens?.colors },
    typography: { ...defaultTokens.typography, ...themeTokens?.typography },
    spacing: { ...defaultTokens.spacing, ...themeTokens?.spacing },
    borderRadius: { ...defaultTokens.borderRadius, ...themeTokens?.borderRadius },
    motion: { ...defaultTokens.motion, ...themeTokens?.motion },
    layout: { ...defaultTokens.layout, ...themeTokens?.layout },
  };

  return new NitZ909(mergedTokens);
}

// Export default instance
export const nitz = createNitZ909();

export default NitZ909;