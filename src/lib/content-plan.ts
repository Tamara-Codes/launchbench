export type PlanProduct = {
  id: string;
  name: string;
  postingPriority: number;
  directSalesFrequency: number;
  pillars: Array<{ name: string; purpose: string; examples: string[] }>;
  exampleIdeas: string[];
  recentHooks: string[];
};

export type PlannedContent = {
  productId: string;
  contentType: string;
  hook: string;
  scheduledFor: Date;
  warnings: string[];
};

function normalized(value: string) { return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }

/** Deterministic starting plan. It weighs products by editable priority, rotates
 * their own pillars, and surfaces warnings rather than silently overriding a choice. */
export function buildContentPlan(products: PlanProduct[], start: Date, days = 14, cadenceDays = 2): PlannedContent[] {
  const active = products.filter((product) => product.postingPriority > 0 && product.pillars.length > 0);
  const count = Math.ceil(days / cadenceDays);
  if (!active.length || count < 1) return [];
  const weighted = active.flatMap((product) => Array.from({ length: Math.max(1, product.postingPriority) }, () => product));
  const result: PlannedContent[] = [];
  let cursor = 0;
  for (let index = 0; index < count; index++) {
    let product = weighted[cursor % weighted.length]!;
    if (result.length && active.length > 1 && result.at(-1)!.productId === product.id) {
      product = weighted.find((candidate) => candidate.id !== product.id) ?? product;
    }
    cursor += Math.max(1, product.postingPriority);
    const pillar = product.pillars[index % product.pillars.length]!;
    const idea = product.exampleIdeas.find((candidate) => !product.recentHooks.some((hook) => normalized(hook) === normalized(candidate)))
      ?? pillar.examples[index % Math.max(1, pillar.examples.length)]
      ?? pillar.purpose;
    const priorSales = result.slice(-2).filter((item) => /direct sales|direct.*sales|prodaja/i.test(item.contentType)).length;
    const warnings: string[] = [];
    if (/direct sales|direct.*sales|prodaja/i.test(pillar.name) && priorSales > 0) warnings.push("Direct-sales content is close together; review the mix before publishing.");
    if (product.recentHooks.some((hook) => normalized(hook) === normalized(idea))) warnings.push("This hook resembles recent content; replace it before approving.");
    const scheduledFor = new Date(start);
    scheduledFor.setDate(start.getDate() + index * cadenceDays);
    scheduledFor.setHours(10, 0, 0, 0);
    result.push({ productId: product.id, contentType: pillar.name, hook: idea, scheduledFor, warnings });
  }
  return result;
}
