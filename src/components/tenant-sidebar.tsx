"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Images, Orbit, Package, PenLine, Settings, Sparkles, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";

const navigation = [
  { href: "/app/sales", label: "Sales Agent", icon: BriefcaseBusiness },
  { href: "/app/content", label: "Content Studio", icon: PenLine },
  { href: "/app/products", label: "Products", icon: Package },
  { href: "/app/media", label: "Media Library", icon: Images },
  { href: "/app/jobs", label: "Agent Jobs", icon: Workflow },
  { href: "/app/settings", label: "Workspace Settings", icon: Settings },
];

export function TenantSidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();

  return (
    <>
      <header className="flex items-center justify-between border-b bg-surface px-4 py-3 md:hidden">
        <Link href="/app/sales" className="flex items-center gap-2 font-mono text-sm font-semibold tracking-[0.08em] text-ink-strong">
          <Orbit className="h-5 w-5 text-accent" />
          LAUNCHBENCH
        </Link>
        <SignOutButton />
      </header>
      <aside className="sidebar-shell hidden w-[260px] shrink-0 font-mono md:sticky md:top-0 md:flex md:h-[100dvh] md:flex-col">
        <div className="border-b border-border px-4 py-5">
          <Link href="/app/sales" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <Orbit className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold tracking-[0.08em] text-ink-strong">LAUNCHBENCH</span>
          </Link>
          <div className="mt-5 rounded-lg border border-border bg-surface2 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Workspace</p>
            <p className="mt-1 truncate text-sm font-semibold text-ink-strong">{workspaceName}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Workspace navigation">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Workspace</p>
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface2 hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-muted">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Founder ops for distribution
          </div>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}

