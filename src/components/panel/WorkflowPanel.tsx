import { Activity, ChevronDown, ChevronRight, Clock3, Eye, Loader2, RefreshCw, Square, Terminal } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { formatDateTime } from "@/assets/lib/dateTime";
import { cn } from "@/assets/lib/utils";
import { formatDuration, resolveDurationSeconds, workflowsApi } from "@/assets/lib/workflows";
import WorkflowApplicationBadge from "@/components/badge/WorkflowApplicationBadge";
import TaskStateBadge from "@/components/badge/TaskStateBadge";
import SchedulerState, { schedulerStateLabel } from "@/components/status/SchedulerState";
import WorkflowDetailsModal from "@/components/modal/WorkflowDetailsModal";
import TaskLogModal from "@/components/modal/TaskLogModal";
import { AppPagination } from "@/components/pagination/AppPagination";
import { useAppStore } from "@/store";
import { terminalStates, type WorkflowApplication, type WorkflowAttemptListPage, type WorkflowAttemptSummary, type WorkflowTaskSummary, type WorkflowWorkspaceListItem, type WorkflowWorkspaceListPage } from "@/types/workflow";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";

type StateFilter = "all" | "active" | "success" | "failure";
type SelectedTask = { workflowInstanceId: number; taskInstanceId: number };

export default function WorkflowPanel({ onTotalChange, showUsername = false }: { onTotalChange?: (total: number) => void; showUsername?: boolean }) {
  const userId = useAppStore((store) => store.user?.id);
  const [result, setResult] = useState<WorkflowWorkspaceListPage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [application, setApplication] = useState<"all" | WorkflowApplication>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stoppingWorkflowId, setStoppingWorkflowId] = useState<number | null>(null);
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<Set<number>>(new Set());
  const [attemptsByWorkspace, setAttemptsByWorkspace] = useState<Record<number, WorkflowAttemptListPage>>({});
  const [loadingWorkspaceIds, setLoadingWorkspaceIds] = useState<Set<number>>(new Set());
  const [attemptErrors, setAttemptErrors] = useState<Record<number, string>>({});
  const [detailsAttemptId, setDetailsAttemptId] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const loadRequest = useRef(0);
  const attemptLoadGeneration = useRef(0);
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / pageSize));

  const load = useCallback(async (background = false) => {
    const requestId = ++loadRequest.current;
    background ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const nextResult = await workflowsApi.list({ page, page_size: pageSize, application: application === "all" ? undefined : application, state: state === "all" ? undefined : state });
      if (requestId !== loadRequest.current) return;
      setResult(nextResult);
      onTotalChange?.(nextResult.total);
    } catch (reason) {
      if (requestId === loadRequest.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (requestId === loadRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [application, onTotalChange, page, pageSize, state]);

  const loadAttempts = useCallback(async (workspaceId: number, pageNumber = 1) => {
    const generation = attemptLoadGeneration.current;
    setLoadingWorkspaceIds((current) => new Set(current).add(workspaceId));
    setAttemptErrors((current) => ({ ...current, [workspaceId]: "" }));
    try {
      const attemptPage = await workflowsApi.attempts(workspaceId, pageNumber);
      if (generation !== attemptLoadGeneration.current) return;
      setAttemptsByWorkspace((current) => {
        const previous = current[workspaceId];
        if (pageNumber === 1 || !previous) return { ...current, [workspaceId]: attemptPage };
        const existingIds = new Set(previous.items.map((attempt) => attempt.attempt_id));
        return {
          ...current,
          [workspaceId]: {
            ...attemptPage,
            items: [...previous.items, ...attemptPage.items.filter((attempt) => !existingIds.has(attempt.attempt_id))]
          }
        };
      });
    } catch (reason) {
      if (generation !== attemptLoadGeneration.current) return;
      setAttemptErrors((current) => ({ ...current, [workspaceId]: reason instanceof Error ? reason.message : String(reason) }));
    } finally {
      if (generation === attemptLoadGeneration.current) {
        setLoadingWorkspaceIds((current) => {
          const next = new Set(current);
          next.delete(workspaceId);
          return next;
        });
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    attemptLoadGeneration.current += 1;
    setExpandedWorkspaceIds(new Set());
    setAttemptsByWorkspace({});
    setAttemptErrors({});
    setLoadingWorkspaceIds(new Set());
  }, [application, page, pageSize, state]);
  useEffect(() => {
    if (!result) return;
    setAttemptsByWorkspace((current) => {
      let changed = false;
      const next = { ...current };
      for (const workspace of result.items) {
        const attemptPage = current[workspace.workspace_id];
        if (!attemptPage) continue;
        const index = attemptPage.items.findIndex((attempt) => attempt.attempt_id === workspace.current_attempt.attempt_id);
        let demotedPreviousCurrent = false;
        const previousAttempts = attemptPage.items.map((attempt) => {
          if (!attempt.is_current || attempt.attempt_id === workspace.current_attempt.attempt_id) return attempt;
          demotedPreviousCurrent = true;
          return { ...attempt, is_current: false };
        });
        if (index < 0) {
          next[workspace.workspace_id] = {
            ...attemptPage,
            items: [workspace.current_attempt, ...previousAttempts],
            total: Math.max(attemptPage.total, workspace.attempt_count)
          };
          changed = true;
        } else if (attemptPage.items[index] !== workspace.current_attempt || demotedPreviousCurrent) {
          const updated = [...previousAttempts];
          updated[index] = workspace.current_attempt;
          next[workspace.workspace_id] = { ...attemptPage, items: updated };
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [result]);
  useEffect(() => {
    if (stoppingWorkflowId === null) return;
    const workflow = result?.items.find((item) => item.current_attempt.workflow_instance_id === stoppingWorkflowId)?.current_attempt;
    if (!workflow || !workflowIsRunning(workflow)) setStoppingWorkflowId(null);
  }, [result, stoppingWorkflowId]);

  const containsPendingUpdate = useMemo(() => result?.items.some((workspace) => !terminalStates.has(workspace.current_attempt.state)) ?? false, [result]);
  const containsRunningWorkflow = useMemo(() => result?.items.some((workspace) => workflowIsRunning(workspace.current_attempt)) ?? false, [result]);
  useEffect(() => {
    if (!containsPendingUpdate) return undefined;
    const timer = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(timer);
  }, [containsPendingUpdate, load]);
  useEffect(() => {
    if (!containsRunningWorkflow) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [containsRunningWorkflow]);

  function changeApplication(value: string) { setApplication(value as "all" | WorkflowApplication); setPage(1); }
  function changeState(value: string) { setState(value as StateFilter); setPage(1); }
  function changePageSize(value: number) { setPageSize(value); setPage(1); }
  function toggleWorkspace(workspaceId: number) {
    const expanding = !expandedWorkspaceIds.has(workspaceId);
    setExpandedWorkspaceIds((current) => {
      const next = new Set(current);
      expanding ? next.add(workspaceId) : next.delete(workspaceId);
      return next;
    });
    if (expanding && !attemptsByWorkspace[workspaceId] && !loadingWorkspaceIds.has(workspaceId)) loadAttempts(workspaceId);
  }

  async function stopWorkflow(workflowInstanceId: number) {
    if (stoppingWorkflowId === workflowInstanceId) return;
    setStoppingWorkflowId(workflowInstanceId);
    setError("");
    try {
      await workflowsApi.stop(workflowInstanceId);
      await load(true);
      const workspaceId = result?.items.find((item) => item.current_attempt.workflow_instance_id === workflowInstanceId)?.workspace_id;
      if (workspaceId !== undefined && expandedWorkspaceIds.has(workspaceId)) await loadAttempts(workspaceId);
    } catch (reason) {
      setStoppingWorkflowId(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  const columns = showUsername ? 7 : 6;
  return <div className="space-y-4">
    {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div className="flex flex-wrap items-end gap-3"><Filter label="应用"><Select value={application} onValueChange={changeApplication}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部应用</SelectItem><SelectItem value="query">Query</SelectItem><SelectItem value="factor">Factor</SelectItem><SelectItem value="backtest">Backtest</SelectItem><SelectItem value="incremental">Incremental</SelectItem></SelectContent></Select></Filter><Filter label="状态"><Select value={state} onValueChange={changeState}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="active">运行中</SelectItem><SelectItem value="success">成功</SelectItem><SelectItem value="failure">失败</SelectItem></SelectContent></Select></Filter></div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">当前运行每 5 秒自动更新</span><Button variant="outline" disabled={refreshing} onClick={() => load(true)}>{refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}刷新</Button></div></div>
    <Card className="gap-0 overflow-hidden py-0 shadow-sm"><CardContent className="overflow-x-auto p-0"><Table className={cn("table-fixed", showUsername ? "min-w-[1120px]" : "min-w-[1020px]")}><TableHeader><TableRow><TableHead className="w-[28%] px-4">工作空间</TableHead>{showUsername ? <TableHead className="w-28">用户名</TableHead> : null}<TableHead className="w-56">当前运行</TableHead><TableHead>任务</TableHead><TableHead className="w-20 text-center">运行次数</TableHead><TableHead className="w-40">时间 / 耗时</TableHead><TableHead className="w-24 px-4 text-right">操作</TableHead></TableRow></TableHeader><TableBody>
      {result?.items.map((workspace) => {
        const expanded = expandedWorkspaceIds.has(workspace.workspace_id);
        return <WorkspaceRow canOpenProject={workspace.user_id === userId} columns={columns} expanded={expanded} key={workspace.workspace_id} now={now} showUsername={showUsername} stopping={workspace.current_attempt.workflow_instance_id === stoppingWorkflowId} workspace={workspace} onDetails={() => setDetailsAttemptId(workspace.current_attempt.attempt_id)} onLogs={(taskInstanceId) => { if (workspace.current_attempt.workflow_instance_id !== null) setSelectedTask({ workflowInstanceId: workspace.current_attempt.workflow_instance_id, taskInstanceId }); }} onStop={() => { if (workspace.current_attempt.workflow_instance_id !== null) stopWorkflow(workspace.current_attempt.workflow_instance_id); }} onToggle={() => toggleWorkspace(workspace.workspace_id)}>
          <WorkspaceAttemptsPanel attemptPage={attemptsByWorkspace[workspace.workspace_id]} error={attemptErrors[workspace.workspace_id]} loading={loadingWorkspaceIds.has(workspace.workspace_id)} now={now} stoppingWorkflowId={stoppingWorkflowId} onDetails={setDetailsAttemptId} onLoadMore={() => loadAttempts(workspace.workspace_id, (attemptsByWorkspace[workspace.workspace_id]?.page ?? 0) + 1)} onRetry={() => loadAttempts(workspace.workspace_id)} onStop={stopWorkflow} />
        </WorkspaceRow>;
      })}
      {loading ? <WorkflowTableState columns={columns}><Loader2 className="animate-spin" />正在读取工作空间...</WorkflowTableState> : null}
      {!loading && !result?.items.length ? <WorkflowTableState columns={columns}><Activity />当前筛选下暂无工作空间</WorkflowTableState> : null}
    </TableBody></Table></CardContent></Card>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">共 {result?.total ?? 0} 个工作空间</p><AppPagination page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={changePageSize} /></div>
    <WorkflowDetailsModal attemptId={detailsAttemptId} now={now} open={detailsAttemptId !== null} onOpenChange={(open) => { if (!open) setDetailsAttemptId(null); }} />
    <TaskLogModal open={selectedTask !== null} workflowInstanceId={selectedTask?.workflowInstanceId ?? null} taskInstanceId={selectedTask?.taskInstanceId ?? null} onOpenChange={(open) => { if (!open) setSelectedTask(null); }} />
  </div>;
}

function Filter({ children, label }: { children: React.ReactNode; label: string }) { return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>; }

function WorkspaceRow({ canOpenProject, children, columns, expanded, now, onDetails, onLogs, onStop, onToggle, showUsername, stopping, workspace }: { canOpenProject: boolean; children: React.ReactNode; columns: number; expanded: boolean; now: number; onDetails: () => void; onLogs: (taskInstanceId: number) => void; onStop: () => void; onToggle: () => void; showUsername: boolean; stopping: boolean; workspace: WorkflowWorkspaceListItem }) {
  const attempt = workspace.current_attempt;
  const active = workflowIsRunning(attempt);
  const duration = resolveDurationSeconds(attempt.duration_seconds, attempt.started_at, attempt.finished_at, active, now);
  const reducedMotion = useReducedMotion();
  const gridTemplateColumns = showUsername ? "28% 7rem 14rem minmax(0,1fr) 5rem 10rem 6rem" : "28% 14rem minmax(0,1fr) 5rem 10rem 6rem";
  return <TableRow aria-expanded={expanded} className={cn(expanded && "bg-muted/25")}><TableCell className="whitespace-normal p-0" colSpan={columns}>
    <div className="grid items-center" style={{ gridTemplateColumns }}>
      <div className="min-w-0 px-4 py-3"><div className="flex min-w-0 items-start gap-2"><Button aria-label={expanded ? "收起历史运行" : "展开历史运行"} aria-expanded={expanded} className="mt-0.5 size-7 shrink-0" size="icon-sm" variant="ghost" onClick={onToggle}>{expanded ? <ChevronDown /> : <ChevronRight />}</Button><div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><WorkflowApplicationBadge application={workspace.application} linkToProject={canOpenProject} projectId={workspace.project_id} /><span className="min-w-0 truncate text-sm font-medium" title={workspace.project_title ?? undefined}>{workspace.project_title ?? "工作流任务"}</span></div><div className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">工作空间 #{workspace.workspace_id}{attempt.workflow_definition_code === null ? "" : ` · Definition #${attempt.workflow_definition_code}`}</div></div></div></div>
      {showUsername ? <div className="min-w-0 truncate px-2 py-3 text-sm font-medium" title={workspace.owner_username}>{workspace.owner_username}</div> : null}
      <div className="min-w-0 px-2 py-3"><SchedulerState state={attempt.state} /><div className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">Attempt #{attempt.attempt_id}</div></div>
      <div className="min-w-0 px-2 py-3"><WorkflowTaskCapsules tasks={attempt.tasks} error={attempt.tasks_error} onLogs={onLogs} /></div>
      <div className="px-2 py-3 text-center font-mono text-xs tabular-nums">{workspace.attempt_count} 次</div>
      <div className="px-2 py-3"><WorkflowStartTime value={attempt.started_at ?? attempt.created_at} /><span className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs"><Clock3 className="size-3 text-muted-foreground" />{formatDuration(duration)}</span></div>
      <div className="px-4 py-3"><div className="flex justify-end gap-1">{active && attempt.workflow_instance_id !== null ? <Button title={stopping ? "正在终止工作流" : "终止工作流"} aria-label={stopping ? "正在终止工作流" : "终止工作流"} size="icon-sm" variant="destructive" disabled={stopping} onClick={onStop}>{stopping ? <Loader2 className="animate-spin" /> : <Square />}</Button> : null}<Button title="查看本次运行详情" aria-label="查看本次运行详情" size="icon-sm" variant="ghost" onClick={onDetails}><Eye /></Button></div></div>
    </div>
    <motion.div animate={{ gridTemplateRows: expanded ? "1fr" : "0fr", opacity: expanded ? 1 : 0 }} aria-hidden={!expanded} className="grid overflow-hidden" inert={!expanded} initial={false} transition={reducedMotion ? { duration: 0 } : { type: "tween", duration: 0.2, ease: [0.4, 0, 0.2, 1] }}><div className="min-h-0 overflow-hidden">{children}</div></motion.div>
  </TableCell></TableRow>;
}

function WorkspaceAttemptsPanel({ attemptPage, error, loading, now, onDetails, onLoadMore, onRetry, onStop, stoppingWorkflowId }: { attemptPage?: WorkflowAttemptListPage; error?: string; loading: boolean; now: number; onDetails: (attemptId: number) => void; onLoadMore: () => void; onRetry: () => void; onStop: (workflowInstanceId: number) => void; stoppingWorkflowId: number | null }) {
  const attempts = attemptPage?.items;
  const hasMore = attemptPage !== undefined && attemptPage.items.length < attemptPage.total;
  return <div className="bg-muted/10 px-4 py-4 sm:px-6">
    {loading && !attempts ? <div className="flex min-h-24 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />正在读取...</div> : null}
    {error ? <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"><span className="min-w-0 break-words">{error}</span><Button size="sm" variant="outline" onClick={onRetry}>重试</Button></div> : null}
    {attempts?.length ? <div className="divide-y overflow-x-auto rounded-md bg-background">{attempts.map((attempt) => <AttemptHistoryItem attempt={attempt} key={attempt.attempt_id} now={now} stopping={attempt.workflow_instance_id === stoppingWorkflowId} onDetails={() => onDetails(attempt.attempt_id)} onStop={() => { if (attempt.workflow_instance_id !== null) onStop(attempt.workflow_instance_id); }} />)}</div> : null}
    {hasMore ? <div className="mt-3 flex justify-center"><Button disabled={loading} size="sm" variant="outline" onClick={onLoadMore}>{loading ? <Loader2 className="animate-spin" /> : null}加载更多</Button></div> : null}
    {!loading && !error && attempts && !attempts.length ? <div className="grid min-h-20 place-items-center text-xs text-muted-foreground">暂无历史运行</div> : null}
  </div>;
}

function AttemptHistoryItem({ attempt, now, onDetails, onStop, stopping }: { attempt: WorkflowAttemptSummary; now: number; onDetails: () => void; onStop: () => void; stopping: boolean }) {
  const active = workflowIsRunning(attempt);
  const duration = resolveDurationSeconds(attempt.duration_seconds, attempt.started_at, attempt.finished_at, active, now);
  return <div className="grid min-w-[1060px] grid-cols-[6rem_11rem_18rem_minmax(29rem,1fr)_auto] items-center gap-3 px-4 py-2.5">
    <div className="font-mono text-xs tabular-nums"><span className="mr-1 text-muted-foreground">运行</span>第 {attempt.attempt_number} 次</div>
    <div className="flex items-center gap-2"><span className="text-[10px] text-muted-foreground">状态</span><SchedulerState state={attempt.state} />{attempt.is_current ? <Badge variant="secondary">当前</Badge> : null}</div>
    <div className="truncate font-mono text-[10px] text-muted-foreground">Attempt #{attempt.attempt_id} · {attempt.workflow_instance_id === null ? "Workflow —" : `Workflow #${attempt.workflow_instance_id}`}</div>
    <div className="flex items-center justify-end gap-3 whitespace-nowrap font-mono text-[11px]"><span><span className="mr-1 text-muted-foreground">开始</span>{formatDateTime(attempt.started_at ?? attempt.created_at)}</span><span><span className="mr-1 text-muted-foreground">更新</span>{formatDateTime(attempt.updated_at)}</span><span className="inline-flex items-center gap-1"><Clock3 className="size-3 text-muted-foreground" /><span className="text-muted-foreground">耗时</span>{formatDuration(duration)}</span></div>
    <div className="flex shrink-0 justify-end gap-1">{active && attempt.workflow_instance_id !== null ? <Button title="终止工作流" aria-label="终止工作流" size="icon-sm" variant="destructive" disabled={stopping} onClick={onStop}>{stopping ? <Loader2 className="animate-spin" /> : <Square />}</Button> : null}<Button title="查看本次运行详情" aria-label="查看本次运行详情" size="icon-sm" variant="ghost" onClick={onDetails}><Eye /></Button></div>
  </div>;
}

function workflowIsRunning(attempt: WorkflowAttemptSummary) {
  return attempt.finished_at === null && attempt.state !== "AUTO_SAVE_PENDING" && !terminalStates.has(attempt.state);
}

function WorkflowTaskCapsules({ error, onLogs, tasks }: { error?: string | null; onLogs: (taskInstanceId: number) => void; tasks: WorkflowTaskSummary[] }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    const measure = () => {
      const capsules = Array.from(content.children) as HTMLElement[];
      const rowTops = [...new Set(capsules.map((capsule) => capsule.offsetTop))].sort((a, b) => a - b);
      if (rowTops.length <= 2) { setCollapsedHeight(null); setExpanded(false); return; }
      const secondRowTop = rowTops[1];
      setCollapsedHeight(Math.max(...capsules.filter((capsule) => capsule.offsetTop === secondRowTop).map((capsule) => capsule.offsetTop + capsule.offsetHeight)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [tasks]);
  if (error) return <span className="text-xs text-destructive" title={error}>Task 查询失败</span>;
  if (!tasks.length) return <span className="text-xs text-muted-foreground">暂无任务</span>;
  const collapsible = collapsedHeight !== null;
  return <div className="min-w-0"><motion.div animate={{ height: !collapsible || expanded ? "auto" : collapsedHeight }} className="overflow-hidden" initial={false} transition={reducedMotion ? { duration: 0 } : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }}><div ref={contentRef} className="flex flex-wrap gap-1.5 whitespace-normal">{tasks.map((task, index) => <TaskStateBadge className="max-w-full" key={task.task_code ?? task.task_instance_id ?? `${task.name}-${index}`} label={<><span className="truncate">{task.name}</span><span className="opacity-70">{schedulerStateLabel(task.state)}</span>{task.task_instance_id !== null && task.state !== "SUBMITTED_SUCCESS" ? <button aria-label={`查看 ${task.name} 日志`} className="-mr-1 ml-0.5 grid size-5 shrink-0 place-items-center rounded-full opacity-70 transition hover:bg-background/60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="查看日志" type="button" onClick={() => onLogs(task.task_instance_id!)}><Terminal className="size-3" /></button> : null}</>} state={task.state} title={`${task.name} · ${task.task_instance_id === null ? "未调度" : `Task #${task.task_instance_id}`} · ${task.state}`} />)}</div></motion.div>{collapsible ? <Button aria-expanded={expanded} className="mt-1 h-6 gap-1 px-1.5 text-[11px] text-muted-foreground" size="sm" variant="ghost" onClick={() => setExpanded((value) => !value)}><ChevronDown className={cn("size-3 transition-transform duration-200", expanded && "rotate-180")} />{expanded ? "收起" : "展开"}</Button> : null}</div>;
}

function WorkflowTableState({ children, columns }: { children: React.ReactNode; columns: number }) { return <TableRow><TableCell colSpan={columns}><div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">{children}</div></TableCell></TableRow>; }
function WorkflowStartTime({ value }: { value: string }) { return <div className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{formatDateTime(value)}</div>; }
