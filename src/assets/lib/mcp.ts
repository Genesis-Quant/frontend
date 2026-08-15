import { client } from "@/assets/lib/request";
import type { McpCatalog, McpDocument } from "@/types/mcp";

function documentPath(slug: string) {
  return slug.split("/").map(encodeURIComponent).join("/");
}

export const mcpApi = {
  catalog: () => client.get<McpCatalog>("/mcp"),
  document: (slug: string) => client.get<McpDocument>(`/mcp/${documentPath(slug)}`)
};
