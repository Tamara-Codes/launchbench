"use client";

import Lottie from "lottie-react";
import { cn } from "@/lib/utils";
import animationData from "./agent-blob.json";
import eyeAnimationData from "./agent-eye.json";

export const agentAvatarColors = ["emerald", "blue", "violet", "rose", "amber", "cyan"] as const;
export type AgentAvatarColor = (typeof agentAvatarColors)[number];

const avatarColorFilters: Record<AgentAvatarColor, string> = {
  emerald: "hue-rotate(0deg)",
  blue: "hue-rotate(72deg)",
  violet: "hue-rotate(142deg)",
  rose: "hue-rotate(258deg)",
  amber: "hue-rotate(312deg)",
  cyan: "hue-rotate(28deg)",
};

export const agentAvatarSwatchClasses: Record<AgentAvatarColor, string> = {
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  cyan: "bg-cyan-500",
};

export function AgentAvatar({ name, color, size = "md", className }: { name: string; color: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const resolvedColor = agentAvatarColors.includes(color as AgentAvatarColor) ? color as AgentAvatarColor : "emerald";
  const sizeClasses = size === "sm" ? "h-10 w-10" : size === "lg" ? "h-24 w-24" : "h-14 w-14";

  return <div role="img" aria-label={`${name} avatar`} className={cn("relative shrink-0 overflow-hidden rounded-full bg-surface2 ring-1 ring-border", sizeClasses, className)}><Lottie animationData={animationData} loop autoplay rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }} style={{ filter: avatarColorFilters[resolvedColor] }} /><div className="absolute left-[30%] top-[42%] h-[17%] w-[13%]"><Lottie animationData={eyeAnimationData} loop autoplay rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }} /></div><div className="absolute right-[30%] top-[42%] h-[17%] w-[13%]"><Lottie animationData={eyeAnimationData} loop autoplay rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }} /></div></div>;
}
