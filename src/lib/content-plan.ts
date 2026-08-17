export type PlanProject = {
  id: string;
  name: string;
  postingPriority: number;
  directSalesFrequency: number;
  pillars: Array<{ name: string; purpose: string; examples: string[] }>;
  exampleIdeas: string[];
  recentHooks: string[];
};

export type PlannedContent = {
  projectId: string;
  contentType: string;
  hook: string;
  scheduledFor: Date;
  warnings: string[];
};

function normalized(value: string) { return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }

/** Deterministic starting plan. It weighs projects by editable priority, rotates
 * their own pillars, and surfaces warnings rather than silently overriding a choice. */
export function buildContentPlan(projects: PlanProject[], start: Date, days = 14, cadenceDays = 2): PlannedContent[] {
  const active = projects.filter((project) => project.postingPriority > 0 && project.pillars.length > 0);
  const count = Math.ceil(days / cadenceDays);
  if (!active.length || count < 1) return [];
  const weighted = active.flatMap((project) => Array.from({ length: Math.max(1, project.postingPriority) }, () => project));
  const result: PlannedContent[] = [];
  let cursor = 0;
  for (let index = 0; index < count; index++) {
    let project = weighted[cursor % weighted.length]!;
    if (result.length && active.length > 1 && result.at(-1)!.projectId === project.id) {
      project = weighted.find((candidate) => candidate.id !== project.id) ?? project;
    }
    cursor += Math.max(1, project.postingPriority);
    const pillar = project.pillars[index % project.pillars.length]!;
    const idea = project.exampleIdeas.find((candidate) => !project.recentHooks.some((hook) => normalized(hook) === normalized(candidate)))
      ?? pillar.examples[index % Math.max(1, pillar.examples.length)]
      ?? pillar.purpose;
    const priorSales = result.slice(-2).filter((item) => /direct sales|direct.*sales|prodaja/i.test(item.contentType)).length;
    const warnings: string[] = [];
    if (/direct sales|direct.*sales|prodaja/i.test(pillar.name) && priorSales > 0) warnings.push("Direct-sales content is close together; review the mix before publishing.");
    if (project.recentHooks.some((hook) => normalized(hook) === normalized(idea))) warnings.push("This hook resembles recent content; replace it before approving.");
    const scheduledFor = new Date(start);
    scheduledFor.setDate(start.getDate() + index * cadenceDays);
    scheduledFor.setHours(10, 0, 0, 0);
    result.push({ projectId: project.id, contentType: pillar.name, hook: idea, scheduledFor, warnings });
  }
  return result;
}
