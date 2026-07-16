"use client";
import { RefreshCw, Clock } from "lucide-react";
import { ActionButton } from "./action-button";
import { checkGmailReplies, prepareFollowUps } from "@/server/actions";

export function CheckGmailButton({ variant = "outline" }: { variant?: "outline" | "secondary" }) {
  return (
    <ActionButton
      variant={variant}
      action={checkGmailReplies}
      successMessage={(d: any) =>
        `Gmail checked — ${d?.repliesFound ?? 0} replies, ${d?.optOuts ?? 0} opt-outs.`
      }
    >
      <RefreshCw className="h-4 w-4" /> Check Gmail
    </ActionButton>
  );
}

export function PrepareFollowUpsButton({ variant = "outline" }: { variant?: "outline" | "secondary" }) {
  return (
    <ActionButton
      variant={variant}
      action={prepareFollowUps}
      successMessage={(d: any) => `${d?.due ?? 0} follow-up(s) marked due.`}
    >
      <Clock className="h-4 w-4" /> Prepare Follow-ups
    </ActionButton>
  );
}
