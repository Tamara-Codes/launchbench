const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type TemplateVars = Record<string, string | number | null | undefined>;

export interface RenderResult {
  text: string;
  unresolved: string[];
}

/**
 * Render a `{{variable}}` template. A variable is "unresolved" when it is not
 * present in `vars` OR its value is empty/nullish. Unresolved placeholders are
 * left visible in the output (as `{{name}}`) so the UI can flag them, and are
 * returned in `unresolved`.
 */
export function renderTemplate(template: string, vars: TemplateVars): RenderResult {
  const unresolved = new Set<string>();
  const text = template.replace(VAR_RE, (_m, name: string) => {
    const raw = vars[name];
    const value = raw == null ? "" : String(raw).trim();
    if (!value) {
      unresolved.add(name);
      return `{{${name}}}`;
    }
    return value;
  });
  return { text, unresolved: Array.from(unresolved) };
}

/** List all distinct variable names referenced by a template. */
export function listTemplateVariables(template: string): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_RE.source, "g");
  while ((m = re.exec(template)) !== null) {
    if (m[1]) names.add(m[1]);
  }
  return Array.from(names);
}

/** True when the text still contains any `{{...}}` placeholder (blocks send). */
export function hasUnresolvedVariables(text: string): boolean {
  return new RegExp(VAR_RE.source).test(text);
}
