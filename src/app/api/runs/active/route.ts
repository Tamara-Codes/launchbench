import { NextResponse } from "next/server";
import { getActiveRun } from "@/server/run-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const territoryId = url.searchParams.get("territoryId") ?? undefined;
  const run = await getActiveRun(territoryId);
  return NextResponse.json({ run });
}
