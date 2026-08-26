import { client } from "@/assets/lib/request";
import type {
  DslCatalog,
  FactorAnalysisParameters,
  FactorWorkflowSubmitted,
  FactorOutput,
  FactorProject,
  FactorProjectPage,
  FactorProjectSortField,
  FactorVersion,
  FactorVersionListItem
} from "@/types/factor";
import type { ProjectListParams } from "@/types/project";
import type { BatchRunAccepted, BatchRunRequest } from "@/types/queue";

export const factorApi = {
  listProjects: (params: ProjectListParams<FactorProjectSortField> = {}) => client.get<FactorProjectPage>("/factor/projects", { params }),
  createProject: (title: string) => client.post<FactorProject>("/factor/projects", { title }),
  getProject: (projectId: number) => client.get<FactorProject>(`/factor/projects/${projectId}`),
  updateProject: (projectId: number, title: string) => client.patch<FactorProject>(`/factor/projects/${projectId}`, { title }),
  deleteProject: (projectId: number) => client.delete<{ id: number }>(`/factor/projects/${projectId}`),
  analyze: (projectId: number, parameters: FactorAnalysisParameters) => client.post<FactorWorkflowSubmitted>(`/factor/projects/${projectId}/analyses`, parameters, { timeout: 30000 }),
  executeBatch: (projectId: number, request: BatchRunRequest<FactorAnalysisParameters>) => client.post<BatchRunAccepted[]>(`/factor/projects/${projectId}/batch-runs`, request, { timeout: 30000 }),
  listVersions: (projectId: number) => client.get<FactorVersionListItem[]>(`/factor/projects/${projectId}/versions`),
  getVersion: (projectId: number, version: number) => client.get<FactorVersion>(`/factor/projects/${projectId}/versions/${version}`),
  saveVersion: (projectId: number, workflowInstanceId: number, remark: string) => client.post<FactorVersion>(`/factor/projects/${projectId}/versions`, { workflow_instance_id: workflowInstanceId, remark }),
  updateVersion: (projectId: number, version: number, remark: string) => client.patch<FactorVersion>(`/factor/projects/${projectId}/versions/${version}`, { remark }),
  deleteVersion: (projectId: number, version: number) => client.delete<{ version: number }>(`/factor/projects/${projectId}/versions/${version}`),
  catalog: () => client.get<DslCatalog>("/factor/dsl/catalog", { timeout: 30000 }),
  outputs: (workflowInstanceId: number) => client.get<FactorOutput[]>(`/factor/workflows/${workflowInstanceId}/outputs`),
  output: (workflowInstanceId: number, name: FactorOutput["name"]) => client.getBinary(`/factor/workflows/${workflowInstanceId}/outputs/${name}`)
};
