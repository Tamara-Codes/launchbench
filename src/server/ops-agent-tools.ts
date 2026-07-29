import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dayKey } from "@/lib/ops-dates";
import { createOpsEvent, createOpsTask, deleteOpsTask, setOpsTaskStatus, updateOpsTask } from "./ops-actions";
import { requestTenantJob } from "./tenant-job-actions";

/**
 * The agent's tools.
 *
 * Every write goes through the same server action the UI buttons call, so the
 * agent cannot reach past the validation and check constraints the forms obey.
 * That is also why the date helpers reject 2026-02-30: a date picker cannot
 * produce it, but a model can.
 *
 * Reads are mostly absent on purpose — the current state is already in the
 * system prompt, so a `list_tasks` tool would just burn a round trip. The two
 * exceptions are the transcript (too large to inline) and project lookup.
 */

type ToolContext = { workspaceId: string };

/** Resolves a project by name so the model never has to know UUIDs. */
async function resolveProject(workspaceId: string, name?: string): Promise<string> {
  if (!name || name.toLowerCase() === "company" || name.toLowerCase() === "none") return "none";
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("id, name").eq("workspace_id", workspaceId);
  const wanted = name.trim().toLowerCase();
  const match = (data ?? []).find((product) => product.name.toLowerCase() === wanted)
    ?? (data ?? []).find((product) => product.name.toLowerCase().includes(wanted));
  if (!match) throw new Error(`No project called "${name}". Known projects: ${(data ?? []).map((p) => p.name).join(", ")}.`);
  return match.id;
}

const unwrap = <T,>(result: { ok: true; data?: T } | { ok: false; error: string }): T | "done" => {
  if (!result.ok) throw new Error(result.error);
  return result.data ?? "done";
};

export function opsTools({ workspaceId }: ToolContext) {
  return {
    add_task: tool({
      description: "Add a task to her list. Use for anything she says she needs to do.",
      inputSchema: z.object({
        title: z.string().describe("Short imperative phrasing, e.g. 'Send Sonja the demo link'."),
        due_on: z.string().optional().describe("YYYY-MM-DD. Omit entirely if she gave no date — do not guess one."),
        project: z.string().optional().describe("Project name, or omit for company-level work like tax or admin."),
        priority: z.enum(["low", "normal", "high"]).optional(),
        notes: z.string().optional(),
      }),
      execute: async ({ title, due_on, project, priority, notes }) => {
        const productId = await resolveProject(workspaceId, project);
        return unwrap(await createOpsTask({ title, dueOn: due_on ?? "", productId, priority: priority ?? "normal", notes: notes ?? "" }));
      },
    }),

    complete_task: tool({
      description: "Mark a task done. Task ids appear in square brackets in the state above.",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => unwrap(await setOpsTaskStatus(id, "done")),
    }),

    drop_task: tool({
      description: "Drop a task she no longer intends to do. Prefer this over deleting.",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => unwrap(await setOpsTaskStatus(id, "dropped")),
    }),

    delete_task: tool({
      description: "Permanently delete a task. Only when she asks for it to be removed entirely.",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => unwrap(await deleteOpsTask(id)),
    }),

    reschedule_task: tool({
      description: "Change a task's due date, priority, or title.",
      inputSchema: z.object({
        id: z.string().uuid(),
        title: z.string(),
        due_on: z.string().optional().describe("YYYY-MM-DD, or empty string to clear the date."),
        project: z.string().optional(),
        priority: z.enum(["low", "normal", "high"]).optional(),
        notes: z.string().optional(),
      }),
      execute: async ({ id, title, due_on, project, priority, notes }) => {
        const productId = await resolveProject(workspaceId, project);
        return unwrap(await updateOpsTask(id, { title, dueOn: due_on ?? "", productId, priority: priority ?? "normal", notes: notes ?? "" }));
      },
    }),

    add_event: tool({
      description: "Add a dated obligation: a meeting, deadline, tax date, admin block, or focus block.",
      inputSchema: z.object({
        title: z.string(),
        kind: z.enum(["meeting", "deadline", "tax", "admin", "focus"]),
        starts_at: z.string().describe("Local wall-clock time as YYYY-MM-DDTHH:mm. Never guess a deadline date — ask instead."),
        ends_at: z.string().optional().describe("Same format. Omit if unknown."),
        all_day: z.boolean().optional(),
        location: z.string().optional(),
        recurrence: z.string().optional().describe("Free text like 'every quarter'. Not parsed, just recorded."),
        project: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async ({ title, kind, starts_at, ends_at, all_day, location, recurrence, project, notes }) => {
        const productId = await resolveProject(workspaceId, project);
        return unwrap(await createOpsEvent({
          title, kind, startsAt: starts_at, endsAt: ends_at ?? "", allDay: all_day ?? false,
          location: location ?? "", recurrence: recurrence ?? "", productId, notes: notes ?? "",
        }));
      },
    }),

    remember: tool({
      description:
        "Record something durable about her, her products, her clients, or a decision. "
        + "CHECK THE EXISTING FACTS FIRST: if one already covers this subject, pass its exact slug so it is updated instead of duplicated.",
      inputSchema: z.object({
        slug: z.string().regex(/^[a-z0-9-]+$/).describe("Short kebab-case handle naming the SUBJECT, e.g. 'frederick-comp'."),
        kind: z.enum(["context", "preference", "decision", "person", "constraint", "reference"]),
        body: z.string().describe("One or two sentences. Convert relative dates to absolute ones."),
        project: z.string().optional(),
      }),
      execute: async ({ slug, kind, body, project }) => {
        const productId = await resolveProject(workspaceId, project);
        const supabase = await createClient();
        const { error } = await supabase.from("ops_facts").upsert(
          {
            workspace_id: workspaceId,
            slug,
            kind,
            body,
            product_id: productId === "none" ? null : productId,
            source: "agent",
          },
          { onConflict: "workspace_id,slug" },
        );
        if (error) throw new Error(error.message);
        return { remembered: slug };
      },
    }),

    forget: tool({
      description: "Delete a fact that is wrong or no longer true. Use the slug.",
      inputSchema: z.object({ slug: z.string() }),
      execute: async ({ slug }) => {
        const supabase = await createClient();
        const { error } = await supabase.from("ops_facts").delete().eq("workspace_id", workspaceId).eq("slug", slug);
        if (error) throw new Error(error.message);
        return { forgotten: slug };
      },
    }),

    search_messages: tool({
      description:
        "Search the full conversation history for older messages. Use this before saying you cannot remember something — "
        + "only the most recent messages are shown to you verbatim.",
      inputSchema: z.object({ query: z.string(), limit: z.number().int().min(1).max(25).optional() }),
      execute: async ({ query, limit }) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("ops_messages")
          .select("id, role, content, created_at")
          .eq("workspace_id", workspaceId)
          .ilike("content", `%${query}%`)
          .order("id", { ascending: false })
          .limit(limit ?? 10);
        if (error) throw new Error(error.message);
        return (data ?? []).map((message) => ({
          when: dayKey(new Date(message.created_at)),
          role: message.role,
          content: message.content.slice(0, 600),
        }));
      },
    }),

    draft_post: tool({
      description:
        "Save a draft post for X (or another platform) against a project. It lands in the content library as an idea, "
        + "scheduled if a time is given. Her posting window is 18:00-01:00 CEST.",
      inputSchema: z.object({
        project: z.string().describe("Use 'Personal Brand' for journey and reinvention posts about herself."),
        hook: z.string().describe("The opening line — the part that has to earn the scroll-stop."),
        caption: z.string().describe("The full post body."),
        scheduled_for: z.string().optional().describe("YYYY-MM-DDTHH:mm local. Omit to leave it unscheduled."),
        notes: z.string().optional().describe("Why this should work — the reasoning behind the draft."),
      }),
      execute: async ({ project, hook, caption, scheduled_for, notes }) => {
        const productId = await resolveProject(workspaceId, project);
        if (productId === "none") throw new Error("A post needs a project. Use 'Personal Brand' for posts about herself.");
        const supabase = await createClient();
        const { data, error } = await supabase.from("content_items").insert({
          workspace_id: workspaceId,
          product_id: productId,
          platform: "x",
          format: "single_image",
          content_type: "post",
          hook,
          caption,
          language: "en",
          status: scheduled_for ? "scheduled" : "idea",
          scheduled_for: scheduled_for ? new Date(scheduled_for).toISOString() : null,
          notes: notes ?? "",
        }).select("id").single();
        if (error) throw new Error(error.message);
        return { draftId: data.id, status: scheduled_for ? "scheduled" : "idea" };
      },
    }),

    run_lead_finder: tool({
      description:
        "Queue the Lead Finder to research businesses for a project in one of its territories. Runs for minutes in the "
        + "background and spends real money on scraping, so only run it when she asks.",
      inputSchema: z.object({
        project: z.string(),
        territory: z.string().describe("Town name of an existing territory for that project."),
        target_leads: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ project, territory, target_leads }) => {
        const productId = await resolveProject(workspaceId, project);
        if (productId === "none") throw new Error("The lead finder runs against a specific project.");
        const supabase = await createClient();
        // Territories belong to a product, so the lookup must be scoped to it.
        const { data: territories } = await supabase
          .from("territories")
          .select("id, town")
          .eq("workspace_id", workspaceId)
          .eq("product_id", productId)
          .eq("active", true);
        const wanted = territory.trim().toLowerCase();
        const match = (territories ?? []).find((entry) => entry.town.toLowerCase() === wanted)
          ?? (territories ?? []).find((entry) => entry.town.toLowerCase().includes(wanted));
        if (!match) {
          const known = (territories ?? []).map((entry) => entry.town).join(", ");
          throw new Error(known
            ? `No active territory matching "${territory}" for ${project}. Known: ${known}.`
            : `${project} has no territories yet — she needs to add one on the Territories page first.`);
        }
        const queued = await requestTenantJob({
          kind: "lead_search",
          productId,
          input: { territoryId: match.id, targetLeads: target_leads ?? 10 },
        });
        if (!queued.ok) throw new Error(queued.error);
        return { queued: true, territory: match.town, note: "Progress is on the Search History page." };
      },
    }),

    run_content_agent: tool({
      description:
        "Queue the Content Agent to generate post ideas for a project. Runs for minutes in the background. "
        + "Prefer `draft_post` when she just wants one post written now.",
      inputSchema: z.object({
        project: z.string(),
        content_type: z.string().describe("What kind of content, e.g. 'build-in-public update' or 'reinvention story'."),
        format: z.enum(["single_image", "carousel", "story"]).optional(),
        mode: z.enum(["caption", "image", "full"]).optional(),
        variations: z.number().int().min(1).max(3).optional(),
        extra_instruction: z.string().optional(),
      }),
      execute: async ({ project, content_type, format, mode, variations, extra_instruction }) => {
        const productId = await resolveProject(workspaceId, project);
        if (productId === "none") throw new Error("The content agent runs against a specific project.");
        const supabase = await createClient();
        // Default the language to the product's own rather than the schema's 'hr'.
        const { data: product } = await supabase
          .from("products")
          .select("preferred_language")
          .eq("id", productId)
          .maybeSingle();
        const queued = await requestTenantJob({
          kind: "content_generation",
          productId,
          input: {
            contentType: content_type,
            format: format ?? "single_image",
            mode: mode ?? "caption",
            language: product?.preferred_language ?? "en",
            variations: variations ?? 1,
            extraInstruction: extra_instruction ?? "",
          },
        });
        if (!queued.ok) throw new Error(queued.error);
        return { queued: true, note: "Results appear in Content History." };
      },
    }),
  };
}
