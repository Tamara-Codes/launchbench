import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dayKey, dayLabel, daysFromToday, timeLabel } from "@/lib/ops-dates";
import type { OpsFact, StoredMessage, ToolCallRecord } from "@/lib/ops-chat-types";
import { loadCockpit } from "./ops-cockpit";

/**
 * Everything the chat agent knows, assembled fresh on every turn.
 *
 * Three tiers with three different lifetimes:
 *   1. Live state  — rebuilt from SQL each turn. Never stale, never stored.
 *   2. Facts       — the whole ops_facts table, verbatim. Small enough to fit.
 *   3. Transcript  — the last N messages plus a rolling summary of the rest.
 *
 * Deliberately no retrieval step. At one operator's scale everything durable
 * fits in the prompt, and embeddings would add a sync problem to solve a size
 * problem that does not exist yet. `search_messages` covers the one thing too
 * big to inline: the full transcript.
 */

/** How many messages go to the model verbatim before the summary takes over. */
export const VERBATIM_WINDOW = 30;

export type { OpsFact, StoredMessage, ToolCallRecord };

export async function loadFacts(workspaceId: string): Promise<OpsFact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ops_facts")
    .select("id, slug, kind, body, source, project_id, updated_at")
    .eq("workspace_id", workspaceId)
    .order("kind")
    .order("slug");
  return (data ?? []) as OpsFact[];
}

/** The newest messages, oldest-first so they read as a conversation. */
export async function loadRecentMessages(workspaceId: string, limit = VERBATIM_WINDOW): Promise<StoredMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ops_messages")
    .select("id, role, content, tool_calls, created_at")
    .eq("workspace_id", workspaceId)
    .order("id", { ascending: false })
    .limit(limit);
  return ((data ?? []) as StoredMessage[]).reverse();
}

/** One page of history for the widget's scrollback. */
export async function loadMessagesBefore(workspaceId: string, beforeId: number, limit = 40): Promise<StoredMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ops_messages")
    .select("id, role, content, tool_calls, created_at")
    .eq("workspace_id", workspaceId)
    .lt("id", beforeId)
    .order("id", { ascending: false })
    .limit(limit);
  return ((data ?? []) as StoredMessage[]).reverse();
}

export async function loadChatState(workspaceId: string): Promise<{ summary: string; summarized_through_id: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ops_chat_state")
    .select("summary, summarized_through_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data ?? { summary: "", summarized_through_id: 0 };
}

export async function appendMessage(
  workspaceId: string,
  message: { role: StoredMessage["role"]; content: string; tool_calls?: ToolCallRecord[] },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("ops_messages").insert({
    workspace_id: workspaceId,
    role: message.role,
    content: message.content,
    tool_calls: message.tool_calls ?? [],
  });
  if (error) throw new Error(error.message);
}

/**
 * Renders the live snapshot. Reuses loadCockpit so the agent and the Today page
 * can never disagree about what is due — two assemblies would drift until the
 * agent contradicted the screen.
 */
async function renderLiveState(workspaceId: string): Promise<string> {
  const cockpit = await loadCockpit(workspaceId);
  const { today, projects, counts } = cockpit;
  const nameOf = (id: string | null) => (id ? projects.find((project) => project.id === id)?.name ?? "unknown" : "Company");

  const lines: string[] = [];
  lines.push(`Today is ${dayLabel(today)} (${today}).`);
  lines.push(`Projects: ${projects.map((project) => project.name).join(", ") || "none yet"}.`);
  lines.push(`Open tasks: ${counts.openTotal} (${counts.overdue} overdue). Posts scheduled for X today: ${counts.postsToday}.`);
  lines.push(`Leads awaiting review: ${counts.leadsToReview}. Content awaiting review: ${counts.contentToReview}.`);

  if (cockpit.nextDeadline) {
    const days = daysFromToday(dayKey(new Date(cockpit.nextDeadline.starts_at)), today);
    lines.push(`Next hard deadline: ${cockpit.nextDeadline.title} in ${days} day(s).`);
  }

  const todayEvents = cockpit.events.filter((event) => dayKey(new Date(event.starts_at)) === today);
  if (todayEvents.length) {
    lines.push("", "On today:");
    for (const event of todayEvents) {
      lines.push(`- ${event.all_day ? "all day" : timeLabel(event.starts_at)} ${event.title} [${event.kind}] (${nameOf(event.project_id)})`);
    }
  }

  if (cockpit.dueTasks.length) {
    lines.push("", "Due today or overdue:");
    for (const task of cockpit.dueTasks) {
      const late = task.due_on ? -daysFromToday(task.due_on, today) : 0;
      lines.push(`- [${task.id}] ${task.title}${late > 0 ? ` (${late}d late)` : ""} (${nameOf(task.project_id)})`);
    }
  }

  if (cockpit.events.some((event) => dayKey(new Date(event.starts_at)) !== today) || cockpit.upcomingTasks.length) {
    lines.push("", "Next 7 days:");
    for (const event of cockpit.events) {
      const key = dayKey(new Date(event.starts_at));
      if (key === today) continue;
      lines.push(`- ${key} ${event.all_day ? "" : timeLabel(event.starts_at)} ${event.title} [${event.kind}]`);
    }
    for (const task of cockpit.upcomingTasks) {
      lines.push(`- ${task.due_on} task: ${task.title} (${nameOf(task.project_id)})`);
    }
  }

  if (cockpit.unscheduledTasks.length) {
    lines.push("", `Undated open tasks (${cockpit.unscheduledTasks.length}):`);
    // Capped: the undated pile can be long, and the agent can search for more.
    for (const task of cockpit.unscheduledTasks.slice(0, 40)) {
      lines.push(`- [${task.id}] ${task.title} (${nameOf(task.project_id)})`);
    }
    if (cockpit.unscheduledTasks.length > 40) lines.push(`- …and ${cockpit.unscheduledTasks.length - 40} more.`);
  }

  return lines.join("\n");
}

function renderFacts(facts: OpsFact[], projects: { id: string; name: string }[]): string {
  if (!facts.length) return "You have not recorded anything about her yet.";
  return facts
    .map((fact) => {
      const project = fact.project_id ? projects.find((entry) => entry.id === fact.project_id)?.name : null;
      return `- [${fact.slug}] (${fact.kind}${project ? `, ${project}` : ""}) ${fact.body}`;
    })
    .join("\n");
}

/**
 * The behavioural rules. The update-over-insert rule for `remember` is the most
 * load-bearing line here: without it ops_facts fills with four slightly
 * different versions of the same fact within a fortnight.
 */
function rules(): string {
  return [
    "You are 007, Tamara's ops agent inside Launchbench, her own company dashboard. She named you 007; use it if she asks who you are, and do not make a running joke of it. She is a solo founder running several projects at once while holding a full-time job.",
    "",
    "How to behave:",
    "- Be brief and concrete. She is checking in between other work, not reading an essay.",
    "- When she states something that will still matter next week, call `remember`. When she states something to do, call `add_task`. Do both in one turn when both apply, without asking permission first — everything you write is visible and undoable in the UI.",
    "- Before calling `remember`, check the existing facts below. If one already covers the subject, reuse ITS EXACT SLUG so the fact is updated rather than duplicated. Only invent a new slug for a genuinely new subject.",
    "- Slugs are short, kebab-case, and name the subject rather than the moment: `frederick-comp`, not `july-meeting-notes`.",
    "- Never invent dates, prices, or facts about people. If you do not know, say so or ask.",
    "- She works across all her projects at once, so answer across all of them unless she names one.",
    "- Deadlines and tax dates are real obligations: never guess one. If she has not given you the date, ask for it.",
    "- If a question depends on something older than the recent messages, call `search_messages` before saying you do not know.",
  ].join("\n");
}

export async function buildSystemPrompt(workspaceId: string, currentPage?: string): Promise<string> {
  const [liveState, facts, chatState] = await Promise.all([
    renderLiveState(workspaceId),
    loadFacts(workspaceId),
    loadChatState(workspaceId),
  ]);
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("id, name").eq("workspace_id", workspaceId);

  const sections = [
    rules(),
    "",
    "## Right now (rebuilt every turn — always trust this over your memory)",
    liveState,
    "",
    "## What you know about her (reuse these slugs when updating)",
    renderFacts(facts, projects ?? []),
  ];

  if (chatState.summary) {
    sections.push("", "## Earlier conversation (summarised)", chatState.summary);
  }
  if (currentPage) {
    sections.push("", `## Context`, `She is currently looking at the ${currentPage} page.`);
  }

  return sections.join("\n");
}

/**
 * Folds messages that have aged out of the verbatim window into the rolling
 * summary. Incremental by design: it only reads what it has not summarised yet,
 * so this stays cheap no matter how long the history grows.
 */
export async function updateSummaryIfNeeded(workspaceId: string, summarise: (input: string) => Promise<string>): Promise<void> {
  const supabase = await createClient();
  const { data: newest } = await supabase
    .from("ops_messages")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!newest) return;

  const state = await loadChatState(workspaceId);
  // Anything older than the verbatim window is a candidate for summarising.
  const cutoff = newest.id - VERBATIM_WINDOW;
  if (cutoff <= state.summarized_through_id) return;

  const { data: aged } = await supabase
    .from("ops_messages")
    .select("id, role, content")
    .eq("workspace_id", workspaceId)
    .gt("id", state.summarized_through_id)
    .lte("id", cutoff)
    .order("id");
  if (!aged?.length) return;

  const transcript = aged.map((message) => `${message.role}: ${message.content}`).join("\n");
  const summary = await summarise(
    [
      state.summary ? `Existing summary:\n${state.summary}` : "There is no existing summary yet.",
      "",
      "New messages to fold in:",
      transcript,
      "",
      "Rewrite the summary so it covers both. Keep decisions, commitments, open questions, and anything about people or money. Drop small talk and anything already recorded as a durable fact. Under 400 words.",
    ].join("\n"),
  );

  await supabase.from("ops_chat_state").upsert({
    workspace_id: workspaceId,
    summary,
    summarized_through_id: aged.at(-1)!.id,
  });
}
