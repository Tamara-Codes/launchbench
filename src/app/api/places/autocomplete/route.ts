import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/env";
import { getTenantContext } from "@/server/tenant-context";

const querySchema = z.object({ input: z.string().trim().min(2).max(160) });

export async function GET(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = querySchema.safeParse({ input: new URL(request.url).searchParams.get("input") ?? "" });
  if (!parsed.success) return NextResponse.json({ suggestions: [] });
  const apiKey = getEnv().GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Google Places is not configured." }, { status: 503 });
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text" },
      body: JSON.stringify({ input: parsed.data.input, includedPrimaryTypes: ["(cities)"] }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Google Places request failed");
    const data = await response.json() as { suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string } } }> };
    const suggestions = (data.suggestions ?? []).flatMap(({ placePrediction }) => placePrediction?.placeId && placePrediction.text?.text ? [{ placeId: placePrediction.placeId, label: placePrediction.text.text }] : []);
    return NextResponse.json({ suggestions });
  } catch { return NextResponse.json({ error: "Could not search places right now." }, { status: 502 }); }
}
