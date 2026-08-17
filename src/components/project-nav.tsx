import Link from "next/link";

export type ProjectNavTab = "basics" | "sales" | "content" | "tasks" | "templates";

/** Shared nav for every `/app/projects/[id]*` subpage — kept in one place so
 * adding or renaming a tab can't drift out of sync between them again. */
export function ProjectNav({
  projectId,
  active,
  salesAgentName,
  contentAgentName,
}: {
  projectId: string;
  active: ProjectNavTab;
  salesAgentName: string;
  contentAgentName: string;
}) {
  const tabClass = (tab: ProjectNavTab) => `py-2 text-sm font-medium ${active === tab ? "text-accent" : "text-muted hover:text-ink"}`;
  const underline = (tab: ProjectNavTab) => (active === tab ? "border-b-2 border-accent pb-2" : "");
  return (
    <nav className="mt-6 flex flex-wrap gap-5" aria-label="Project settings">
      <Link href={`/app/projects/${projectId}`} className={tabClass("basics")}>
        <span className={underline("basics")}>Project basics</span>
      </Link>
      <Link href={`/app/projects/${projectId}?tab=sally`} className={tabClass("sales")}>
        <span className={underline("sales")}>{salesAgentName} context</span>
      </Link>
      <Link href={`/app/projects/${projectId}?tab=contessa`} className={tabClass("content")}>
        <span className={underline("content")}>{contentAgentName} context</span>
      </Link>
      <Link href={`/app/projects/${projectId}/tasks`} className={tabClass("tasks")}>
        <span className={underline("tasks")}>Tasks</span>
      </Link>
      <Link href={`/app/projects/${projectId}/templates`} className={tabClass("templates")}>
        <span className={underline("templates")}>Email templates</span>
      </Link>
    </nav>
  );
}
