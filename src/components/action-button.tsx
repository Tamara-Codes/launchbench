"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "./ui";
import { toast } from "./toast";
import { cn } from "@/lib/utils";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

interface ActionButtonProps<T> extends Omit<ButtonProps, "onClick"> {
  action: () => Promise<ActionResult<T>>;
  onSuccess?: (data: T | undefined) => void;
  successMessage?: string | ((data: T | undefined) => string);
  confirm?: string;
  refresh?: boolean;
}

export function ActionButton<T = unknown>({
  action,
  onSuccess,
  successMessage,
  confirm,
  refresh = true,
  children,
  disabled,
  ...props
}: ActionButtonProps<T>) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    try {
      const res = await action();
      if (res.ok) {
        if (successMessage) {
          const msg = typeof successMessage === "function" ? successMessage(res.data) : successMessage;
          toast(msg, "success");
        }
        onSuccess?.(res.data);
        if (refresh) start(() => router.refresh());
      } else {
        toast(res.error, "error");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unexpected error", "error");
    } finally {
      setBusy(false);
    }
  }

  const loading = busy || pending;
  return (
    <Button onClick={run} disabled={disabled || loading} {...props} className={cn(props.className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
