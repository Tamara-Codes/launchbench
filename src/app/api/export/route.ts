import { db } from "@/db";
import {
  agents,
  emailTemplates,
  followUpRules,
  leadSources,
  leads,
  products,
  scheduledFollowUps,
  searchRuns,
  sentEmails,
  territories,
} from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(","));
  return lines.join("\n");
}

export async function GET(req: Request) {
  const type = new URL(req.url).searchParams.get("type") ?? "leads-json";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");

  if (type === "leads-csv") {
    const rows = await db.select().from(leads).orderBy(leads.createdAt);
    const flat = rows.map((l) => ({
      id: l.id,
      businessName: l.businessName,
      town: l.town,
      email: l.email,
      phone: l.phone,
      website: l.website,
      estimatedUnits: l.estimatedUnits ?? "",
      status: l.status,
      leadScore: l.leadScore,
      createdAt: l.createdAt.toISOString(),
      lastContactedAt: l.lastContactedAt?.toISOString() ?? "",
    }));
    return new Response(toCsv(flat), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="leads-${stamp}.csv"`,
      },
    });
  }

  if (type === "leads-json") {
    const rows = await db.select().from(leads).orderBy(leads.createdAt);
    return new Response(JSON.stringify(rows, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="leads-${stamp}.json"`,
      },
    });
  }

  // all-json: full application export.
  const [
    allLeads,
    allSources,
    allSent,
    allTerritories,
    allRuns,
    allProducts,
    allAgents,
    allTemplates,
    allFollowUps,
    allRules,
  ] = await Promise.all([
    db.select().from(leads),
    db.select().from(leadSources),
    db.select().from(sentEmails),
    db.select().from(territories),
    db.select().from(searchRuns),
    db.select().from(products),
    db.select().from(agents),
    db.select().from(emailTemplates),
    db.select().from(scheduledFollowUps),
    db.select().from(followUpRules),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    leads: allLeads,
    leadSources: allSources,
    sentEmails: allSent,
    territories: allTerritories,
    searchRuns: allRuns,
    products: allProducts,
    agents: allAgents,
    emailTemplates: allTemplates,
    scheduledFollowUps: allFollowUps,
    followUpRules: allRules,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="launchbench-export-${stamp}.json"`,
    },
  });
}
