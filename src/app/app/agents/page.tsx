import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import { AgentAvatar } from "@/components/agent-avatar";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/ui";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";
export default async function AgentsPage() { const context = await getTenantContext(); if (!context) redirect("/onboarding"); const supabase = await createClient(); const { data: agents } = await supabase.from("workspace_agents").select("id, slug, name, description, avatar_color").eq("workspace_id", context.workspace.id).order("name"); return <main className="mx-auto max-w-6xl px-6 py-12"><PageHeader title="Agents" description="Configure the instructions and controls for the agents working in this workspace." />{!agents?.length ? <div className="mt-8"><EmptyState icon={<Bot className="h-8 w-8" />} title="No agents installed" description="Your workspace agent setup is still being created." /></div> : <div className="mt-8 grid gap-4 sm:grid-cols-2">{agents.map((agent) => <Link key={agent.id} href={`/app/agents/${agent.slug}`}><Card className="h-full transition-colors hover:border-accent"><CardContent className="pt-5"><div className="flex items-center gap-3"><AgentAvatar name={agent.name} color={agent.avatar_color} size="sm" /><p className="font-semibold text-ink-strong">{agent.name}</p></div><p className="mt-3 text-sm text-muted">{agent.description}</p><span className="mt-3 inline-flex items-center gap-1 text-sm text-accent">Configure <ArrowRight className="h-3.5 w-3.5" /></span></CardContent></Card></Link>)}</div>}</main>; }
