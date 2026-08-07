export type TaskLog = {
  workflow_instance_id: number;
  task_instance_id: number;
  state: string;
  skip_line_num: number;
  returned_lines: number;
  next_line_num: number;
  has_more: boolean;
  message: string;
};

export type TaskActionResponse = {
  action: "force-success";
  scheduler_submission: unknown;
  workflow_instance_id: number;
  task_instance_id: number;
  task: Record<string, unknown>;
};
