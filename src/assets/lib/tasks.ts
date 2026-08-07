import { client } from "@/assets/lib/request";
import type { TaskActionResponse, TaskLog } from "@/types/task";

export const tasksApi = {
  logs: (workflowInstanceId: number, taskInstanceId: number, skipLineNum = 0, limit = 500) => client.get<TaskLog>(`/tasks/${taskInstanceId}/logs`, { params: { workflow_instance_id: workflowInstanceId, skip_line_num: skipLineNum, limit } }),
  forceSuccess: (workflowInstanceId: number, taskInstanceId: number) => client.post<TaskActionResponse>(`/tasks/${taskInstanceId}/actions/force-success`, null, { params: { workflow_instance_id: workflowInstanceId } })
};
