import { client } from "@/assets/lib/request";
import { BrowserDuckDb } from "@/assets/lib/duckdb";
import type { FactorQuery } from "@/types/factor";
import type { QueryCatalog, QueryOutput, QueryProject, QueryProjectPage, QueryWorkflowSubmitted } from "@/types/query";

export const queryApi = {
  listProjects: (page = 1, pageSize = 20) => client.get<QueryProjectPage>("/query/projects", { params: { page, page_size: pageSize } }),
  createProject: (title: string) => client.post<QueryProject>("/query/projects", { title }),
  getProject: (projectId: number) => client.get<QueryProject>(`/query/projects/${projectId}`),
  deleteProject: (projectId: number) => client.delete<{ id: number }>(`/query/projects/${projectId}`),
  run: (projectId: number, parameters: FactorQuery) => client.post<QueryWorkflowSubmitted>(`/query/projects/${projectId}/queries`, parameters, { timeout: 30000 }),
  catalog: () => client.get<QueryCatalog>("/query/dsl/catalog", { timeout: 30000 }),
  outputs: (workflowInstanceId: number) => client.get<QueryOutput[]>(`/query/workflows/${workflowInstanceId}/outputs`),
  output: (workflowInstanceId: number, name: QueryOutput["name"]) => client.getBinary(`/query/workflows/${workflowInstanceId}/outputs/${name}`)
};

export function queryResultTableName(projectId: number) {
  return `query_${projectId}`;
}

export async function queryResultCodes(workflowInstanceId: number): Promise<string[]> {
  const buffer = await queryApi.output(workflowInstanceId, "data");
  const database = await BrowserDuckDb.create({ "query-result.parquet": buffer });
  try {
    const rows = await database.rows("SELECT DISTINCT CAST(code AS VARCHAR) AS code FROM read_parquet('query-result.parquet') WHERE code IS NOT NULL AND TRIM(CAST(code AS VARCHAR)) <> '' ORDER BY code");
    const codes = rows.map((row) => String(row.code).trim());
    if (!codes.length) throw new Error("所选查询结果没有有效的 code");
    return codes;
  } finally {
    await database.close();
  }
}
