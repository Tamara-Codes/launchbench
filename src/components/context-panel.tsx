import type { Search } from "lucide-react";
import { Label, Textarea } from "./ui";

/** Shared card used to group related agent-context fields — the "Lead
 * discovery" / "Email direction" / "Voice and message" style sections on the
 * project and templates pages. */
export function ContextPanel({
  icon: Icon,
  title,
  description,
  tone,
  children,
}: {
  icon: typeof Search;
  title: string;
  description?: string;
  tone: "sales" | "content";
  children: React.ReactNode;
}) {
  const iconClasses =
    tone === "sales"
      ? "bg-emerald-500/10 text-emerald-400"
      : "bg-rose-500/10 text-rose-400";
  return (
    <div className="rounded-lg border bg-surface2/35 p-4">
      <div className="flex items-start gap-2.5">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconClasses}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-ink-strong">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>}
        </div>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

export function Area({
  label,
  labelClassName,
  value,
  onChange,
  rows,
  hint,
  required,
  placeholder,
}: {
  label: string;
  labelClassName?: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={labelClassName}>{label}</Label>
      {hint && <p className="text-xs leading-5 text-muted">{hint}</p>}
      <Textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}
