import type { DslCatalog, DslDocument, FactorQuery } from "@/types/factor";

export type QueryWorkflowSummary = {
  record_id: number;
  workflow_instance_id: number | null;
  state: string;
  error: string | null;
  parameters: FactorQuery;
  updated_at: string;
};

export type QueryProject = {
  id: number;
  title: string;
  current: QueryWorkflowSummary | null;
  created_at: string;
  updated_at: string;
};

export type QueryProjectListItem = {
  id: number;
  title: string;
  current: Pick<QueryWorkflowSummary, "workflow_instance_id" | "state"> | null;
  updated_at: string;
};

export type QueryProjectPage = {
  items: QueryProjectListItem[];
  page: number;
  page_size: number;
  total: number;
  limit: number;
};

export type QueryWorkflowSubmitted = { record_id: number; workflow_instance_id: number };
export type QueryOutput = { name: "source_data" | "computed_data" | "filtered_data" | "data"; filename: string; size: number; modified_at: string };
export type QueryCatalog = DslCatalog;

export function defaultQueryParameters(): FactorQuery {
  return {
    start_date: "2020-01-01",
    end_date: "2026-01-01",
    lookback: "P0D",
    codes: ["000001.SZ", "600000.SH"],
    factors: ["close", "vol"],
    derivatives: {},
    filters: []
  };
}

export function queryDsl(query: FactorQuery): DslDocument {
  return { factors: query.factors, derivatives: query.derivatives, filters: query.filters };
}

export function applyQueryDsl(query: FactorQuery, dsl: DslDocument): FactorQuery {
  return { ...query, ...dsl };
}
