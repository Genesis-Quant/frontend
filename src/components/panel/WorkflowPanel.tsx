import { Activity, ChevronDown, Clock3, Eye, Loader2, RefreshCw, Square, Terminal } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { formatDateTime } from "@/assets/lib/dateTime";
import { cn } from "@/assets/lib/utils";
import { formatDuration, resolveDurationSeconds, workflowsApi } from "@/assets/lib/workflows";
import WorkflowApplicationBadge from "@/components/badge/WorkflowApplicationBadge";
import { AppPagination } from "@/components/pagination/AppPagination";
import SchedulerStateBadge, { schedulerStateLabel } from "@/components/badge/SchedulerStateBadge";
import TaskLogModal from "@/components/modal/TaskLogModal";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import WorkflowDetailsModal from "@/components/modal/WorkflowDetailsModal";
import { useAppStore } from "@/store";
import { terminalStates, type WorkflowApplication, type WorkflowListItem, type WorkflowListPage } from "@/types/workflow";

type StateFilter = "all" | "active" | "success" | "failure";
type SelectedTask = { workflowInstanceId: number; taskInstanceId: number };

export default function WorkflowPanel({ onTotalChange, showUsername = false }: { onTotalChange?: (total: number) => void; showUsername?: boolean }) {
  const userId = useAppStore((store) => store.user?.id);
  const [result, setResult] = useState<WorkflowListPage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [application, setApplication] = useState<"all" | WorkflowApplication>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stoppingWorkflowId, setStoppingWorkflowId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [detailsWorkflow, setDetailsWorkflow] = useState<WorkflowListItem | null>(null);
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);
  const [now, setNow] = useState(Date.now());
  const loadRequest = useRef(0);
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

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setDetailsWorkflow((current) => current ? result?.items.find((workflow) => workflow.workflow_instance_id === current.workflow_instance_id) ?? current : null);
  }, [result]);
  useEffect(() => {
    if (!stoppingWorkflowId) return;
    const workflow = result?.items.find((item) => item.workflow_instance_id === stoppingWorkflowId);
    if (!workflow || terminalStates.has(workflow.state)) setStoppingWorkflowId(null);
  }, [result, stoppingWorkflowId]);
  const containsActiveWorkflow = useMemo(() => result?.items.some((workflow) => !terminalStates.has(workflow.state)) ?? false, [result]);
  useEffect(() => {
    if (!containsActiveWorkflow) return undefined;
    const timer = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(timer);
  }, [containsActiveWorkflow, load]);
  useEffect(() => {
    if (!containsActiveWorkflow) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [containsActiveWorkflow]);

  function changeApplication(value: string) { setApplication(value as "all" | WorkflowApplication); setPage(1); }
  function changeState(value: string) { setState(value as StateFilter); setPage(1); }

  async function stopWorkflow(workflowInstanceId: number) {
    if (stoppingWorkflowId === workflowInstanceId) return;
    setStoppingWorkflowId(workflowInstanceId);
    setError("");
    try {
      await workflowsApi.stop(workflowInstanceId);
      await load(true);
    } catch (reason) {
      setStoppingWorkflowId(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  return <div className="space-y-4">
    {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div className="flex flex-wrap items-end gap-3"><Filter label="应用"><Select value={application} onValueChange={changeApplication}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部应用</SelectItem><SelectItem value="query">Query</SelectItem><SelectItem value="factor">Factor</SelectItem><SelectItem value="backtest">Backtest</SelectItem><SelectItem value="incremental">Incremental</SelectItem></SelectContent></Select></Filter><Filter label="状态"><Select value={state} onValueChange={changeState}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="active">运行中</SelectItem><SelectItem value="success">成功</SelectItem><SelectItem value="failure">失败</SelectItem></SelectContent></Select></Filter></div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">运行中的工作流每 5 秒自动更新</span><Button variant="outline" disabled={refreshing} onClick={() => load(true)}>{refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}刷新</Button></div></div>
    <Card className="gap-0 py-0 shadow-sm"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="w-36 px-4">Workflow ID</TableHead>{showUsername ? <TableHead className="w-32">用户名</TableHead> : null}<TableHead className="w-28">应用</TableHead><TableHead className="w-40">状态</TableHead><TableHead>工作流</TableHead><TableHead className="min-w-96">Tasks</TableHead><TableHead className="w-36">开始时间</TableHead><TableHead className="w-24 text-right">耗时</TableHead><TableHead className="w-24 px-4 text-right">操作</TableHead></TableRow></TableHeader><TableBody>
      {result?.items.map((workflow) => <WorkflowRow canOpenProject={workflow.user_id === userId} key={workflow.workflow_instance_id} now={now} showUsername={showUsername} stopping={stoppingWorkflowId === workflow.workflow_instance_id} workflow={workflow} onDetails={() => setDetailsWorkflow(workflow)} onLogs={(taskInstanceId) => setSelectedTask({ workflowInstanceId: workflow.workflow_instance_id, taskInstanceId })} onStop={() => stopWorkflow(workflow.workflow_instance_id)} />)}
      {loading ? <WorkflowTableState columns={showUsername ? 9 : 8}><Loader2 className="animate-spin" />正在读取工作流...</WorkflowTableState> : null}
      {!loading && !result?.items.length ? <WorkflowTableState columns={showUsername ? 9 : 8}><Activity />当前筛选下暂无工作流实例</WorkflowTableState> : null}
    </TableBody></Table></CardContent></Card>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">共 {result?.total ?? 0} 个工作流实例</p><AppPagination page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>
    <WorkflowDetailsModal now={now} open={detailsWorkflow !== null} workflow={detailsWorkflow} onOpenChange={(open) => { if (!open) setDetailsWorkflow(null); }} />
    <TaskLogModal open={selectedTask !== null} workflowInstanceId={selectedTask?.workflowInstanceId ?? null} taskInstanceId={selectedTask?.taskInstanceId ?? null} onOpenChange={(open) => { if (!open) setSelectedTask(null); }} />
  </div>;
}

function Filter({ children, label }: { children: React.ReactNode; label: string }) { return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>; }

function WorkflowRow({ canOpenProject, now, onDetails, onLogs, onStop, showUsername, stopping, workflow }: { canOpenProject: boolean; now: number; onDetails: () => void; onLogs: (taskInstanceId: number) => void; onStop: () => void; showUsername: boolean; stopping: boolean; workflow: WorkflowListItem }) {
  const active = !terminalStates.has(workflow.state);
  const duration = resolveDurationSeconds(workflow.duration_seconds, workflow.started_at, workflow.finished_at, active, now);
  return <TableRow><TableCell className="px-4 font-mono text-xs font-semibold">{workflow.workflow_instance_id}</TableCell>{showUsername ? <TableCell className="max-w-32 truncate text-sm font-medium" title={workflow.owner_username}>{workflow.owner_username}</TableCell> : null}<TableCell><WorkflowApplicationBadge application={workflow.application} linkToProject={canOpenProject} projectId={workflow.project_id} /></TableCell><TableCell><SchedulerStateBadge state={workflow.state} /></TableCell><TableCell><div className="max-w-72 truncate text-xs font-medium">{workflow.workflow_name}</div><div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">Definition #{workflow.workflow_definition_code} · Record #{workflow.record_id}</div></TableCell><TableCell><WorkflowTaskCapsules tasks={workflow.tasks} error={workflow.tasks_error} onLogs={onLogs} /></TableCell><TableCell><WorkflowStartTime value={workflow.started_at ?? workflow.created_at} /></TableCell><TableCell className="text-right"><span className="inline-flex items-center gap-1.5 font-mono text-xs"><Clock3 className="size-3 text-muted-foreground" />{formatDuration(duration)}</span></TableCell><TableCell className="px-4"><div className="flex justify-end gap-1">{active ? <Button title={stopping ? "正在终止工作流" : "终止工作流"} aria-label={stopping ? "正在终止工作流" : "终止工作流"} size="icon-sm" variant="destructive" disabled={stopping} onClick={onStop}>{stopping ? <Loader2 className="animate-spin" /> : <Square />}</Button> : null}<Button title="查看详情" aria-label="查看工作流详情" size="icon-sm" variant="ghost" onClick={onDetails}><Eye /></Button></div></TableCell></TableRow>;
}

function WorkflowTaskCapsules({ error, onLogs, tasks }: { error?: string | null; onLogs: (taskInstanceId: number) => void; tasks: WorkflowListItem["tasks"] }) {
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
  if (!tasks.length) return <span className="text-xs text-muted-foreground">暂无 Task</span>;
  const collapsible = collapsedHeight !== null;
  return <div className="max-w-[36rem]"><motion.div animate={{ height: !collapsible || expanded ? "auto" : collapsedHeight }} className="overflow-hidden" initial={false} transition={reducedMotion ? { duration: 0 } : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }}><div ref={contentRef} className="flex flex-wrap gap-1.5 whitespace-normal">{tasks.map((task, index) => <SchedulerStateBadge className="max-w-56" key={task.task_code ?? task.task_instance_id ?? `${task.name}-${index}`} label={<><span className="truncate">{task.name}</span><span className="opacity-70">{schedulerStateLabel(task.state)}</span>{task.task_instance_id !== null && task.state !== "SUBMITTED_SUCCESS" ? <button aria-label={`查看 ${task.name} 日志`} className="-mr-1 ml-0.5 grid size-5 shrink-0 place-items-center rounded-full opacity-70 transition hover:bg-background/60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="查看日志" type="button" onClick={() => onLogs(task.task_instance_id!)}><Terminal className="size-3" /></button> : null}</>} state={task.state} title={`${task.name} · ${task.task_instance_id === null ? "未调度" : `Task #${task.task_instance_id}`} · ${task.state}`} />)}</div></motion.div>{collapsible ? <Button aria-expanded={expanded} className="mt-1 h-6 gap-1 px-1.5 text-[11px] text-muted-foreground" size="sm" variant="ghost" onClick={() => setExpanded((value) => !value)}><ChevronDown className={cn("size-3 transition-transform duration-200", expanded && "rotate-180")} />{expanded ? "收起" : "展开"}</Button> : null}</div>;
}

function WorkflowTableState({ children, columns }: { children: React.ReactNode; columns: number }) { return <TableRow><TableCell colSpan={columns}><div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">{children}</div></TableCell></TableRow>; }
function WorkflowStartTime({ value }: { value: string }) { return <div className="whitespace-nowrap font-mono text-xs">{formatDateTime(value)}</div>; }
