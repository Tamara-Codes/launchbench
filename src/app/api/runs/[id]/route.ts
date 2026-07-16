import { NextResponse } from "next/server";
import { getRun, getRunCandidateBreakdown, getRunEvents } from "@/server/repo";
import { isRunningInProcess } from "@/server/run-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const [events, breakdown] = await Promise.all([
    getRunEvents(id, 100),
    getRunCandidateBreakdown(id),
  ]);
  return NextResponse.json({
    run,
    events: events.map((e) => ({
      id: e.id,
      message: e.message,
      stage: (e.metadata as { stage?: string } | null)?.stage ?? "",
      createdAt: e.createdAt,
    })),
    breakdown,
    runningInProcess: isRunningInProcess(id),
  });
}
