import { client } from "@/assets/lib/request";
import type {
  DslCatalog,
  FactorAnalysisParameters,
  FactorWorkflowSubmitted,
  FactorMetrics,
  FactorOutput,
  FactorProject,
  FactorProjectPage,
  FactorVersion,
  FactorVersionListItem
} from "@/types/factor";

export const factorApi = {
  listProjects: (page = 1, pageSize = 20) => client.get<FactorProjectPage>("/factor/projects", { params: { page, page_size: pageSize } }),
  createProject: (title: string) => client.post<FactorProject>("/factor/projects", { title }),
  getProject: (projectId: number) => client.get<FactorProject>(`/factor/projects/${projectId}`),
  updateProject: (projectId: number, title: string) => client.patch<FactorProject>(`/factor/projects/${projectId}`, { title }),
  deleteProject: (projectId: number) => client.delete<{ id: number }>(`/factor/projects/${projectId}`),
  analyze: (projectId: number, parameters: FactorAnalysisParameters) => client.post<FactorWorkflowSubmitted>(`/factor/projects/${projectId}/analyses`, parameters, { timeout: 30000 }),
  listVersions: (projectId: number) => client.get<FactorVersionListItem[]>(`/factor/projects/${projectId}/versions`),
  getVersion: (projectId: number, version: number) => client.get<FactorVersion>(`/factor/projects/${projectId}/versions/${version}`),
  saveVersion: (projectId: number, workflowInstanceId: number, remark: string, metrics: FactorMetrics) => client.post<FactorVersion>(`/factor/projects/${projectId}/versions`, { workflow_instance_id: workflowInstanceId, remark, metrics }),
  catalog: () => client.get<DslCatalog>("/factor/dsl/catalog", { timeout: 30000 }),
  outputs: (workflowInstanceId: number) => client.get<FactorOutput[]>(`/factor/workflows/${workflowInstanceId}/outputs`),
  output: (workflowInstanceId: number, name: FactorOutput["name"]) => client.getBinary(`/factor/workflows/${workflowInstanceId}/outputs/${name}`)
};
