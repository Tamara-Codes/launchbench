"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "./tenant-context";

const territorySchema = z.object({
  productId: z.string().uuid(),
  town: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(120).default("Croatia"),
  includedSettlements: z.string().max(2_000).default(""),
  excludedSettlements: z.string().max(2_000).default(""),
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
