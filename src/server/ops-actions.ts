"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fromDateTimeLocalValue } from "@/lib/ops-dates";
import { getTenantContext } from "./tenant-context";

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * "no project" arrives as "none" from the Radix Select (which reserves "") or as
 * "" from anything else calling these actions. Company-level obligations — tax,
 * admin, outreach for the business itself — genuinely belong to no product.
 */
const optionalProductId = z
  .union([z.string().uuid(), z.literal(""), z.literal("none")])
  .default("none")
  .transform((value) => (value === "" || value === "none" ? null : value));
const optionalDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).default("").transform((value) => value || null);

const taskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  productId: optionalProductId,
  dueOn: optionalDate,
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  notes: z.string().max(4_000).default(""),
});

const eventSchema = z.object({
  title: z.string().trim().min(1).max(300),
  productId: optionalProductId,
  kind: z.enum(["meeting", "deadline", "tax", "admin", "focus"]).default("meeting"),
  // datetime-local carries no zone, so resolve it against OPS_TIMEZONE here
  // rather than letting Postgres assume UTC and shift every meeting.
  startsAt: z.string().min(1).max(40).transform(fromDateTimeLocalValue),
  endsAt: z.string().max(40).default("").transform((value) => (value ? fromDateTimeLocalValue(value) : null)),
  allDay: z.boolean().default(false),
  location: z.string().max(300).default(""),
  recurrence: z.string().max(300).default(""),
  notes: z.string().max(4_000).default(""),
});

function failure(error: unknown): ActionResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

/** The cockpit is the workspace home, so every mutation revalidates it. */
function revalidateCockpit() {
  revalidatePath("/app");
}

async function requireWriter() {
  const context = await getTenantContext();
  if (!context) throw new Error("Not authorized.");
  if (context.role === "member") throw new Error("Only workspace owners and admins can change the plan.");
  return context;
}

export async function createOpsTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const values = taskSchema.parse(input);
    const context = await requireWriter();
    const supabase = await createClient();
    const { data, error } = await supabase.from("ops_tasks").insert({
      workspace_id: context.workspace.id,
      product_id: values.productId,
      title: values.title,
      due_on: values.dueOn,
      priority: values.priority,
      notes: values.notes,
    }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Could not create the task.");
    revalidateCockpit();
    return { ok: true, data: { id: data.id } };
  } catch (error) { return failure(error); }
}

export async function updateOpsTask(id: string, input: unknown): Promise<ActionResult> {
  try {
    const taskId = z.string().uuid().parse(id);
    const values = taskSchema.parse(input);
    await requireWriter();
    const supabase = await createClient();
    const { error } = await supabase.from("ops_tasks").update({
      product_id: values.productId,
      title: values.title,
      due_on: values.dueOn,
      priority: values.priority,
      notes: values.notes,
    }).eq("id", taskId);
    if (error) throw new Error(error.message);
    revalidateCockpit();
    return { ok: true };
  } catch (error) { return failure(error); }
}

/** completed_at and status move together — the table has a check constraint
 * tying them, so a half-update fails loudly rather than drifting. */
export async function setOpsTaskStatus(id: string, status: "open" | "done" | "dropped"): Promise<ActionResult> {
  try {
    const taskId = z.string().uuid().parse(id);
    const nextStatus = z.enum(["open", "done", "dropped"]).parse(status);
    await requireWriter();
    const supabase = await createClient();
    const { error } = await supabase.from("ops_tasks").update({
      status: nextStatus,
      completed_at: nextStatus === "done" ? new Date().toISOString() : null,
    }).eq("id", taskId);
    if (error) throw new Error(error.message);
    revalidateCockpit();
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function deleteOpsTask(id: string): Promise<ActionResult> {
  try {
    const taskId = z.string().uuid().parse(id);
    await requireWriter();
    const supabase = await createClient();
    const { error } = await supabase.from("ops_tasks").delete().eq("id", taskId);
    if (error) throw new Error(error.message);
    revalidateCockpit();
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function createOpsEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const values = eventSchema.parse(input);
    const context = await requireWriter();
    const supabase = await createClient();
    const { data, error } = await supabase.from("ops_events").insert({
      workspace_id: context.workspace.id,
      product_id: values.productId,
      title: values.title,
      kind: values.kind,
      starts_at: values.startsAt,
      ends_at: values.endsAt,
      all_day: values.allDay,
      location: values.location,
      recurrence: values.recurrence,
      notes: values.notes,
    }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Could not create the event.");
    revalidateCockpit();
    return { ok: true, data: { id: data.id } };
  } catch (error) { return failure(error); }
}

export async function updateOpsEvent(id: string, input: unknown): Promise<ActionResult> {
  try {
    const eventId = z.string().uuid().parse(id);
    const values = eventSchema.parse(input);
    await requireWriter();
    const supabase = await createClient();
    const { error } = await supabase.from("ops_events").update({
      product_id: values.productId,
      title: values.title,
      kind: values.kind,
      starts_at: values.startsAt,
      ends_at: values.endsAt,
      all_day: values.allDay,
      location: values.location,
      recurrence: values.recurrence,
      notes: values.notes,
    }).eq("id", eventId);
    if (error) throw new Error(error.message);
    revalidateCockpit();
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function deleteOpsEvent(id: string): Promise<ActionResult> {
  try {
    const eventId = z.string().uuid().parse(id);
    await requireWriter();
    const supabase = await createClient();
    const { error } = await supabase.from("ops_events").delete().eq("id", eventId);
    if (error) throw new Error(error.message);
    revalidateCockpit();
    return { ok: true };
  } catch (error) { return failure(error); }
}
