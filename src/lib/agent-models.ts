export const TEXT_PROVIDERS = ["gemini"] as const;
export const IMAGE_PROVIDERS = ["gemini"] as const;
export type TextProviderName = (typeof TEXT_PROVIDERS)[number];
export type ImageProviderName = (typeof IMAGE_PROVIDERS)[number];
export type ProviderName = TextProviderName;

export type AgentModelSettings = {
  textProvider: TextProviderName;
  imageProvider?: ImageProviderName;
  imageModel?: string;
};

export const providerLabel: Record<ProviderName, string> = {
  gemini: "Google Gemini",
};

export const modelSuggestions: Record<TextProviderName, string[]> = {
  gemini: ["gemini-3.5-flash", "gemini-3.1-flash-lite"],
};

export const imageModelSuggestions: Record<ImageProviderName, string[]> = {
  gemini: ["gemini-3.1-flash-image"],
};

export function agentModelSettings(configuration: Record<string, unknown>, model: string, fallback: TextProviderName): AgentModelSettings {
  return {
    textProvider: "gemini",
    imageProvider: "gemini",
    imageModel: typeof configuration.imageModel === "string" ? configuration.imageModel : undefined,
  };
}
