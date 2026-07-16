import "server-only";
import type { AgentDefinition } from "./types";
import { leadFinderAgent } from "./lead-finder";
import { socialContentAgent } from "./social-content";

/**
 * In-code registry of agent IMPLEMENTATIONS keyed by slug. The database holds
 * the editable configuration (prompts/model/etc.); this maps a configured
 * agent row to the code that runs it. Add future agents here.
 */
const registry = new Map<string, AgentDefinition<any, any>>();

function register(agent: AgentDefinition<any, any>) {
  registry.set(agent.slug, agent);
}

register(leadFinderAgent);
register(socialContentAgent);

export function getAgentImplementation(
  slug: string,
): AgentDefinition<any, any> | undefined {
  return registry.get(slug);
}

export function listAgentSlugs(): string[] {
  return Array.from(registry.keys());
}
