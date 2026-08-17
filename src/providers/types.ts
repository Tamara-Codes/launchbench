import type { z } from "zod";

export interface StructuredGenerationRequest<T> {
  model: string;
  systemPrompt: string;
  prompt: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  schemaName: string;
  temperature?: number;
  /** Defaults to 8192 if omitted. Set higher for schemas with several
   * repeated items (e.g. a multi-step email sequence) so Gemini doesn't
   * hit the cap mid-array and return truncated, unparseable JSON. */
  maxOutputTokens?: number;
  /** Stable Langfuse generation name. Defaults to schemaName. */
  observationName?: string;
  /** Identifiers belong in metadata, never in the low-cardinality name. */
  observationMetadata?: Record<string, unknown>;
}

export interface TextGenerationRequest {
  model: string;
  systemPrompt: string;
  prompt: string;
  temperature?: number;
}

export interface GeneratedImageResult {
  bytes: Buffer;
  mimeType: "image/png";
  provider: string;
  model: string;
  metadata: Record<string, unknown>;
}

export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "low" | "medium" | "high";
}

export interface ImageEditRequest extends ImageGenerationRequest {
  referencePaths: string[];
}

export interface TextGenerationProvider {
  generateStructured<T>(input: StructuredGenerationRequest<T>): Promise<T>;
  generateText(input: TextGenerationRequest): Promise<string>;
}

export interface ImageGenerationProvider {
  generateImage(input: ImageGenerationRequest): Promise<GeneratedImageResult>;
  editImage(input: ImageEditRequest): Promise<GeneratedImageResult>;
}
