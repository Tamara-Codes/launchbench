"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BriefcaseBusiness, Images, ListTodo, MapPin, Package, PenLine, Settings, Sparkles, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { AgentAvatar } from "@/components/agent-avatar";

type Agent = "sales" | "content";

const agentNavigation = {
  sales: [
    { href: "/app/sales", label: "Find Leads", icon: BriefcaseBusiness },
    { href: "/app/territories", label: "Territories", icon: MapPin },
    { href: "/app/leads", label: "Leads", icon: BriefcaseBusiness },
    { href: "/app/search-history", label: "Search History", icon: Workflow },
  ],
  content: [
    { href: "/app/content", label: "Content Studio", icon: PenLine },
    { href: "/app/media", label: "Media Library", icon: Images },
    { href: "/app/content-history", label: "Content History", icon: Workflow },
  ],
};
const sharedNavigation = [
  { href: "/app", label: "ToDo", icon: ListTodo },
  { href: "/app/agents", label: "Agents", icon: Workflow },
  { href: "/app/projects", label: "Projects", icon: Package },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

function agentForPath(pathname: string): Agent { return pathname.startsWith("/app/content") ? "content" : "sales"; }

export function TenantSidebar({ workspaceName, salesAgent, contentAgent }: { workspaceName: string; salesAgent: { name: string; avatar_color: string }; contentAgent: { name: string; avatar_color: string } }) {
  const pathname = usePathname();
  const agent = agentForPath(pathname);

  return (
    <>
      <header className="flex items-center justify-between border-b bg-surface px-4 py-3 md:hidden">
        <BrandLogo href="/app/sales" compact />
        <SignOutButton />
      </header>
      <aside className="sidebar-shell hidden w-[260px] shrink-0 font-mono md:sticky md:top-0 md:flex md:h-[100dvh] md:flex-col">
        <div className="border-b border-border px-4 py-5">
          <BrandLogo href="/app/sales" compact />
        </div>
        <div className="mx-3 mt-4 grid grid-cols-2 gap-1 rounded-lg bg-surface2 p-1">
          <Link href="/app/sales" className={cn("flex min-w-0 items-center justify-center gap-2 rounded-md px-2 py-1.5 text-center text-xs font-semibold", agent === "sales" ? "bg-surface text-ink-strong shadow-sm" : "text-muted hover:text-ink")}><AgentAvatar name={salesAgent.name} color={salesAgent.avatar_color} size="xs" /><span className="truncate">{salesAgent.name}</span></Link>
          <Link href="/app/content" className={cn("flex min-w-0 items-center justify-center gap-2 rounded-md px-2 py-1.5 text-center text-xs font-semibold", agent === "content" ? "bg-surface text-ink-strong shadow-sm" : "text-muted hover:text-ink")}><AgentAvatar name={contentAgent.name} color={contentAgent.avatar_color} size="xs" /><span className="truncate">{contentAgent.name}</span></Link>
        </div>
        <nav className="space-y-1 px-3 pb-4 pt-4" aria-label="Agent navigation"><p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{agent === "sales" ? "Find and contact customers" : "Plan and create content"}</p>{agentNavigation[agent].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium", pathname.startsWith(href) ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface2 hover:text-ink")}><Icon className="h-4 w-4" />{label}</Link>)}</nav>
        <nav className="mt-2 border-t border-border px-3 pb-4 pt-4" aria-label="Shared navigation"><p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Shared</p>{sharedNavigation.map(({ href, label, icon: Icon }) => { const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href); return <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium", active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface2 hover:text-ink")}><Icon className="h-4 w-4" />{label}</Link>; })}</nav>
        <div className="mt-auto border-t border-border p-4"><p className="mb-3 flex items-center gap-2 text-xs text-muted"><Sparkles className="h-3.5 w-3.5 text-accent" />{workspaceName}</p><SignOutButton /></div>
      </aside>
    </>
  );
}
