import { Link } from "react-router-dom";

import { workflowApplicationNames } from "@/assets/lib/workflows";
import { cn } from "@/assets/lib/utils";
import type { WorkflowApplication } from "@/types/workflow";
import { Badge } from "@/ui/badge";

const applicationClasses: Record<WorkflowApplication, string> = {
  query: "border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  factor: "border-violet-500/35 bg-violet-500/15 text-violet-700 dark:text-violet-300",
  backtest: "border-orange-500/35 bg-orange-500/15 text-orange-700 dark:text-orange-300",
  incremental: "border-teal-500/35 bg-teal-500/15 text-teal-700 dark:text-teal-300"
};

const applicationPaths: Partial<Record<WorkflowApplication, string>> = { query: "/query", factor: "/factor", backtest: "/backtest" };

export default function WorkflowApplicationBadge({ application, className, linkToProject, projectId }: { application: WorkflowApplication; className?: string; linkToProject: boolean; projectId: number | null }) {
  const path = applicationPaths[application];
  const label = `${workflowApplicationNames[application]}${projectId === null ? "" : ` #${projectId}`}`;
  const linked = Boolean(path && projectId !== null && linkToProject);
  const badgeClassName = cn("font-mono uppercase", applicationClasses[application], linked && "cursor-pointer hover:brightness-95 dark:hover:brightness-110", className);
  if (!linked) return <Badge className={badgeClassName} variant="outline">{label}</Badge>;
  return <Badge asChild className={badgeClassName} variant="outline"><Link title={`打开 ${workflowApplicationNames[application]} 项目 #${projectId}`} to={`${path}/projects/${projectId}`}>{label}</Link></Badge>;
}
