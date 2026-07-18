"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "./tenant-context";
import { getEnv } from "@/env";

const territorySchema = z.object({
  productId: z.string().uuid(),
  town: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(120).default("Croatia"),
  includedSettlements: z.string().max(2_000).default(""),
  excludedSettlements: z.string().max(2_000).default(""),
});

const globalTerritorySchema = z.object({
  placeId: z.string().trim().min(1).max(500),
});

function parseList(value: string) {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean))).slice(0, 100);
}

export async function createTenantTerritory(input: unknown) {
  try {
    const values = territorySchema.parse(input);
    const context = await getTenantContext();
    if (!context || context.role === "member") throw new Error("Only workspace owners and admins can create territories.");
    const supabase = await createClient();
    const { data: product } = await supabase.from("products").select("id").eq("id", values.productId).eq("workspace_id", context.workspace.id).maybeSingle();
    if (!product) throw new Error("Product not found in this workspace.");
    const { error } = await supabase.from("territories").insert({
      workspace_id: context.workspace.id, product_id: values.productId, town: values.town, country: values.country,
      included_settlements: parseList(values.includedSettlements), excluded_settlements: parseList(values.excludedSettlements), active: true,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/app/sales");
    return { ok: true as const };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not create territory." }; }
}

type GoogleAddressComponent = { longText?: string; types?: string[] };

async function getGooglePlace(placeId: string) {
  const apiKey = getEnv().GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Google Places is not configured. Add GOOGLE_PLACES_API_KEY to enable territory search.");
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "displayName,addressComponents" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not verify that location with Google Places. Please choose another result.");
  const place = await response.json() as { displayName?: { text?: string }; addressComponents?: GoogleAddressComponent[] };
  const components = place.addressComponents ?? [];
  const valueFor = (...types: string[]) => components.find((component) => component.types?.some((type) => types.includes(type)))?.longText?.trim() ?? "";
  const town = valueFor("locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2") || place.displayName?.text?.trim() || "";
  const country = valueFor("country");
  if (!town || !country) throw new Error("Choose a city, town, or region with a country from the list.");
  return { town: town.slice(0, 120), country: country.slice(0, 120) };
}

/** Adds a territory to every current project so it is available workspace-wide. */
export async function createGlobalTenantTerritory(input: unknown) {
  try {
    const { placeId } = globalTerritorySchema.parse(input);
    const context = await getTenantContext();
    if (!context || context.role === "member") throw new Error("Only workspace owners and admins can create territories.");
    const { town, country } = await getGooglePlace(placeId);
    const supabase = await createClient();
    const { data: products, error: productsError } = await supabase.from("products").select("id").eq("workspace_id", context.workspace.id);
    if (productsError) throw new Error(productsError.message);
    if (!products?.length) throw new Error("Create a project before adding a territory.");
    const { error } = await supabase.from("territories").upsert(
      products.map((product) => ({ workspace_id: context.workspace.id, product_id: product.id, town, country, active: true })),
      { onConflict: "workspace_id,product_id,town,country" },
    );
    if (error) throw new Error(error.message);
    revalidatePath("/app/settings");
    revalidatePath("/app/sales");
    return { ok: true as const, data: { town, country } };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Could not create territory." }; }
}
