/**
 * Types shared between the chat's server code and its client widget.
 *
 * They live here rather than in `server/ops-chat.ts` so the client never
 * imports a `server-only` module at all, even as an erased type import.
 */

export type ToolCallRecord = { name: string; input: unknown; output?: unknown; error?: string };

export type StoredMessage = {
  id: number;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls: ToolCallRecord[];
  created_at: string;
};

export type OpsFact = {
  id: string;
  slug: string;
  kind: string;
  body: string;
  source: string;
  product_id: string | null;
  updated_at: string;
};
