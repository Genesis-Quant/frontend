import { useEffect, useRef, useState } from "react";

import {
  applyAcceptedBatch,
  createProjectQueueItem,
  loadProjectQueue,
  maxBatchRunItems,
  pendingBatchRequest,
  queueNeedsPolling,
  refreshProjectQueue,
  saveProjectQueue,
  type QueueApplication
} from "@/assets/lib/projectQueue";
import { errorMessage } from "@/assets/lib/utils";
import type { BatchRunAccepted, BatchRunRequest, ProjectQueueItem } from "@/types/queue";

type ProjectQueueState<T> = {
  error: string | null;
  identity: string;
  items: ProjectQueueItem<T>[];
  writable: boolean;
};

type UseProjectQueueOptions<T> = {
  application: QueueApplication;
  executeBatch: (request: BatchRunRequest<T>) => Promise<BatchRunAccepted[]>;
  normalizeParameters: (parameters: T) => T;
  onError: (message: string) => void;
  pollingErrorMessage: string;
  projectId: number;
  userId: number;
  validateParameters: (value: unknown) => value is T;
};

export function useProjectQueue<T>({
  application,
  executeBatch,
  normalizeParameters,
  onError,
  pollingErrorMessage,
  projectId,
  userId,
  validateParameters
}: UseProjectQueueOptions<T>) {
  const identity = `${userId}:${application}:${projectId}`;
  const [queue, setQueue] = useState<ProjectQueueState<T>>(() => initialQueueState(identity, userId, application, projectId, validateParameters));
  const [executing, setExecuting] = useState(false);
  const items = queue.identity === identity ? queue.items : [];
  const loadError = queue.identity === identity ? queue.error : null;
  const itemsRef = useRef(items);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  itemsRef.current = items;

  useEffect(() => {
    if (queue.identity === identity) return;
    setExecuting(false);
    setQueue(initialQueueState(identity, userId, application, projectId, validateParameters));
  }, [application, identity, projectId, queue.identity, userId, validateParameters]);

  useEffect(() => {
    if (queue.identity !== identity || !queue.writable) return;
    saveProjectQueue(userId, application, projectId, queue.items);
  }, [application, identity, projectId, queue, userId]);

  const polling = queueNeedsPolling(items);
  useEffect(() => {
    if (!polling) return undefined;
    let disposed = false;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const result = await refreshProjectQueue(itemsRef.current);
        if (disposed) return;
        const byId = new Map(result.items.map((item) => [item.id, item]));
        setQueue((current) => current.identity === identity
          ? { ...current, items: current.items.map((item) => byId.get(item.id) ?? item) }
          : current);
        if (result.errors.length) console.warn(pollingErrorMessage, result.errors);
      } catch (reason) {
        if (!disposed) onErrorRef.current(errorMessage(reason));
      } finally {
        refreshing = false;
      }
    };
    const timer = window.setInterval(refresh, 2500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [identity, polling, pollingErrorMessage]);

  function add(remark: string, parameters: T) {
    if (executing) return false;
    if (items.filter((item) => item.workspace_id === null).length >= maxBatchRunItems) {
      onErrorRef.current(`执行队列最多保留 ${maxBatchRunItems} 个待执行任务。`);
      return false;
    }
    let normalized: T;
    try {
      normalized = normalizeParameters(parameters);
    } catch (reason) {
      onErrorRef.current(errorMessage(reason));
      return false;
    }
    setQueue((current) => current.identity === identity
      ? {
        ...current,
        error: null,
        items: [...current.items, createProjectQueueItem(remark, normalized)],
        writable: true
      }
      : current);
    return true;
  }

  function update(item: ProjectQueueItem<T>, remark: string, parameters: T) {
    if (executing) return;
    const normalized = normalizeParameters(parameters);
    const updatedAt = new Date().toISOString();
    setQueue((current) => current.identity === identity
      ? {
        ...current,
        items: current.items.map((candidate) => candidate.id === item.id
          ? { ...candidate, remark: remark.trim(), parameters: normalized, updated_at: updatedAt }
          : candidate)
      }
      : current);
  }

  function remove(item: ProjectQueueItem<T>) {
    if (executing) return;
    setQueue((current) => current.identity === identity
      ? { ...current, items: current.items.filter((candidate) => candidate.id !== item.id) }
      : current);
  }

  async function execute() {
    if (executing) return;
    setExecuting(true);
    onErrorRef.current("");
    try {
      const request = pendingBatchRequest(items);
      if (!request.items.length) return;
      const accepted = await executeBatch(request);
      setQueue((current) => current.identity === identity
        ? { ...current, items: applyAcceptedBatch(current.items, accepted) }
        : current);
    } catch (reason) {
      onErrorRef.current(errorMessage(reason));
    } finally {
      setExecuting(false);
    }
  }

  return {
    add,
    completedVersionsKey: items
      .filter((item) => item.version !== null)
      .map((item) => `${item.id}:${item.version}`)
      .sort()
      .join("|"),
    execute,
    executing,
    items,
    loadError,
    remove,
    update
  };
}

function initialQueueState<T>(
  identity: string,
  userId: number,
  application: QueueApplication,
  projectId: number,
  validateParameters: (value: unknown) => value is T
): ProjectQueueState<T> {
  const loaded = loadProjectQueue(userId, application, projectId, validateParameters);
  return {
    error: loaded.error,
    identity,
    items: loaded.items,
    writable: loaded.error === null
  };
}
