"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "./ui";
import { toast } from "./toast";
import { createSocialContentPlan } from "@/server/actions";
import { useRouter } from "next/navigation";

export function ContentPlanGenerator({ products }: { products: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [selected, setSelected] = useState(products.map((product) => product.id));
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, start] = useTransition();

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function generate() {
    start(async () => {
      const result = await createSocialContentPlan({ productIds: selected, startDate, days: 14, cadenceDays: 2 });
      if (!result.ok) return toast(result.error, "error");
      toast(result.data?.warnings.length ? `Created ${result.data.ids.length} plan items with review warnings.` : `Created ${result.data?.ids.length ?? 0} planned posts.`, "success");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1"><p className="font-medium text-ink-strong">Plan the next 14 days</p><p className="mt-0.5 text-sm text-muted">Creates one product-aware idea every two days. Nothing is posted or generated automatically.</p></div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">{products.map((product) => <label key={product.id} className="flex items-center gap-1.5"><input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} />{product.name}</label>)}</div>
        <div className="space-y-1"><Label>Start date</Label><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
        <Button disabled={pending || !selected.length} onClick={generate}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} Generate plan</Button>
      </CardContent>
    </Card>
  );
}
