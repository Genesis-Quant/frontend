import { client } from "@/assets/lib/request";
import { terminalStates, type WorkflowActionResponse, type WorkflowInformation, type WorkflowListFilters, type WorkflowListPage, type WorkflowStatusInformation, type WorkflowTasks } from "@/types/workflow";

export const workflowApplicationNames = { query: "Query", factor: "Factor", backtest: "Backtest", incremental: "Incremental" } as const;
export type WorkflowResultPhase = "idle" | "running" | "failure" | "success";

export function resolveWorkflowResultPhase(running: boolean, workflowInstanceId: number | null, state: string): WorkflowResultPhase {
  if (running || workflowInstanceId !== null && !terminalStates.has(state)) return "running";
  if (workflowInstanceId === null) return "idle";
  return state === "SUCCESS" ? "success" : "failure";
}

export function formatDuration(seconds: number | null | undefined, style: "long" | "short" = "short") {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return style === "long" ? `${seconds.toFixed(1)} 秒` : `${seconds.toFixed(1)}s`;
  return style === "long" ? `${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export function resolveDurationSeconds(
  durationSeconds: number | null | undefined,
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined,
  active: boolean,
  now = Date.now()
) {
  if (!startedAt) return durationSeconds;
  if (!active && durationSeconds !== null && durationSeconds !== undefined) return durationSeconds;
  const startedTime = new Date(startedAt).getTime();
  const endedTime = active ? now : finishedAt ? new Date(finishedAt).getTime() : Number.NaN;
  if (!Number.isFinite(startedTime) || !Number.isFinite(endedTime)) return durationSeconds;
  return Math.max(0, (endedTime - startedTime) / 1000);
}

export const workflowsApi = {
  list: (filters: WorkflowListFilters) => client.get<WorkflowListPage>("/workflows", { params: filters }),
  detail: (workflowInstanceId: number) => client.get<WorkflowInformation>(`/workflows/${workflowInstanceId}`),
  status: (workflowInstanceId: number) => client.get<WorkflowStatusInformation>(`/workflows/${workflowInstanceId}/status`),
  tasks: (workflowInstanceId: number) => client.get<WorkflowTasks>(`/workflows/${workflowInstanceId}/tasks`),
  stop: (workflowInstanceId: number) => client.post<WorkflowActionResponse>(`/workflows/${workflowInstanceId}/actions/stop`, null)
};
