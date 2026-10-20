/**
 * NitZ-909 Core Types
 * Type definitions for the document generation platform
 */

/* ===== THEME TYPES ===== */
export type ThemeMode = "light" | "dark" | "system";

export interface ThemeTokens {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borderRadius: BorderRadiusTokens;
  motion: MotionTokens;
  layout: LayoutTokens;
}

export interface ColorTokens {
  bg: string;
  surface: string;
  surface2: string;
  raised: string;
  border: string;
  chrome: string;
  text: string;
  muted: string;
  faint: string;
  brand: string;
  brandDim: string;
  primaryAction: string;
  primaryActionText: string;
  bubble: string;
  accent: string;
  accentDim: string;
  premium: string;
  green: string;
  danger: string;
  ok: string;
  warn: string;
  info: string;
  successText: string;
  dangerText: string;
  warningText: string;
  shadow: string;
  controlBg: string;
  controlBgHover: string;
  controlBgPressed: string;
  controlBorder: string;
  controlBorderHover: string;
  focusHalo: string;
}

export interface TypographyTokens {
  fontSizes: Record<string, string>;
  fontWeights: Record<string, number>;
  fontMono: string;
  fontSans: string;
}

export interface SpacingTokens {
  space: Record<string, string>;
}

export interface BorderRadiusTokens {
  radius: Record<string, string>;
}

export interface MotionTokens {
  ease: string;
  durationIn: string;
  durationOut: string;
}

export interface LayoutTokens {
  tabbarHeight: string;
  tabHeight: string;
  chatContentMaxWidth: string;
  explorerWidth: string;
}

/* ===== DOCUMENT TYPES ===== */
export type DocumentType = "word" | "pdf" | "pptx" | "xlsx" | "diagram";

export interface DocumentConfig {
  type: DocumentType;
  title: string;
  theme?: ThemeConfig;
  metadata?: DocumentMetadata;
}

export interface ThemeConfig {
  mode: ThemeMode;
  primaryColor?: string;
  fontFamily?: string;
  customTokens?: Partial<ThemeTokens>;
}

export interface DocumentMetadata {
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: string;
  tags?: string[];
  description?: string;
}

export interface DocumentContent {
  blocks: ContentBlock[];
}

export type ContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | CodeBlock
  | ImageBlock
  | ChartBlock
  | DiagramBlock
  | DividerBlock;

export interface BaseBlock {
  id: string;
  type: string;
}

export interface HeadingBlock extends BaseBlock {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: "paragraph";
  text: string;
  formatting?: TextFormatting;
}

export interface ListBlock extends BaseBlock {
  type: "list";
  ordered: boolean;
  items: ListItem[];
}

export interface ListItem {
  text: string;
  children?: ListItem[];
  checked?: boolean;
}

export interface TableBlock extends BaseBlock {
  type: "table";
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface CodeBlock extends BaseBlock {
  type: "code";
  language: string;
  code: string;
  filename?: string;
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface ChartBlock extends BaseBlock {
  type: "chart";
  chartType: "bar" | "line" | "pie" | "area" | "scatter";
  data: ChartData;
  options?: ChartOptions;
}

export interface DiagramBlock extends BaseBlock {
  type: "diagram";
  diagramType: "mermaid" | "plantuml";
  source: string;
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
}

export interface TextFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  link?: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
}

export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: Record<string, unknown>;
  scales?: Record<string, unknown>;
}

/* ===== METADATA LAPORAN (F1 FormMode) ===== */
export interface LaporanMetadata {
  nomor: string;
  tanggal: string;
  unit: string;
  penanggungJawab: string;
  periode: string;
  lokasi: string;
}

/* ===== GENERATOR TYPES ===== */
/**
 * Opsi dasar generator.
 *
 * `format` sengaja TIDAK ada di sini: tiap generator punya format
 * outputnya sendiri (docx/png/pdf/...), jadi declaring `format` di base
 * akan bentrok dengan `extends` di tiap generator.
 */
export interface GeneratorOptions {
  outputPath: string;
  theme?: ThemeConfig;
}

/**
 * Kontrak semua generator dokumen.
 *
 * Ditempatkan di sini (bukan di `src/index.ts`) supaya generator Node bisa
 * mengimpornya tanpa memutar siklus: `src/index.ts` meng-export modul ini
 * sekaligus membuat instance generator, sedangkan modul ini hanya berisi
 * tipe.
 */
export interface DocumentGenerator {
  generate(
    config: DocumentConfig,
    content: DocumentContent,
  ): Promise<GeneratorResult>;
  validate(
    config: DocumentConfig,
    content: DocumentContent,
  ): ValidationResult;
}

/** Hasil validasi: daftar error ( Fatal) dan peringatan (Warning). */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GeneratorResult {
  success: boolean;
  outputPath?: string;
  buffer?: Buffer;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface WordGeneratorOptions extends GeneratorOptions {
  template?: string;
  styles?: WordStyles;
}

export interface WordStyles {
  heading?: Record<number, WordStyle>;
  paragraph?: WordStyle;
  list?: WordStyle;
  table?: WordTableStyle;
  code?: WordStyle;
}

export interface WordStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: "left" | "center" | "right" | "justify";
  spacing?: {
    before?: number;
    after?: number;
    line?: number;
  };
}

export interface WordTableStyle {
  header?: WordStyle;
  cell?: WordStyle;
  borders?: boolean;
  striped?: boolean;
}

export interface PPTXGeneratorOptions extends GeneratorOptions {
  template?: string;
  slideSize?: "widescreen" | "standard" | "custom";
  customSize?: { width: number; height: number };
  masterSlides?: SlideMaster[];
}

export interface SlideMaster {
  name: string;
  background?: SlideBackground;
  placeholders?: SlidePlaceholder[];
}

export interface SlideBackground {
  type: "solid" | "gradient" | "image";
  color?: string;
  gradient?: { direction: string; stops: string[] };
  image?: string;
}

export interface SlidePlaceholder {
  type: "title" | "body" | "image" | "chart" | "table";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface XLSXGeneratorOptions extends GeneratorOptions {
  template?: string;
  sheets: SheetConfig[];
}

export interface SheetConfig {
  name: string;
  data: unknown[][];
  headers?: string[];
  styles?: SheetStyles;
  charts?: ChartConfig[];
  tables?: TableConfig[];
}

export interface SheetStyles {
  header?: CellStyle;
  cell?: CellStyle;
  alternatingRows?: boolean;
}

export interface CellStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  color?: string;
  fill?: string;
  alignment?: "left" | "center" | "right";
  border?: BorderStyle;
}

export interface BorderStyle {
  top?: BorderEdge;
  bottom?: BorderEdge;
  left?: BorderEdge;
  right?: BorderEdge;
}

export interface BorderEdge {
  style: "thin" | "medium" | "thick" | "double";
  color: string;
}

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "area" | "scatter";
  title: string;
  dataRange: string;
  position: { x: number; y: number; width: number; height: number };
}

export interface TableConfig {
  range: string;
  style?: TableStyle;
  totalsRow?: boolean;
}

export interface TableStyle {
  name?: string;
  showFirstColumn?: boolean;
  showLastColumn?: boolean;
  showRowStripes?: boolean;
  showColumnStripes?: boolean;
}

/* ===== AI TYPES ===== */
export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
  apiKey?: string;
  baseUrl?: string;
}

export interface AIModel {
  id: string;
  name: string;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsFunctions: boolean;
}

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface AICompletionOptions {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  toolChoice?:
    "auto" | "none" | { type: "function"; function: { name: string } };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AICompletionResult {
  id: string;
  model: string;
  choices: AICompletionChoice[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AICompletionChoice {
  index: number;
  message: AIMessage;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter";
}

/* ===== SLASH COMMAND TYPES ===== */
export interface SlashCommand {
  name: string;
  description: string;
  aliases?: string[];
  args?: CommandArg[];
  handler: (
    context: CommandContext,
    args: ParsedArgs,
  ) => Promise<CommandResult>;
}

export interface CommandArg {
  name: string;
  description: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "choice";
  choices?: string[];
  default?: unknown;
}

export interface ParsedArgs {
  [key: string]: unknown;
}

export interface CommandContext {
  document: DocumentContent;
  config: DocumentConfig;
  theme: ThemeTokens;
  ai: AIProvider;
  workspace: WorkspaceContext;
}

export interface WorkspaceContext {
  cwd: string;
  projectName?: string;
  files: string[];
}

export interface CommandResult {
  success: boolean;
  message?: string;
  blocks?: ContentBlock[];
  error?: string;
}

/* ===== SETTINGS TYPES ===== */
export interface UserSettings {
  theme: ThemeConfig;
  ai: AISettings;
  generators: GeneratorSettings;
  editor: EditorSettings;
  shortcuts: ShortcutSettings;
}

export interface AISettings {
  defaultProvider: string;
  defaultModel: string;
  apiKeys: Record<string, string>;
  temperature: number;
  maxTokens: number;
}

export interface GeneratorSettings {
  defaultOutputDir: string;
  word: WordGeneratorOptions;
  pptx: PPTXGeneratorOptions;
  xlsx: XLSXGeneratorOptions;
  pdf: PDFGeneratorOptions;
}

export interface PDFGeneratorOptions extends Omit<GeneratorOptions, "format"> {
  /** Ukuran kertas (bukan format berkas — PDF selalu .pdf). */
  format?: "A4" | "Letter" | "Legal";
  paperSize?: "A4" | "Letter" | "Legal";
  orientation?: "portrait" | "landscape";
  margins?: { top: number; right: number; bottom: number; left: number };
  headerTemplate?: string;
  footerTemplate?: string;
}

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
}

export interface ShortcutSettings {
  [command: string]: string;
}

/* ===== EXPORT TYPES ===== */
export interface ExportOptions {
  format: DocumentType;
  outputPath: string;
  theme?: ThemeConfig;
  includeAssets?: boolean;
}

export interface BatchExportOptions {
  documents: DocumentConfig[];
  outputDir: string;
  format: DocumentType;
  theme?: ThemeConfig;
  concurrency?: number;
}
