"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "./tenant-context";
import { getEnv } from "@/env";
import { safeErrorMessage } from "@/lib/redact";
import { recordIntegrationEvent } from "./tenant-observability";
import { composioGmail } from "@/providers/composio";

const globalTerritorySchema = z.object({
  placeId: z.string().trim().min(1).max(500),
});

type GoogleAddressComponent = { longText?: string; types?: string[] };
type GoogleCoordinate = { latitude?: number; longitude?: number };

function territoryRadius(latitude: number, longitude: number, low?: GoogleCoordinate, high?: GoogleCoordinate) {
  if (low?.latitude == null || low.longitude == null || high?.latitude == null || high.longitude == null) return 15_000;
  const latitudeM = Math.max(Math.abs(latitude - low.latitude), Math.abs(high.latitude - latitude)) * 111_320;
  const longitudeM = Math.max(Math.abs(longitude - low.longitude), Math.abs(high.longitude - longitude))
    * 111_320
    * Math.cos((latitude * Math.PI) / 180);
  return Math.min(50_000, Math.max(3_000, Math.ceil(Math.hypot(latitudeM, longitudeM))));
}

async function getGooglePlace(placeId: string) {
  const apiKey = getEnv().GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Google Places is not configured. Add GOOGLE_PLACES_API_KEY to enable territory search.");
  const startedAt = Date.now();
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "id,displayName,addressComponents,location,viewport" },
    cache: "no-store",
  });
  const requestMeta = {
    status: response.status,
    durationMs: Date.now() - startedAt,
    requestId: response.headers.get("x-google-request-id")
      ?? response.headers.get("x-request-id")
      ?? response.headers.get("x-guploader-uploadid")
      ?? "",
  };
  if (!response.ok) throw new Error(`Could not verify that location with Google Places (${response.status}, request ${requestMeta.requestId || "unavailable"}). Please choose another result.`);
  const place = await response.json() as {
    id?: string;
    displayName?: { text?: string };
    addressComponents?: GoogleAddressComponent[];
    location?: GoogleCoordinate;
    viewport?: { low?: GoogleCoordinate; high?: GoogleCoordinate };
  };
  const components = place.addressComponents ?? [];
  const valueFor = (...types: string[]) => components.find((component) => component.types?.some((type) => types.includes(type)))?.longText?.trim() ?? "";
  const town = valueFor("locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2") || place.displayName?.text?.trim() || "";
  const country = valueFor("country");
  if (!town || !country) throw new Error("Choose a city, town, or region with a country from the list.");
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  if (latitude == null || longitude == null) throw new Error("Google Places did not return a map location. Please choose another result.");
  return {
    town: town.slice(0, 120),
    country: country.slice(0, 120),
    googlePlaceId: place.id ?? placeId,
    latitude,
    longitude,
    searchRadiusM: territoryRadius(latitude, longitude, place.viewport?.low, place.viewport?.high),
    requestMeta,
  };
}

/** Adds a territory to every current project so it is available workspace-wide. */
export async function createGlobalTenantTerritory(input: unknown) {
  try {
    const { placeId } = globalTerritorySchema.parse(input);
    const context = await getTenantContext();
    if (!context || context.role === "member") throw new Error("Only workspace owners and admins can create territories.");
    const geocodeStartedAt = Date.now();
    let verifiedPlace: Awaited<ReturnType<typeof getGooglePlace>>;
    try {
      verifiedPlace = await getGooglePlace(placeId);
    } catch (error) {
      await recordIntegrationEvent({ workspaceId: context.workspace.id, provider: "google_places", operation: "verify_territory", status: "failure", durationMs: Date.now() - geocodeStartedAt, message: safeErrorMessage(error), metadata: { submittedPlaceId: placeId } });
      throw error;
    }
    const { town, country, googlePlaceId, latitude, longitude, searchRadiusM, requestMeta } = verifiedPlace;
    const supabase = await createClient();
    const { data: projects, error: projectsError } = await supabase.from("projects").select("id").eq("workspace_id", context.workspace.id);
    if (projectsError) throw new Error(projectsError.message);
    if (!projects?.length) throw new Error("Create a project before adding a territory.");
    const { error } = await supabase.from("territories").upsert(
      projects.map((project) => ({
        workspace_id: context.workspace.id,
        project_id: project.id,
        town,
        country,
        google_place_id: googlePlaceId,
        latitude,
        longitude,
        search_radius_m: searchRadiusM,
        active: true,
      })),
      { onConflict: "workspace_id,project_id,town,country" },
    );
    if (error) throw new Error(error.message);
    await recordIntegrationEvent({ workspaceId: context.workspace.id, provider: "google_places", operation: "verify_territory", status: "success", durationMs: requestMeta.durationMs, requestId: requestMeta.requestId, metadata: { httpStatus: requestMeta.status, submittedPlaceId: placeId, googlePlaceId, town, country, latitude, longitude, searchRadiusM, projectCount: projects.length } });
    revalidatePath("/app/territories");
    revalidatePath("/app/sales");
    return { ok: true as const, data: { town, country } };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not create territory." }; }
}

const leadIdSchema = z.string().uuid();

/**
 * Approving a lead pushes its drafted outreach into the workspace's
 * connected Gmail account as a real Gmail draft — never sent, just sitting
 * in Drafts for a human to review and send themselves — then records the
 * review so the lead drops out of the "awaiting review" queue.
 */
export async function approveTenantLead(input: unknown) {
  try {
    const id = leadIdSchema.parse(input);
    const context = await getTenantContext();
    if (!context) throw new Error("Not authorized.");
    const supabase = await createClient();
    const { data: lead, error: leadError } = await supabase.from("sales_leads")
      .select("id, status, email, draft_subject, draft_body")
      .eq("id", id)
      .eq("workspace_id", context.workspace.id)
      .maybeSingle();
    if (leadError || !lead) throw new Error(leadError?.message ?? "Lead not found.");
    if (lead.status !== "awaiting_review") throw new Error("This lead has already been reviewed.");
    if (!lead.email) throw new Error("This lead has no email address to draft to.");
    if (!lead.draft_subject && !lead.draft_body) throw new Error("No email draft has been generated for this lead yet.");
    if (!composioGmail.isConfigured()) throw new Error("Gmail is not configured on the server.");
    // integration_connections only grants SELECT to workspace admins via RLS
    // (its connection id/email are sensitive config data) — read it with the
    // admin client so a member approving a lead isn't wrongly told Gmail
    // isn't connected. Workspace scoping is already verified above.
    const { data: connection } = await createAdminClient().from("integration_connections")
      .select("status")
      .eq("workspace_id", context.workspace.id)
      .eq("provider", "gmail")
      .maybeSingle();
    if (connection?.status !== "active") throw new Error("Connect Gmail in Settings before approving leads.");
    const startedAt = Date.now();
    try {
      await composioGmail.createDraft(context.workspace.id, lead.email, lead.draft_subject, lead.draft_body);
    } catch (error) {
      await recordIntegrationEvent({ workspaceId: context.workspace.id, provider: "gmail", operation: "create_lead_draft", status: "failure", durationMs: Date.now() - startedAt, message: safeErrorMessage(error), metadata: { leadId: id } });
      throw error;
    }
    await recordIntegrationEvent({ workspaceId: context.workspace.id, provider: "gmail", operation: "create_lead_draft", status: "success", durationMs: Date.now() - startedAt, metadata: { leadId: id } });
    const { error: updateError } = await supabase.from("sales_leads").update({ status: "approved" }).eq("id", id).eq("workspace_id", context.workspace.id);
    if (updateError) throw new Error(updateError.message);
    await supabase.from("sales_lead_status_history").insert({ workspace_id: context.workspace.id, lead_id: id, from_status: "awaiting_review", to_status: "approved", reason: "Gmail draft created" });
    revalidatePath("/app/leads");
    return { ok: true as const };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not approve lead." }; }
}
