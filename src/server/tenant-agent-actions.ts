"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "./tenant-context";

const inputSchema = z.object({ systemPrompt: z.string().trim().min(1).max(20_000), taskPromptTemplate: z.string().trim().min(1).max(20_000), temperature: z.number().min(0).max(1), enabled: z.boolean(), note: z.string().max(500).default("") });
export async function saveTenantAgent(slug: string, input: unknown) {
  try { const values = inputSchema.parse(input); const context = await getTenantContext(); if (!context || context.role === "member") throw new Error("Only workspace owners and admins can edit agents."); const supabase = await createClient(); const { data: agent, error } = await supabase.from("workspace_agents").select("id").eq("workspace_id", context.workspace.id).eq("slug", slug).single(); if (error || !agent) throw new Error("Agent not found."); const { data: latest } = await supabase.from("workspace_agent_versions").select("version").eq("agent_id", agent.id).order("version", { ascending: false }).limit(1).maybeSingle(); const version = (latest?.version ?? 0) + 1; const { error: updateError } = await supabase.from("workspace_agents").update({ system_prompt: values.systemPrompt, task_prompt_template: values.taskPromptTemplate, temperature: values.temperature, enabled: values.enabled }).eq("id", agent.id); if (updateError) throw new Error(updateError.message); const { error: versionError } = await supabase.from("workspace_agent_versions").insert({ workspace_id: context.workspace.id, agent_id: agent.id, version, note: values.note, system_prompt: values.systemPrompt, task_prompt_template: values.taskPromptTemplate, model: "gemini-3.5-flash", temperature: values.temperature, enabled: values.enabled }); if (versionError) throw new Error(versionError.message); revalidatePath(`/app/agents/${slug}`); revalidatePath("/app/agents"); return { ok: true as const, data: { version } }; } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not save agent." }; }
}
