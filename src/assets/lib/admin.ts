import { client } from "@/assets/lib/request";
import type {
  AdminActionResponse,
  AdminOverview,
  AdminOutputStorage,
  AdminUserList,
  IncrementalUpdateRun
} from "@/types/admin";

export const adminApi = {
  overview: () => client.get<AdminOverview>("/admin/overview"),
  outputStorage: () => client.get<AdminOutputStorage>("/admin/output-storage"),
  deleteOrphanWorkspace: (application: string, workspaceKey: string) =>
    client.delete<AdminActionResponse>(
      `/admin/output-storage/workspaces/${encodeURIComponent(application)}/${encodeURIComponent(workspaceKey)}`
    ),
  users: () => client.get<AdminUserList>("/admin/users"),
  updateUser: (userId: number, isAdmin: boolean) =>
    client.patch<ArenaUser>(`/admin/users/${userId}`, { is_admin: isAdmin }),
  ensureWorkflows: () =>
    client.post<AdminActionResponse>("/admin/workflows/ensure", null, { timeout: 120000 }),
  runIncrementalUpdate: (workers?: string[], channel = "console") =>
    client.post<IncrementalUpdateRun>(
      "/admin/incremental-update/runs",
      workers ? { workers, channel } : { channel }
    )
};
