"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "./ui";
import { BarChart3 } from "lucide-react";

const ACCENT = "hsl(243 75% 62%)";

export function LeadsByDayChart({ data }: { data: { date: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-8 w-8" />}
        title="No leads found yet"
        description="Run a lead search to start populating this chart."
      />
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => d.slice(5)}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--ink)",
          }}
          labelFormatter={(l) => `Date: ${l}`}
        />
        <Bar dataKey="count" name="Qualified leads" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={34} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDistributionChart({ data }: { data: { status: string; count: number }[] }) {
  const rows = data.filter((d) => d.count > 0);
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-8 w-8" />}
        title="No lead data"
        description="Lead status distribution will appear here once you have leads."
      />
    );
  }
  const palette = [
    "hsl(243 75% 62%)",
    "hsl(212 85% 55%)",
    "hsl(142 60% 45%)",
    "hsl(35 90% 55%)",
    "hsl(0 72% 60%)",
    "hsl(280 65% 60%)",
  ];
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <XAxis type="number" allowDecimals={false} hide />
        <YAxis
          type="category"
          dataKey="status"
          width={110}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--surface2)" }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--ink)",
          }}
        />
        <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {rows.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
