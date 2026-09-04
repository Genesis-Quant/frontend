import { workflowsApi } from "@/assets/lib/workflows";
import type { BatchRunAccepted, BatchRunRequest, ProjectQueueItem } from "@/types/queue";
import { terminalStates } from "@/types/workflow";

type QueueApplication = "factor" | "backtest";
const queueSchemaVersion = 1;
export const maxBatchRunItems = 100;

export type ProjectQueueLoadResult<T> = {
  error: string | null;
  items: ProjectQueueItem<T>[];
};

export function loadProjectQueue<T>(userId: number, application: QueueApplication, projectId: number, validateParameters: (value: unknown) => value is T): ProjectQueueLoadResult<T> {
  const key = queueStorageKey(userId, application, projectId);
  const source = localStorage.getItem(key);
  if (source === null) return { error: null, items: [] };
  try {
    const stored: unknown = JSON.parse(source);
    const values = isRecord(stored) && stored.schema_version === queueSchemaVersion
      ? stored.items
      : null;
    if (!Array.isArray(values) || !values.every((value) => isProjectQueueItem(value, validateParameters))) throw new Error("队列结构或参数版本不兼容");
    return { error: null, items: values };
  } catch (reason) {
    console.error(`无法读取本地执行队列 ${key}`, reason);
    return {
      error: "本地执行队列结构无效，原始数据已保留；添加新任务后才会替换该队列。",
      items: []
    };
  }
}

export function saveProjectQueue<T>(userId: number, application: QueueApplication, projectId: number, items: ProjectQueueItem<T>[]) {
  localStorage.setItem(queueStorageKey(userId, application, projectId), JSON.stringify({ schema_version: queueSchemaVersion, items }));
}

export function createProjectQueueItem<T>(remark: string, parameters: T): ProjectQueueItem<T> {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    remark: remark.trim(),
    parameters: structuredClone(parameters),
    workspace_id: null,
    workflow_instance_id: null,
    version: null,
    state: "PENDING",
    error: null,
    created_at: timestamp,
    updated_at: timestamp
  };
}

export function autoSavedVersion(events: Record<string, unknown>[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.event === "AUTO_VERSION_SAVED" && typeof event.version === "number") return event.version;
  }
  return null;
}

export function queueNeedsPolling<T>(items: ProjectQueueItem<T>[]) {
  return items.some((item) => item.workspace_id !== null && item.version === null && !item.error && (!terminalStates.has(item.state) || item.state === "SUCCESS"));
}

export function pendingBatchRequest<T>(items: ProjectQueueItem<T>[]): BatchRunRequest<T> {
  const pending = items.filter((item) => item.workspace_id === null);
  if (pending.length > maxBatchRunItems) throw new Error(`一次最多执行 ${maxBatchRunItems} 个队列任务，请先删除多余任务。`);
  return {
    items: pending.map((item) => ({ client_id: item.id, remark: item.remark, parameters: item.parameters }))
  };
}

export function applyAcceptedBatch<T>(items: ProjectQueueItem<T>[], accepted: BatchRunAccepted[]) {
  const workspaces = new Map(accepted.map((item) => [item.client_id, item.workspace_id]));
  const timestamp = new Date().toISOString();
  return items.map((item) => {
    const workspaceId = workspaces.get(item.id);
    return workspaceId === undefined ? item : { ...item, workspace_id: workspaceId, state: "SUBMITTED", error: null, updated_at: timestamp };
  });
}

export async function refreshProjectQueue<T>(items: ProjectQueueItem<T>[]) {
  const polling = items.filter((item) => item.workspace_id !== null && item.version === null && !item.error && (!terminalStates.has(item.state) || item.state === "SUCCESS"));
  const settled = await Promise.allSettled(polling.map((item) => workflowsApi.workspaceStatus(item.workspace_id!)));
  const errors = settled.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
  const updatedItems = polling.flatMap((item, index) => {
    const result = settled[index];
    if (result.status === "rejected") return [];
    const status = result.value;
    return [{ ...item, workflow_instance_id: status.workflow_instance_id, version: autoSavedVersion(status.events), state: status.state, error: status.error, updated_at: status.updated_at }];
  });
  return { items: updatedItems, errors };
}

function queueStorageKey(userId: number, application: QueueApplication, projectId: number) {
  return `arena:execution-queue:${userId}:${application}:${projectId}`;
}

function isProjectQueueItem<T>(value: unknown, validateParameters: (value: unknown) => value is T): value is ProjectQueueItem<T> {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0
    && typeof value.remark === "string"
    && validateParameters(value.parameters)
    && nullablePositiveInteger(value.workspace_id)
    && nullablePositiveInteger(value.workflow_instance_id)
    && nullablePositiveInteger(value.version)
    && typeof value.state === "string"
    && (value.error === null || typeof value.error === "string")
    && typeof value.created_at === "string"
    && typeof value.updated_at === "string";
}

function nullablePositiveInteger(value: unknown) {
  return value === null || typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
