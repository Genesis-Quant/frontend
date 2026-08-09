export type ProjectQueueItem<T> = {
  id: string;
  remark: string;
  parameters: T;
  workspace_id: number | null;
  workflow_instance_id: number | null;
  version: number | null;
  state: string;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type BatchRunRequest<T> = {
  items: Array<{
    client_id: string;
    remark: string;
    parameters: T;
  }>;
};

export type BatchRunAccepted = {
  client_id: string;
  workspace_id: number;
};
