import Link from "next/link";
import { RocketDeskIcon } from "@/components/rocket-desk-icon";

export function BrandLogo({ href = "/app", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="LaunchBench">
      <RocketDeskIcon className={compact ? "h-8 w-auto" : "h-11 w-auto"} />
      <span className={`font-semibold tracking-tight text-ink-strong ${compact ? "text-lg" : "text-2xl"}`}>
        Launch<span className="text-accent">Bench</span>
      </span>
    </Link>
  );
}
