---
# NitZ-909 Quick Start

## Prerequisites
- Node.js v20+ (you have v24.15.0 ✓)
- pnpm v11+ (you have v11.0.9 ✓)

## Installation
```bash
cd C:\MRP\proyek 2026\NitZ-909
pnpm install
```

## Development
```bash
pnpm dev
```
Starts Vite dev server at http://localhost:5173

## DeckCraft Integration (presentasi mutakhir)
NitZ-909 memakai **DeckCraft v0.8.0** (`storytold/deckcraft`) sebagai mesin
render & ekspor presentasi: PPTX dengan tabel, grafik, SmartArt, plus pratinjau
PNG yang sama persis dengan hasil akhir.

```bash
pnpm vendor:deckcraft   # unduh + verifikasi checksum binary resmi (sekali saja)
pnpm dev                # panel "DeckCraft Studio" aktif di sidebar Ekspor
```

Dokumentasi lengkap: [`docs/INTEGRASI-DECKCRAFT.md`](docs/INTEGRASI-DECKCRAFT.md)

Verifikasi:
```bash
pnpm verify:deckcraft       # bridge Node → deck + PPTX + PNG
pnpm verify:deckcraft:api   # API HTTP (butuh pnpm dev)
pnpm verify:deckcraft:ui    # UI via Chrome DevTools (butuh pnpm dev)
```

## Building
```bash
pnpm build
```
Creates production build in `dist/`

## Generating Documents (Programmatic)
```typescript
import { createFullNitZ909, generateDocument } from './src/generators';

// Initialize with theme tokens
const nitz = createFullNitZ909({
  theme: { mode: 'dark' }
});

// Create document content
const content = {
  blocks: [
    { type: 'heading', level: 1, text: 'NitZ-909 Report' },
    { type: 'paragraph', text: 'Generated document from block-based editor' },
    { type: 'list', ordered: true, items: [
      { text: 'Item 1' },
      { text: 'Item 2' }
    ]}
  ]
};

// Generate PDF
const result = await generateDocument('pdf', { title: 'NitZ-909 Report', metadata: { author: 'User' } }, content);
if (result.success && result.buffer) {
  const fs = await import('fs');
  await fs.promises.writeFile('report.pdf', result.buffer);
  console.log('PDF generated successfully');
}
```

## Available Generators
- `generateDocument('pdf', ...)` — PDF document
- `generateDocument('word', ...)` — Word (.docx)
- `generateDocument('pptx', ...)` — PowerPoint (.pptx)
- `generateDocument('xlsx', ...)` — Excel (.xlsx)
- `generateDocument('diagram', ...)` — Diagram/chart

## Theme Management
```typescript
import { useTheme } from './src/components/ThemeProvider';

const { mode, setMode, toggle } = useTheme();

// Switch themes
setMode('light');
setMode('dark');
setMode('system');  // Follows OS preference
toggle();  // Cycles light → dark → system → light
```

## Design Tokens (Freebuff-sourced)
Dark theme variables applied to `:root`:
- `--bg: #0a0a0a`, `--surface: #171717`, `--text: #ebebeb`
- `--brand: #b5cea5`, `--muted: #9e9e9e`
- Font sizes: `--font-size-caption: 10px` → `--font-size-display: 40px`
- Spacings: `--space-0: 0` → `--space-8: 32px`
- Radii: `--radius-xs: 4px` → `--radius-round: 999px`

Light theme overrides `:root[data-theme="light"]` with appropriate contrasts.
---
