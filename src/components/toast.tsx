"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

export function toast(message: string, kind: ToastKind = "info") {
  const item = { id: ++counter, kind, message };
  listeners.forEach((l) => l(item));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const add = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== t.id)), 5000);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => {
        const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertCircle : Info;
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface p-3 shadow-lg",
              t.kind === "success" && "border-success/40",
              t.kind === "error" && "border-danger/40",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                t.kind === "success" && "text-success",
                t.kind === "error" && "text-danger",
                t.kind === "info" && "text-info",
              )}
            />
            <p className="flex-1 text-sm text-ink">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
