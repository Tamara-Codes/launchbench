"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BriefcaseBusiness, CalendarDays, Check, ChevronDown, Images, MapPin, Package, PenLine, Settings, Sparkles, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { AgentAvatar } from "@/components/agent-avatar";
import { setCurrentProject } from "@/server/current-project-actions";

type Product = { id: string; name: string; active: boolean };
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
    { href: "/app/content-calendar", label: "Content Calendar", icon: Workflow },
    { href: "/app/content-history", label: "Content History", icon: Workflow },
  ],
};
const sharedNavigation = [
  { href: "/app", label: "Today", icon: CalendarDays },
  { href: "/app/agents", label: "Agents", icon: Workflow },
  { href: "/app/products", label: "Products", icon: Package },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

function agentForPath(pathname: string): Agent { return pathname.startsWith("/app/content") ? "content" : "sales"; }

export function TenantSidebar({ workspaceName, products, currentProjectId, salesAgent, contentAgent }: { workspaceName: string; products: Product[]; currentProjectId: string | null; salesAgent: { name: string; avatar_color: string }; contentAgent: { name: string; avatar_color: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const agent = agentForPath(pathname);
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const selectedProduct = products.find((product) => product.id === currentProjectId);

  function selectProject(productId: string) {
    setProductMenuOpen(false);
    if (productId === currentProjectId) return;
    startTransition(async () => {
      await setCurrentProject(productId);
      router.refresh();
    });
  }

  return (
    <>
      <header className="flex items-center justify-between border-b bg-surface px-4 py-3 md:hidden">
        <BrandLogo href="/app/sales" compact />
        <SignOutButton />
      </header>
      <aside className="sidebar-shell hidden w-[260px] shrink-0 font-mono md:sticky md:top-0 md:flex md:h-[100dvh] md:flex-col">
        <div className="border-b border-border px-4 py-5">
          <BrandLogo href="/app/sales" compact />
          <div className="relative mt-5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Current project</p>
            {products.length ? <button type="button" onClick={() => setProductMenuOpen((open) => !open)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface2 px-3 py-2.5 text-left text-sm font-semibold text-ink-strong hover:bg-accent-soft"><span className="truncate">{selectedProduct?.name ?? "Choose project"}</span><ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", productMenuOpen && "rotate-180")} /></button> : <Link href="/app/products/new" className="block rounded-lg border border-dashed border-border px-3 py-2.5 text-sm font-medium text-accent">Add your first project</Link>}
            {productMenuOpen && <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-xl">{products.filter((product) => product.active).map((product) => { const selected = product.id === currentProjectId; return <button key={product.id} type="button" disabled={pending} onClick={() => selectProject(product.id)} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium disabled:opacity-60", selected ? "bg-accent-soft text-accent" : "text-ink hover:bg-surface2")}><span className="min-w-0 flex-1 truncate">{product.name}</span>{selected && <Check className="h-4 w-4" />}</button>; })}<Link href="/app/products" onClick={() => setProductMenuOpen(false)} className="mt-1 flex items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-muted hover:text-ink"><Package className="h-4 w-4" />Manage projects</Link></div>}
          </div>
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
