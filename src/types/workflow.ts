export type WorkflowApplication = "query" | "factor" | "backtest" | "optimization" | "sensitivity" | "incremental";

export type WorkflowTaskInformation = {
  task_instance_id: number | null;
  name: string;
  state: string;
  host: string | null;
  duration_seconds: number | null;
};

export type WorkflowTaskSummary = {
  task_code: number | null;
  task_instance_id: number | null;
  name: string;
  state: string;
};

export type WorkflowAttemptSummary = {
  attempt_id: number;
  attempt_number: number;
  is_current: boolean;
  workflow_instance_id: number | null;
  workflow_definition_code: number | null;
  state: string;
  tasks: WorkflowTaskSummary[];
  tasks_error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
};

export type WorkflowAttemptListPage = {
  items: WorkflowAttemptSummary[];
  total: number;
  page: number;
  page_size: number;
};

export type WorkflowAttemptInformation = {
  application: WorkflowApplication;
  workspace_id: number;
  project_title: string | null;
  attempt_id: number;
  attempt_number: number;
  workflow_instance_id: number | null;
  project_code: number | null;
  workflow_definition_code: number | null;
  workflow_name: string | null;
  state: string;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  last_synced_at: string | null;
  attempt_created_at: string;
  attempt_updated_at: string;
  task_count: number;
  payload: {
    start_parameters: Record<string, string>;
    input_json: Record<string, unknown>;
  };
  requested_outputs: string[];
  state_history: Record<string, unknown>[];
  events: Record<string, unknown>[];
};

export type WorkflowStatusInformation = {
  state: string;
  error: string | null;
};

export type WorkflowWorkspaceStatus = {
  workflow_instance_id: number | null;
  state: string;
  error: string | null;
  events: Record<string, unknown>[];
  updated_at: string;
};

export type WorkflowTasks = {
  state: string;
  error: string | null;
  tasks: WorkflowTaskInformation[];
};

export type WorkflowActionResponse = {
  workflow: WorkflowStatusInformation;
};

export type WorkflowWorkspaceListItem = {
  application: WorkflowApplication;
  workspace_id: number;
  user_id: number;
  project_id: number | null;
  project_title: string | null;
  owner_username: string;
  attempt_count: number;
  current_attempt: WorkflowAttemptSummary;
};

export type WorkflowWorkspaceListPage = {
  items: WorkflowWorkspaceListItem[];
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

export const terminalStates = new Set(["SUCCESS", "FAILURE", "STOP", "KILL", "FORCED_SUCCESS", "SUBMIT_FAILED", "AUTO_SAVE_FAILED", "RESULT_FAILED"]);
