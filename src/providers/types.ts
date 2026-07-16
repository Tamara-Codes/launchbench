import type { z } from "zod";

export interface StructuredGenerationRequest<T> {
  model: string;
  systemPrompt: string;
  prompt: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  schemaName: string;
  temperature?: number;
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
