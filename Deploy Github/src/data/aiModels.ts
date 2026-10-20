/**
 * Pilihan Model AI NitZ-909
 * Provider dan model yang dipakai saat pembuatan konten / ekspor.
 */

export interface AIModel {
  id: string;
  label: string;
}

export interface AIProvider {
  id: string;
  label: string;
  models: AIModel[];
  /** Endpoint default resmi provider (boleh dioverride lewat `baseUrl` uji). */
  endpoint?: string;
  /** Label kunci API untuk formulir (mis. "Kunci OpenAI"). */
  labelKunci?: string;
  /** true bila provider punya tier gratis (tampil badge GRATIS). */
  gratis?: boolean;
  /** Tautan halaman pengambilan API key di situs provider. */
  urlKunci?: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    labelKunci: "Kunci OpenAI",
    urlKunci: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    labelKunci: "Kunci Anthropic",
    urlKunci: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
      { id: "claude-3-haiku", label: "Claude 3 Haiku" },
    ],
  },
  {
    id: "google",
    label: "Google AI",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    labelKunci: "Kunci Google AI",
    gratis: true,
    urlKunci: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-flash-latest", label: "Gemini Flash Latest" },
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    labelKunci: "Kunci Groq",
    gratis: true,
    urlKunci: "https://console.groq.com/keys",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
    ],
  },
];

export const DEFAULT_PROVIDER_ID = "openai";
export const DEFAULT_MODEL_ID = "gpt-4o";

export const getProvider = (id: string) =>
  AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];

export const getModelLabel = (providerId: string, modelId: string) => {
  const provider = getProvider(providerId);
  return provider.models.find((m) => m.id === modelId)?.label ?? modelId;
};
