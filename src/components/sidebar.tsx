"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Search,
  Users,
  Mail,
  Clock,
  Bot,
  History,
  Settings,
  Images,
  CalendarDays,
  NotebookText,
  PenLine,
  Orbit,
  Package,
  Menu,
  X,
  Check,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { selectProduct } from "@/server/actions";

const SALES_NAV = [
  { href: "/find-leads", label: "Find Leads", icon: Search },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/email-queue", label: "Email Queue", icon: Mail },
  { href: "/follow-ups", label: "Follow-ups", icon: Clock },
  { href: "/search-history", label: "Search History", icon: History },
];

const CONTENT_NAV = [
  { href: "/content-studio", label: "Content Studio", icon: PenLine },
  { href: "/media-library", label: "Media Library", icon: Images },
  { href: "/content-calendar", label: "Content Calendar", icon: CalendarDays },
  { href: "/content-history", label: "Content History", icon: NotebookText },
];

const SHARED_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/products", label: "Products", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];

type Workspace = "sales" | "content";

function workspaceForPath(pathname: string): Workspace {
  return CONTENT_NAV.some((item) => pathname.startsWith(item.href)) ? "content" : "sales";
}

export function Sidebar({
  products,
  selectedProductId,
}: {
  products: Array<{ id: string; name: string; active: boolean }>;
  selectedProductId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>(() => workspaceForPath(pathname));

  useEffect(() => {
    if (CONTENT_NAV.some((item) => pathname.startsWith(item.href))) setWorkspace("content");
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b bg-surface px-4 py-3 md:hidden">
        <div className="flex items-center gap-2 font-mono font-semibold text-accent">
          <Orbit className="h-5 w-5 text-accent" /> LAUNCHBENCH
        </div>
        <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 hover:bg-surface2">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside
        className={cn(
          "sidebar-shell z-30 w-[260px] shrink-0 font-mono md:sticky md:top-0 md:h-screen md:flex md:flex-col",
          open ? "block" : "hidden md:flex",
        )}
      >
        <div className="relative hidden items-center gap-3 px-4 py-4 md:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Orbit className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {products.length > 0 ? <button type="button" onClick={() => setProductMenuOpen((isOpen) => !isOpen)} className="flex h-9 w-full items-center justify-between gap-2 rounded-lg bg-surface2 px-3 text-left text-sm font-semibold text-success transition-colors hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-accent/35"><span className="truncate">{products.find((product) => product.id === selectedProductId)?.name ?? "Choose product"}</span><ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", productMenuOpen && "rotate-180")} /></button> : <p className="text-sm font-semibold text-success">Add a product</p>}
          </div>
          {productMenuOpen && products.length > 0 && (
            <div className="absolute left-4 right-4 top-[calc(100%-6px)] z-50 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-xl">
              {products.filter((product) => product.active).map((product) => {
                const selected = product.id === selectedProductId;
                return <button key={product.id} type="button" onClick={async () => { if (!selected) { const result = await selectProduct(product.id); if (result.ok) router.refresh(); } setProductMenuOpen(false); }} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors", selected ? "bg-accent-soft text-success" : "text-ink hover:bg-surface2")}><span className="min-w-0 flex-1 truncate">{product.name}</span>{selected && <Check className="h-4 w-4 shrink-0" />}</button>;
              })}
              <Link href="/products" onClick={() => setProductMenuOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg border-t border-border px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface2 hover:text-ink"><Package className="h-4 w-4" />Manage products</Link>
            </div>
          )}
        </div>
        <div className="mx-3 grid grid-cols-2 rounded-lg bg-surface2 p-1">
          <button onClick={() => setWorkspace("sales")} className={cn("rounded-md px-2 py-2 text-xs font-semibold", workspace === "sales" ? "bg-surface text-ink-strong shadow-sm" : "text-muted hover:text-ink")}>Sales Agent</button>
          <button onClick={() => setWorkspace("content")} className={cn("rounded-md px-2 py-2 text-xs font-semibold", workspace === "content" ? "bg-surface text-ink-strong shadow-sm" : "text-muted hover:text-ink")}>Content Agent</button>
        </div>
        <nav className="space-y-1 px-3 pb-4 pt-3">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{workspace === "sales" ? "Find and contact customers" : "Plan and create social content"}</p>
          {(workspace === "sales" ? SALES_NAV : CONTENT_NAV).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface2 hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <nav className="mt-3 px-3 pb-4 pt-2">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Shared</p>
          {SHARED_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface2 hover:text-ink")}><Icon className="h-4 w-4" />{item.label}</Link>;
          })}
        </nav>
      </aside>
    </>
  );
}
