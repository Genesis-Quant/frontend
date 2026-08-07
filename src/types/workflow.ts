export type WorkflowApplication = "query" | "factor" | "backtest" | "incremental";

export type WorkflowTaskInformation = {
  task_code: number | null;
  task_instance_id: number | null;
  name: string;
  task_type: string | null;
  state: string;
  host: string | null;
  retry_times: number | null;
  max_retry_times: number | null;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
};

export type WorkflowInformation = {
  application: WorkflowApplication;
  record_id: number;
  user_id: number;
  workflow_instance_id: number;
  project_code: number;
  workflow_definition_code: number;
  workflow_name: string;
  state: string;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  task_count: number;
  payload: {
    start_parameters: Record<string, string>;
    input_json?: Record<string, unknown>;
  };
  requested_outputs: string[];
  state_history: Record<string, unknown>[];
  events: Record<string, unknown>[];
};

export type WorkflowStatusInformation = Pick<WorkflowInformation,
  "workflow_instance_id" | "state" | "error" | "started_at" | "finished_at" | "duration_seconds" | "last_synced_at"
>;

export type WorkflowTasks = {
  workflow_instance_id: number;
  state: string;
  error: string | null;
  tasks: WorkflowTaskInformation[];
};

export type WorkflowActionResponse = {
  action: "stop" | "pause" | "resume" | "rerun" | "retry-failed";
  scheduler_submission: unknown;
  synchronization_error: string | null;
  workflow: WorkflowStatusInformation;
};

export type WorkflowListItem = {
  application: WorkflowApplication;
  record_id: number;
  user_id: number;
  workflow_instance_id: number;
  workflow_definition_code: number;
  workflow_name: string;
  state: string;
  tasks: WorkflowTaskInformation[];
  tasks_error: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  project_id: number | null;
  owner_username: string;
};

export type WorkflowListPage = {
  items: WorkflowListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type WorkflowListFilters = {
  page: number;
  page_size: number;
  application?: WorkflowApplication;
  state?: "active" | "success" | "failure";
};

export const terminalStates = new Set(["SUCCESS", "FAILURE", "STOP", "KILL", "FORCED_SUCCESS", "SUBMIT_FAILED"]);
