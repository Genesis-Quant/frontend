import { client } from "@/assets/lib/request";
import type { McpCatalog, McpConfiguration, McpDocument } from "@/types/mcp";

function documentPath(slug: string) {
  return slug.split("/").map(encodeURIComponent).join("/");
}

export const mcpApi = {
  catalog: () => client.get<McpCatalog>("/mcp"),
  document: (slug: string) => client.get<McpDocument>(`/mcp/${documentPath(slug)}`),
  configuration: () => client.get<McpConfiguration>("/users/me/mcp-configuration"),
  updateConfiguration: (configuration: McpConfiguration) => client.put<McpConfiguration>("/users/me/mcp-configuration", configuration)
};
