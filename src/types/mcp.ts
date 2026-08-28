export type McpDocumentSummary = {
  slug: string;
  title: string;
  description: string;
};

export type McpSection = {
  slug: string;
  title: string;
  description: string;
  items: McpDocumentSummary[];
};

export type McpCatalog = {
  mcp_url: string;
  sections: McpSection[];
  total: number;
};

export type McpDocument = McpDocumentSummary & {
  section: string;
  content: string;
};

export type McpConfiguration = {
  custom_prompt: string;
  allow_delete_query_projects: boolean;
  allow_delete_factor_projects: boolean;
  allow_delete_backtest_projects: boolean;
  allow_delete_factor_versions: boolean;
  allow_delete_backtest_versions: boolean;
  allow_delete_fee_analyses: boolean;
  allow_delete_sensitivity_analyses: boolean;
  allow_delete_optimizations: boolean;
};

export type McpDeletePermission = Exclude<keyof McpConfiguration, "custom_prompt">;
