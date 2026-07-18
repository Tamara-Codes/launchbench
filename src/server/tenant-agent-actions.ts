"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "./tenant-context";

const inputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  systemPrompt: z.string().trim().min(1).max(20_000),
  avatarColor: z.enum(["emerald", "blue", "violet", "rose", "amber", "cyan"]),
});

export async function saveTenantAgent(slug: string, input: unknown) {
  try {
    const values = inputSchema.parse(input);
    const context = await getTenantContext();
    if (!context || context.role === "member") throw new Error("Only workspace owners and admins can edit agents.");

    const supabase = await createClient();
    const { error } = await supabase
      .from("workspace_agents")
      .update({ name: values.name, system_prompt: values.systemPrompt, avatar_color: values.avatarColor })
      .eq("workspace_id", context.workspace.id)
      .eq("slug", slug);

    if (error) throw new Error(error.message);

    revalidatePath(`/app/agents/${slug}`);
    revalidatePath("/app/agents");
    revalidatePath("/app");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not save agent." };
  }
}
