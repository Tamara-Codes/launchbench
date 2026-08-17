"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: React.ReactNode }
>(({ className, title, description, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[1px]"
      style={{ animation: "dialog-overlay-in 150ms ease-out" }}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-surface p-5 shadow-lg outline-none",
        className,
      )}
      style={{ animation: "dialog-panel-in 150ms ease-out" }}
      {...props}
    >
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div>
          <DialogPrimitive.Title className="text-sm font-semibold text-ink-strong">{title}</DialogPrimitive.Title>
          {description && <DialogPrimitive.Description className="mt-0.5 text-xs text-muted">{description}</DialogPrimitive.Description>}
        </div>
        <DialogPrimitive.Close className="rounded-md p-1 text-muted transition-colors hover:bg-surface2 hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </div>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";
