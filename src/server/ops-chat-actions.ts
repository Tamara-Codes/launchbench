"use server";

import { revalidatePath } from "next/cache";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { getEnv } from "@/env";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "./tenant-context";
import { opsTools } from "./ops-agent-tools";
import {
  appendMessage,
  buildSystemPrompt,
  loadFacts,
  loadMessagesBefore,
  loadRecentMessages,
  updateSummaryIfNeeded,
  type StoredMessage,
  type ToolCallRecord,
} from "./ops-chat";

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * The agent turn.
 *
 * This is the whole "graph": one call to generateText, which loops internally
 * whenever the model asks for a tool. There are no branches to model, so there
 * is no state machine — a step limit is the only control flow.
 */

/** Enough for a few tool calls plus a reply; a runaway loop stops here. */
const MAX_STEPS = 10;

function failure(error: unknown): ActionResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

function model() {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured on the server.");
  // The provider defaults to GOOGLE_GENERATIVE_AI_API_KEY; this app stores the
  // key as GEMINI_API_KEY, so pass it explicitly.
  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  return google(env.GEMINI_MODEL);
}

/** Stored rows become the model's message list; tool traffic is not replayed. */
function toModelMessages(stored: StoredMessage[]): ModelMessage[] {
  return stored
    .filter((message) => message.role !== "tool" && message.content.trim().length > 0)
    .map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }));
}

export async function sendOpsMessage(input: unknown): Promise<ActionResult<{ reply: string; toolCalls: ToolCallRecord[] }>> {
  try {
    const { text, page } = z.object({ text: z.string().trim().min(1).max(4_000), page: z.string().max(60).optional() }).parse(input);
    const context = await getTenantContext();
    if (!context) throw new Error("Not authorized.");
    if (context.role === "member") throw new Error("Only workspace owners and admins can use the ops agent.");

    await appendMessage(context.workspace.id, { role: "user", content: text });

    // Built AFTER saving, so the turn's own message is in the history exactly once.
    const [system, history] = await Promise.all([
      buildSystemPrompt(context.workspace.id, page),
      loadRecentMessages(context.workspace.id),
    ]);

    const result = await generateText({
      model: model(),
      system,
      messages: toModelMessages(history),
      tools: opsTools({ workspaceId: context.workspace.id }),
      stopWhen: stepCountIs(MAX_STEPS),
      temperature: 0.3,
    });

    // Flatten what actually happened so the UI can show it and it stays auditable.
    const toolCalls: ToolCallRecord[] = result.steps.flatMap((step) =>
      step.toolCalls.map((call) => {
        const outcome = step.toolResults.find((entry) => entry.toolCallId === call.toolCallId);
        return {
          name: call.toolName,
          input: call.input,
          // A tool that threw surfaces as an error result rather than vanishing.
          ...(outcome && "output" in outcome ? { output: outcome.output } : {}),
          ...(outcome && "error" in outcome ? { error: String((outcome as { error: unknown }).error) } : {}),
        } satisfies ToolCallRecord;
      }),
    );

    const reply = result.text.trim() || (toolCalls.length ? "Done." : "I had nothing to say to that.");
    await appendMessage(context.workspace.id, { role: "assistant", content: reply, tool_calls: toolCalls });

    // Fold aged-out messages into the summary. Best-effort: a summariser failure
    // must not lose the reply the user is waiting for.
    try {
      await updateSummaryIfNeeded(context.workspace.id, async (prompt) => {
        const summary = await generateText({ model: model(), prompt, temperature: 0 });
        return summary.text.trim();
      });
    } catch {
      // Intentionally ignored; the next turn will try again.
    }

    // Tools may have changed tasks, events, or content anywhere in the app.
    revalidatePath("/app");
    revalidatePath("/app/calendar");
    return { ok: true, data: { reply, toolCalls } };
  } catch (error) { return failure(error); }
}

export async function loadOpsHistory(beforeId?: number): Promise<ActionResult<{ messages: StoredMessage[] }>> {
  try {
    const context = await getTenantContext();
    if (!context) throw new Error("Not authorized.");
    const messages = beforeId
      ? await loadMessagesBefore(context.workspace.id, z.number().int().positive().parse(beforeId))
      : await loadRecentMessages(context.workspace.id, 40);
    return { ok: true, data: { messages } };
  } catch (error) { return failure(error); }
}

export async function loadOpsFacts(): Promise<ActionResult<{ facts: Awaited<ReturnType<typeof loadFacts>> }>> {
  try {
    const context = await getTenantContext();
    if (!context) throw new Error("Not authorized.");
    return { ok: true, data: { facts: await loadFacts(context.workspace.id) } };
  } catch (error) { return failure(error); }
}

/** Manual correction of the agent's memory, from the widget's memory panel. */
export async function deleteOpsFact(slug: string): Promise<ActionResult> {
  try {
    const context = await getTenantContext();
    if (!context) throw new Error("Not authorized.");
    if (context.role === "member") throw new Error("Only workspace owners and admins can edit memory.");
    const supabase = await createClient();
    const { error } = await supabase
      .from("ops_facts")
      .delete()
      .eq("workspace_id", context.workspace.id)
      .eq("slug", z.string().min(1).parse(slug));
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (error) { return failure(error); }
}
