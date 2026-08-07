import {
  Activity,
  CheckCircle2,
  Cloud,
  Database,
  FileArchive,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Users,
  Workflow
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { adminApi } from "@/assets/lib/admin";
import { formatDateTime } from "@/assets/lib/dateTime";
import { errorMessage } from "@/assets/lib/utils";
import { PageHero } from "@/components/bar/PageHero";
import IncrementalWorkerDialog from "@/components/modal/IncrementalWorkerDialog";
import { AppPagination } from "@/components/pagination/AppPagination";
import WorkflowPanel from "@/components/panel/WorkflowPanel";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { StatusBadge } from "@/components/badge/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/ui/select";
import { Switch } from "@/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { useAppStore } from "@/store";
import type { AdminOutputStorage, AdminOutputWorkspace, AdminOverview } from "@/types/admin";

type Action = "incremental" | "workflows" | null;
type AdminTab = "overview" | "scheduler" | "workflows" | "storage" | "users";

export default function AdminPage() {
  const currentUser = useAppStore((state) => state.user);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<ArenaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [incrementalDialogOpen, setIncrementalDialogOpen] = useState(false);
  const [selectedIncrementalWorkers, setSelectedIncrementalWorkers] = useState<string[]>([]);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [deletingWorkspaceKey, setDeletingWorkspaceKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { activeTab, changeTab, loadOutputStorage, outputStorage, refreshOutputStorage, storageLoading } = useAdminOutputStorage(setError);

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [nextOverview, userList] = await Promise.all([
        adminApi.overview(),
        adminApi.users()
      ]);
      setOverview(nextOverview);
      setUsers(userList.items);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function refresh() {
    await Promise.all([
      load(true),
      refreshOutputStorage()
    ]);
  }

  function openIncrementalDialog() {
    setError("");
    setNotice("");
    setSelectedIncrementalWorkers(
      overview?.scheduler.incremental_workers.map((worker) => worker.name) ?? []
    );
    setIncrementalDialogOpen(true);
  }

  async function runIncrementalUpdate() {
    if (!selectedIncrementalWorkers.length) return;
    setAction("incremental");
    setError("");
    setNotice("");
    try {
      const result = await adminApi.runIncrementalUpdate(selectedIncrementalWorkers);
      setIncrementalDialogOpen(false);
      setNotice(`${result.message}，${result.workers.length} 个 Worker，Job ID：${result.job_id}`);
      await load(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAction(null);
    }
  }

  async function ensureWorkflows() {
    setAction("workflows");
    setError("");
    setNotice("");
    try {
      const result = await adminApi.ensureWorkflows();
      setNotice(result.message);
      await load(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAction(null);
    }
  }

  async function updateUser(user: ArenaUser, isAdmin: boolean) {
    setUpdatingUserId(user.id);
    setError("");
    try {
      const updated = await adminApi.updateUser(user.id, isAdmin);
      setUsers((items) => items.map((item) => item.id === updated.id ? updated : item));
      setOverview((current) => updateAdministratorCount(current, isAdmin));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function deleteOrphanWorkspace(workspace: AdminOutputWorkspace) {
    setDeletingWorkspaceKey(workspace.workspace_key);
    setError("");
    setNotice("");
    try {
      const result = await adminApi.deleteOrphanWorkspace(
        workspace.application,
        workspace.workspace_key
      );
      setNotice(result.message);
      await loadOutputStorage();
    } catch (reason) {
      setError(errorMessage(reason));
      throw reason;
    } finally {
      setDeletingWorkspaceKey(null);
    }
  }

  return <div className="space-y-6">
    <PageHero
      actions={<Button variant="outline" disabled={refreshing || storageLoading} onClick={refresh}>{refreshing || storageLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}刷新</Button>}
      chips={["管理员权限", "调度状态", "用户管理"]}
      description="查看 Arena 全局运行状态，维护调度工作流和用户权限，并直接发起数据增量更新。"
      eyebrow="ADMINISTRATION"
      icon={ShieldCheck}
      stat={{ label: "运行中工作流", value: overview?.workflow_instances.active ?? 0 }}
      title="管理面板"
      variant="archive"
    />

    <FeedbackMessage tone="error" value={error} />
    <FeedbackMessage tone="success" value={notice} />

    <Tabs value={activeTab} onValueChange={changeTab} className="gap-4">
      <div className="overflow-x-auto pb-1"><TabsList>
        <TabsTrigger value="overview"><Activity />概览</TabsTrigger>
        <TabsTrigger value="scheduler"><Server />调度管理</TabsTrigger>
        <TabsTrigger value="workflows"><Workflow />工作流实例</TabsTrigger>
        <TabsTrigger value="storage"><HardDrive />输出存储</TabsTrigger>
        <TabsTrigger value="users"><Users />用户管理</TabsTrigger>
      </TabsList></div>

      <TabsContent value="overview"><AdminOverviewCards overview={overview} /></TabsContent>

      <TabsContent value="scheduler" className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <Card>
            <CardHeader><CardTitle>调度操作</CardTitle><CardDescription>操作直接提交到当前 DolphinScheduler 项目。</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <ManagementAction icon={<Database />} title="运行增量更新" description="选择需要更新的数据，Task 并行入队并由 tushare-api Task Group 控制并发。" action={<Button disabled={action !== null || !overview?.scheduler.available || !overview.scheduler.incremental_workers.length} onClick={openIncrementalDialog}><Play />运行</Button>} />
              <ManagementAction icon={<Workflow />} title="同步工作流定义" description="重新注册 Query、Factor、Backtest 和 Incremental Update 工作流与 Task Group。" action={<Button variant="outline" disabled={action !== null || !overview?.scheduler.available} onClick={ensureWorkflows}>{action === "workflows" ? <Loader2 className="animate-spin" /> : <RefreshCw />}同步</Button>} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>调度项目</CardTitle><CardDescription>DolphinScheduler 中由 Arena 管理的项目。</CardDescription></CardHeader>
            <CardContent><dl className="grid gap-3 text-sm"><Definition label="项目名称" value={overview?.scheduler.project_name ?? "—"} /><Definition label="Project Code" value={overview?.scheduler.project_code?.toString() ?? "—"} mono /><Definition label="Worker Group" value={overview?.scheduler.worker_groups.join(", ") || "—"} /><Definition label="连接状态" value={overview?.scheduler.available ? "可用" : "不可用"} /></dl>{overview?.scheduler.error ? <p className="mt-4 text-xs leading-5 text-destructive">{overview.scheduler.error}</p> : null}</CardContent>
          </Card>
        </div>
        <SectionCard title="工作流定义" description="当前在线定义及其版本。"><Table><TableHeader><TableRow><TableHead>名称</TableHead><TableHead>Code</TableHead><TableHead>版本</TableHead><TableHead>发布状态</TableHead><TableHead>执行类型</TableHead><TableHead>更新时间</TableHead></TableRow></TableHeader><TableBody>{overview?.scheduler.workflows.map((workflow) => <TableRow key={workflow.code}><TableCell className="font-medium">{workflow.name}</TableCell><TableCell className="font-mono text-xs">{workflow.code}</TableCell><TableCell>v{workflow.version}</TableCell><TableCell><StatusBadge tone={workflow.release_state === "ONLINE" ? "green" : "neutral"}>{workflow.release_state}</StatusBadge></TableCell><TableCell>{workflow.execution_type ?? "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDateTime(workflow.updated_at)}</TableCell></TableRow>)}</TableBody></Table><EmptyState loading={loading} empty={!overview?.scheduler.workflows.length} /></SectionCard>
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard title="Task Group" description="跨工作流的全局 Task 并发配额。"><Table><TableHeader><TableRow><TableHead>名称</TableHead><TableHead>占用 / 容量</TableHead><TableHead>状态</TableHead><TableHead>说明</TableHead></TableRow></TableHeader><TableBody>{overview?.scheduler.task_groups.map((group) => <TableRow key={group.id}><TableCell className="font-medium">{group.name}</TableCell><TableCell className="font-mono">{group.use_size} / {group.group_size}</TableCell><TableCell><StatusBadge tone={group.status === "YES" ? "green" : "neutral"}>{group.status}</StatusBadge></TableCell><TableCell className="max-w-64 truncate text-xs text-muted-foreground" title={group.description}>{group.description}</TableCell></TableRow>)}</TableBody></Table><EmptyState loading={loading} empty={!overview?.scheduler.task_groups.length} /></SectionCard>
          <SectionCard title="Worker 节点" description="节点心跳和资源占用。"><Table><TableHeader><TableRow><TableHead>节点</TableHead><TableHead>状态</TableHead><TableHead>CPU</TableHead><TableHead>内存</TableHead><TableHead>线程池</TableHead></TableRow></TableHeader><TableBody>{overview?.scheduler.workers.map((worker) => <TableRow key={worker.id}><TableCell><div className="font-mono text-xs">{worker.host}:{worker.port}</div><div className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(worker.last_heartbeat_at)}</div></TableCell><TableCell><StatusBadge tone={worker.status === "NORMAL" ? "green" : "red"}>{worker.status}</StatusBadge></TableCell><TableCell>{formatPercent(worker.cpu_usage)}</TableCell><TableCell>{formatPercent(worker.memory_usage)}</TableCell><TableCell>{formatPercent(worker.thread_pool_usage)}</TableCell></TableRow>)}</TableBody></Table><EmptyState loading={loading} empty={!overview?.scheduler.workers.length} /></SectionCard>
        </div>
      </TabsContent>

      <TabsContent value="workflows" className="space-y-4"><div><h2 className="text-lg font-semibold">工作流实例</h2><p className="mt-1 text-sm text-muted-foreground">查看、筛选和管理全部应用的工作流及其 Task。</p></div><WorkflowPanel showUsername /></TabsContent>
      <TabsContent value="storage"><OutputStorageCard deletingWorkspaceKey={deletingWorkspaceKey} loading={storageLoading} storage={outputStorage} onDelete={deleteOrphanWorkspace} /></TabsContent>
      <TabsContent value="users"><AdminUsers currentUserId={currentUser?.id} loading={loading} updatingUserId={updatingUserId} users={users} onUpdate={updateUser} /></TabsContent>
    </Tabs>

    <IncrementalWorkerDialog
      error={error}
      open={incrementalDialogOpen}
      selected={selectedIncrementalWorkers}
      submitting={action === "incremental"}
      workers={overview?.scheduler.incremental_workers ?? []}
      onOpenChange={setIncrementalDialogOpen}
      onSelectedChange={setSelectedIncrementalWorkers}
      onSubmit={runIncrementalUpdate}
    />
  </div>;
}

function AdminOverviewCards({ overview }: { overview: AdminOverview | null }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <SummaryCard icon={<Users />} label="注册用户" value={overview?.users.total} detail={`${overview?.users.administrators ?? 0} 位管理员`} />
    <SummaryCard icon={<Workflow />} label="全部工作流实例" value={overview?.workflow_instances.total} detail={`${overview?.workflow_instances.active ?? 0} 个运行中`} />
    <SummaryCard icon={<CheckCircle2 />} label="成功工作流" value={overview?.workflow_instances.success} detail="历史累计" />
    <SummaryCard icon={<Server />} label="Worker 节点" value={overview?.scheduler.workers.length} detail={overview?.scheduler.available ? "调度器在线" : "调度器不可用"} />
  </div>;
}

function AdminUsers({ currentUserId, loading, onUpdate, updatingUserId, users }: { currentUserId: number | undefined; loading: boolean; onUpdate: (user: ArenaUser, isAdmin: boolean) => void; updatingUserId: number | null; users: ArenaUser[] }) {
  return <SectionCard title="用户权限" description="管理员可以查看全站任务并使用本管理面板。"><Table><TableHeader><TableRow><TableHead>用户</TableHead><TableHead>账号 ID</TableHead><TableHead>注册时间</TableHead><TableHead className="text-right">管理员</TableHead></TableRow></TableHeader><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell className="font-medium">{user.username}{user.id === currentUserId ? <Badge className="ml-2" variant="secondary">当前账号</Badge> : null}</TableCell><TableCell className="font-mono text-xs">#{user.id}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDateTime(user.created_at)}</TableCell><TableCell className="text-right"><Switch checked={user.is_admin} disabled={updatingUserId !== null || user.id === currentUserId} onCheckedChange={(checked) => onUpdate(user, checked)} aria-label={`设置 ${user.username} 的管理员权限`} /></TableCell></TableRow>)}</TableBody></Table><EmptyState loading={loading} empty={!users.length} /></SectionCard>;
}

function useAdminOutputStorage(setError: (value: string) => void) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [outputStorage, setOutputStorage] = useState<AdminOutputStorage | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);

  const loadOutputStorage = useCallback(async () => {
    setStorageLoading(true);
    setError("");
    try {
      setOutputStorage(await adminApi.outputStorage());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setStorageLoading(false);
    }
  }, [setError]);

  function changeTab(value: string) {
    const nextTab = value as AdminTab;
    setActiveTab(nextTab);
    if (nextTab === "storage" && outputStorage === null && !storageLoading) loadOutputStorage();
  }

  function refreshOutputStorage() {
    return activeTab === "storage" ? loadOutputStorage() : Promise.resolve();
  }

  return { activeTab, changeTab, loadOutputStorage, outputStorage, refreshOutputStorage, storageLoading };
}

type StorageOwnershipFilter = "all" | "owned" | "orphaned";

function OutputStorageCard({ deletingWorkspaceKey, loading, onDelete, storage }: { deletingWorkspaceKey: string | null; loading: boolean; onDelete: (workspace: AdminOutputWorkspace) => Promise<void>; storage: AdminOutputStorage | null }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [application, setApplication] = useState("all");
  const [ownership, setOwnership] = useState<StorageOwnershipFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<AdminOutputWorkspace | null>(null);
  const filteredWorkspaces = useMemo(() => (storage?.workspaces ?? []).filter((workspace) => {
    if (application !== "all" && workspace.application !== application) return false;
    if (ownership === "owned" && workspace.orphaned) return false;
    if (ownership === "orphaned" && !workspace.orphaned) return false;
    return true;
  }), [application, ownership, storage]);
  const totalPages = Math.max(1, Math.ceil(filteredWorkspaces.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const workspaces = filteredWorkspaces.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); }, [application, ownership, storage]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await onDelete(deleteTarget);
      setDeleteTarget(null);
    } catch {
      // 页面级反馈保留错误详情，确认框保持打开以便用户核对。
    }
  }

  return <><Card className="gap-0 overflow-hidden py-0">
    <CardHeader className="border-b py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><CardTitle>输出文件存储</CardTitle><CardDescription className="mt-1 truncate font-mono" title={storage?.root}>{storage?.root ?? "正在读取共享存储"}</CardDescription></div>
        {storage ? <Badge variant="secondary" className="gap-1.5">{storage.mode === "cloud" ? <Cloud className="size-3" /> : <HardDrive className="size-3" />}{storage.mode === "cloud" ? "对象存储" : "本地共享目录"}</Badge> : null}
      </div>
    </CardHeader>
    <CardContent className="p-0">
      {loading && !storage ? <div className="grid min-h-44 place-items-center text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div> : null}
      {!loading && storage && !storage.available ? <div className="flex min-h-44 flex-col items-center justify-center gap-2 px-5 text-center"><HardDrive className="size-6 text-destructive" /><p className="text-sm font-medium">无法读取输出存储</p><p className="max-w-2xl text-xs leading-5 text-muted-foreground">{storage.error}</p></div> : null}
      {storage?.available && <>
        <div className="grid border-b sm:grid-cols-2 xl:grid-cols-4">
          <StorageMetric icon={<HardDrive />} label="占用空间" value={formatBytes(storage.total_bytes)} />
          <StorageMetric icon={<Database />} label="Workspace" value={storage.workspace_count.toLocaleString("zh-CN")} />
          <StorageMetric icon={<FileArchive />} label="输出文件" value={storage.file_count.toLocaleString("zh-CN")} />
          <StorageMetric icon={<Trash2 />} label="游离 Workspace" value={storage.orphan_workspace_count.toLocaleString("zh-CN")} />
        </div>
        <div className="border-b px-5 py-4">
          <h3 className="text-xs font-semibold">按应用汇总</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {storage.applications.map((application) => <div className="rounded-md bg-muted/35 px-3 py-2.5" key={application.application}>
              <div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium capitalize">{application.application}</span><span className="font-mono text-muted-foreground">{formatBytes(application.total_bytes)}</span></div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${storage.total_bytes ? Math.max(2, application.total_bytes / storage.total_bytes * 100) : 0}%` }} /></div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">{application.workspace_count.toLocaleString("zh-CN")} 个 workspace · {application.file_count.toLocaleString("zh-CN")} 个文件</p>
            </div>)}
            {!storage.applications.length ? <p className="text-xs text-muted-foreground">暂无输出文件</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <p className="text-xs text-muted-foreground">显示 {filteredWorkspaces.length.toLocaleString("zh-CN")} / {storage.workspace_count.toLocaleString("zh-CN")} 个 workspace</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={ownership} onValueChange={(value) => setOwnership(value as StorageOwnershipFilter)}><SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部归属</SelectItem><SelectItem value="owned">已有归属</SelectItem><SelectItem value="orphaned">仅游离项</SelectItem></SelectContent></Select>
            <Select value={application} onValueChange={setApplication}><SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部应用</SelectItem>{storage.applications.map((item) => <SelectItem value={item.application} key={item.application}>{item.application}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <div className="overflow-x-auto"><Table className="min-w-[1040px] table-fixed">
          <TableHeader><TableRow><TableHead className="w-28 px-5">应用</TableHead><TableHead>Workspace</TableHead><TableHead className="w-64">归属</TableHead><TableHead className="w-24 text-right">文件</TableHead><TableHead className="w-28 text-right">占用空间</TableHead><TableHead className="w-40">修改时间</TableHead><TableHead className="w-16 px-4" /></TableRow></TableHeader>
          <TableBody>{workspaces.map((workspace) => <TableRow key={`${workspace.application}:${workspace.workspace_key}`}><TableCell className="px-5"><Badge variant="secondary" className="capitalize">{workspace.application}</Badge><div className="mt-1 text-[10px] uppercase text-muted-foreground">{workspace.storage}</div></TableCell><TableCell><div className="truncate font-mono text-xs font-medium" title={workspace.workspace_key}>{workspace.workspace_key}</div><div className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={workspace.path}>{workspace.path}</div></TableCell><TableCell><WorkspaceOwnership workspace={workspace} /></TableCell><TableCell className="text-right font-mono text-xs">{workspace.file_count.toLocaleString("zh-CN")}</TableCell><TableCell className="text-right font-mono text-xs">{formatBytes(workspace.size_bytes)}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{formatDateTime(workspace.modified_at)}</TableCell><TableCell className="px-4 text-right">{workspace.orphaned ? <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" title="删除游离 workspace" aria-label="删除游离 workspace" disabled={deletingWorkspaceKey !== null} onClick={() => setDeleteTarget(workspace)}>{deletingWorkspaceKey === workspace.workspace_key ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button> : null}</TableCell></TableRow>)}</TableBody>
        </Table></div>
        {!workspaces.length ? <div className="grid min-h-28 place-items-center text-sm text-muted-foreground">没有符合筛选条件的 workspace</div> : null}
        <div className="flex flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">共 {filteredWorkspaces.length.toLocaleString("zh-CN")} 个 workspace</p><AppPagination page={safePage} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>
      </>}
    </CardContent>
  </Card><Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && deletingWorkspaceKey === null) setDeleteTarget(null); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>删除游离 workspace</DialogTitle><DialogDescription>将永久删除该 workspace 的本地目录及云端输出对象，此操作无法撤销。</DialogDescription></DialogHeader>{deleteTarget ? <div className="rounded-md bg-muted/40 px-3 py-2 font-mono text-xs break-all">{deleteTarget.application}/{deleteTarget.workspace_key}</div> : null}<DialogFooter><Button variant="outline" disabled={deletingWorkspaceKey !== null} onClick={() => setDeleteTarget(null)}>取消</Button><Button variant="destructive" disabled={deletingWorkspaceKey !== null} onClick={confirmDelete}>{deletingWorkspaceKey !== null ? <Loader2 className="animate-spin" /> : <Trash2 />}删除</Button></DialogFooter></DialogContent></Dialog></>;
}

function WorkspaceOwnership({ workspace }: { workspace: AdminOutputWorkspace }) {
  if (workspace.orphaned) return <StatusBadge tone="red">游离</StatusBadge>;
  return <div className="min-w-0"><div className="truncate text-xs font-medium" title={workspace.project_title ?? undefined}>{workspace.project_title ?? "工作流任务"}</div><div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{workspace.project_id !== null ? `项目 #${workspace.project_id} · ` : ""}Run #{workspace.workflow_run_id}</div></div>;
}

function StorageMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 border-r px-5 py-4 last:border-r-0"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">{icon}</span><div className="min-w-0"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 truncate font-mono text-sm font-semibold" title={value}>{value}</p></div></div>;
}

function SummaryCard({ detail, icon, label, value }: { detail: string; icon: ReactNode; label: string; value: number | undefined }) {
  return <Card className="gap-3 py-5"><CardContent className="flex items-center gap-4"><span className="grid size-10 place-items-center rounded-md border bg-muted text-primary [&_svg]:size-5">{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? "—"}</p><p className="mt-1 text-[10px] text-muted-foreground">{detail}</p></div></CardContent></Card>;
}

function FeedbackMessage({ tone, value }: { tone: "error" | "success"; value: string }) {
  if (!value) return null;
  const className = tone === "error"
    ? "border-destructive/30 bg-destructive/5 text-destructive"
    : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
  return <div className={`rounded-md border px-4 py-3 text-sm ${className}`}>{value}</div>;
}

function ManagementAction({ action, description, icon, title }: { action: ReactNode; description: string; icon: ReactNode; title: string }) {
  return <div className="flex min-h-36 flex-col rounded-md border bg-muted/25 p-4"><div className="flex items-center gap-2 font-medium [&_svg]:size-4">{icon}{title}</div><p className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">{description}</p><div className="mt-4">{action}</div></div>;
}

function SectionCard({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return <Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b py-5"><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="overflow-x-auto p-0">{children}</CardContent></Card>;
}

function Definition({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className={mono ? "font-mono text-xs" : "font-medium"}>{value}</dd></div>;
}

function EmptyState({ empty, loading }: { empty: boolean; loading: boolean }) {
  if (!loading && !empty) return null;
  return <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground">{loading ? <><Loader2 className="size-4 animate-spin" />正在加载...</> : <><Activity className="size-4" />暂无数据</>}</div>;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)) - 1, units.length - 1);
  const scaled = value / 1024 ** (unitIndex + 1);
  return `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function updateAdministratorCount(overview: AdminOverview | null, isAdmin: boolean) {
  if (!overview) return overview;
  return {
    ...overview,
    users: {
      ...overview.users,
      administrators: overview.users.administrators + (isAdmin ? 1 : -1)
    }
  };
}
