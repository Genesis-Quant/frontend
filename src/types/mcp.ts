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
