import Link from "next/link";

export function BrandLogo({ href = "/app", compact = false }: { href?: string; compact?: boolean }) {
  return <Link href={href} className="inline-flex items-center" aria-label="Launchbench"><img src="/images/launchbench-logo.png" alt="Launchbench" className={compact ? "h-16 w-32 object-cover object-center" : "h-auto w-full max-w-[460px] object-contain"} /></Link>;
}
