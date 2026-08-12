import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import IconActivity from "~icons/lucide/activity";
import IconClock3 from "~icons/lucide/clock-3";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconRefreshCw from "~icons/lucide/refresh-cw";
import IconServer from "~icons/lucide/server";
import IconTerminal from "~icons/lucide/terminal";

import { tasksApi } from "@/assets/lib/tasks";
import { appendTaskLog } from "@/assets/lib/taskLogs";
import { formatDuration, workflowsApi } from "@/assets/lib/workflows";
import { AppPagination } from "@/components/pagination/AppPagination";
import SchedulerState from "@/components/status/SchedulerState";
import TaskLogViewer from "@/components/log/TaskLogViewer";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/dialog";
import { terminalStates, type WorkflowTasks } from "@/types/workflow";

const FETCH_SIZE = 10_000;
const DEFAULT_PAGE_SIZE = 500;
const LOG_PAGE_SIZE_OPTIONS = [100, 500, 1000];

type TaskLogModalProps = {
  open: boolean;
  workflowInstanceId: number | null;
  taskInstanceId: number | null;
  onOpenChange: (open: boolean) => void;
};

export default function TaskLogModal({ onOpenChange, open, taskInstanceId, workflowInstanceId }: TaskLogModalProps) {
  const [workflow, setWorkflow] = useState<WorkflowTasks | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const nextLineRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef(`${workflowInstanceId}:${taskInstanceId}`);
  const refreshInFlightRef = useRef<string | null>(null);
  selectionRef.current = `${workflowInstanceId}:${taskInstanceId}`;
  const task = selectedWorkflowTask(workflow, taskInstanceId);
  const resolvedTaskInstanceId = task?.task_instance_id ?? taskInstanceId;
  const taskUnavailable = taskLogUnavailable(workflow, task?.host, resolvedTaskInstanceId);
  const creating = !taskUnavailable && taskLogCreating(task?.host, resolvedTaskInstanceId);
  const lines = useMemo(() => splitLogLines(message), [message]);
  const totalPages = Math.max(1, Math.ceil(lines.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleMessage = useMemo(() => lines.slice((safePage - 1) * pageSize, safePage * pageSize).join("\n"), [lines, pageSize, safePage]);

  const resetLog = useCallback(() => {
    setMessage("");
    setPage(1);
    nextLineRef.current = 0;
  }, []);

  const loadWorkflow = useCallback(async () => {
    if (!workflowInstanceId) return null;
    const selection = `${workflowInstanceId}:${taskInstanceId}`;
    const result = await workflowsApi.tasks(workflowInstanceId);
    if (selectionRef.current !== selection) return null;
    setWorkflow(result);
    return result;
  }, [taskInstanceId, workflowInstanceId]);

  const loadLogs = useCallback(async (currentWorkflow: WorkflowTasks, reset: boolean) => {
    if (!workflowInstanceId) return false;
    const currentTask = selectedWorkflowTask(currentWorkflow, taskInstanceId);
    const currentTaskInstanceId = currentTask?.task_instance_id;
    if (!currentTaskInstanceId || !currentTask.host) return false;
    const selection = `${workflowInstanceId}:${taskInstanceId}`;
    const terminal = terminalStates.has(currentWorkflow.state) || terminalStates.has(currentTask.state);
    if (reset && terminal) {
      const completeLog = await tasksApi.downloadLog(workflowInstanceId, currentTaskInstanceId);
      if (selectionRef.current !== selection) return false;
      setMessage(completeLog);
      nextLineRef.current = 0;
      return true;
    }
    let cursor = reset ? 0 : nextLineRef.current;
    let added = "";
    let hasMore = true;
    while (hasMore) {
      const result = await tasksApi.logs(workflowInstanceId, currentTaskInstanceId, cursor, FETCH_SIZE);
      if (selectionRef.current !== selection) return false;
      added = appendTaskLog(added, result.message);
      hasMore = result.has_more && result.next_line_num > cursor;
      cursor = result.next_line_num;
    }
    setMessage((current) => reset ? added : appendTaskLog(current, added));
    nextLineRef.current = cursor;
    return true;
  }, [taskInstanceId, workflowInstanceId]);

  const refresh = useCallback(async () => {
    if (!workflowInstanceId) return;
    const selection = `${workflowInstanceId}:${taskInstanceId}`;
    if (refreshInFlightRef.current === selection) return;
    refreshInFlightRef.current = selection;
    setError("");
    setLoading(true);
    try {
      const currentWorkflow = await loadWorkflow();
      if (currentWorkflow && !await loadLogs(currentWorkflow, true)) resetLog();
    } catch (reason) {
      if (selectionRef.current === selection) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      if (selectionRef.current === selection) setLoading(false);
      if (refreshInFlightRef.current === selection) refreshInFlightRef.current = null;
    }
  }, [loadLogs, loadWorkflow, resetLog, taskInstanceId, workflowInstanceId]);

  useEffect(() => { setWorkflow(null); }, [open, taskInstanceId, workflowInstanceId]);
  useEffect(() => {
    if (!open || !workflowInstanceId) return;
    resetLog();
    refresh();
  }, [open, refresh, resetLog, taskInstanceId, workflowInstanceId]);
  useEffect(() => {
    if (!open || !workflowInstanceId) return undefined;
    const timer = window.setInterval(async () => {
      const selection = `${workflowInstanceId}:${taskInstanceId}`;
      if (refreshInFlightRef.current === selection) return;
      refreshInFlightRef.current = selection;
      try {
        const result = await loadWorkflow();
        const state = result ? selectedWorkflowTask(result, taskInstanceId)?.state : undefined;
        const terminal = Boolean(result && (terminalStates.has(result.state) || state && terminalStates.has(state)));
        const logsLoaded = result ? await loadLogs(result, terminal) : false;
        if (terminal && logsLoaded) window.clearInterval(timer);
      } catch (reason) {
        if (selectionRef.current === selection) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      } finally {
        if (refreshInFlightRef.current === selection) refreshInFlightRef.current = null;
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [loadLogs, loadWorkflow, open, taskInstanceId, workflowInstanceId]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 0; }, [pageSize, safePage]);

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(960px,calc(100vw-2rem))]" showCloseButton>
    <DialogHeader className="flex-row items-start justify-between gap-5 border-b px-5 py-4 pr-12 text-left"><div className="min-w-0"><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-md border bg-muted/40"><IconTerminal width={15} height={15} /></span><div><DialogTitle className="text-base">Task 日志</DialogTitle><DialogDescription className="mt-0.5 font-mono text-[11px]">Workflow #{workflowInstanceId ?? "—"} / Task #{resolvedTaskInstanceId ?? "—"}</DialogDescription></div></div></div><Button disabled={loading || !workflowInstanceId} size="sm" variant="outline" onClick={refresh}>{loading ? <IconLoaderCircle className="animate-spin" /> : <IconRefreshCw />}刷新</Button></DialogHeader>
    <div className="grid grid-cols-2 border-b bg-muted/15 sm:grid-cols-4"><TaskMeta icon={<IconActivity width={13} height={13} />} label="状态" value={<SchedulerState state={task?.state ?? "LOADING"} />} /><TaskMeta icon={<IconTerminal width={13} height={13} />} label="Task" value={task?.name ?? "—"} /><TaskMeta icon={<IconServer width={13} height={13} />} label="Worker" value={task?.host ?? "—"} /><TaskMeta icon={<IconClock3 width={13} height={13} />} label="耗时" value={formatDuration(task?.duration_seconds)} /></div>
    <div className="flex min-h-0 flex-1 flex-col bg-muted/20 text-foreground"><div className="flex items-center justify-between border-b px-4 py-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground"><span>{task?.name ?? "TASK"} / {resolvedTaskInstanceId ?? "—"}</span><span>{lines.length.toLocaleString("zh-CN")} LINES</span></div><div className="min-h-0 flex-1 overflow-auto" ref={logRef}>{taskLogContent(loading, workflow, visibleMessage, (safePage - 1) * pageSize, error, creating, taskUnavailable)}</div>{error && <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">{error}</div>}<footer className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-t px-4 py-2"><div className="text-[10px] text-muted-foreground"><p>{taskLogFooter(creating, taskUnavailable)}</p><p className="mt-0.5">共 {lines.length.toLocaleString("zh-CN")} 行</p></div>{lines.length > 0 && <AppPagination page={safePage} pageSize={pageSize} pageSizeOptions={LOG_PAGE_SIZE_OPTIONS} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={(value) => { setPage(1); setPageSize(value); }} />}</footer></div>
  </DialogContent></Dialog>;
}

function TaskMeta({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) { return <div className="min-w-0 border-r border-t px-4 py-3 first:border-t-0 sm:border-t-0"><div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">{icon}{label}</div><div className="mt-1.5 truncate font-mono text-xs font-medium">{value}</div></div>; }
function emptyLogMessage(error: string, creating: boolean) { return error ? "" : creating ? "创建中" : "暂无日志"; }

function selectedWorkflowTask(workflow: WorkflowTasks | null, taskInstanceId: number | null) {
  if (!workflow) return undefined;
  if (taskInstanceId !== null) return workflow.tasks.find((item) => item.task_instance_id === taskInstanceId);
  return workflow.tasks.find((item) => item.task_instance_id !== null) ?? workflow.tasks[0];
}

function taskLogCreating(host: string | null | undefined, taskInstanceId: number | null) {
  return !taskInstanceId || !host;
}

function taskLogUnavailable(workflow: WorkflowTasks | null, host: string | null | undefined, taskInstanceId: number | null) {
  return Boolean(workflow && terminalStates.has(workflow.state) && taskLogCreating(host, taskInstanceId));
}

function taskLogContent(loading: boolean, workflow: WorkflowTasks | null, message: string, lineOffset: number, error: string, creating: boolean, unavailable: boolean) {
  if (loading && !workflow) return <div className="grid min-h-72 place-items-center"><IconLoaderCircle className="animate-spin text-muted-foreground" width={20} height={20} /></div>;
  const unavailableMessage = unavailable ? workflow?.error || "工作流已结束，未创建可读取日志的 Task" : "";
  return <TaskLogViewer message={message} lineOffset={lineOffset} emptyMessage={unavailableMessage || emptyLogMessage(error, creating)} />;
}

function taskLogFooter(creating: boolean, unavailable: boolean) {
  if (unavailable) return "工作流已结束，Task 未创建或未分配 Worker";
  return creating ? "等待 DolphinScheduler 创建并分配 Task" : "实时从 DolphinScheduler 读取";
}

function splitLogLines(message: string) {
  if (!message) return [];
  const lines = message.replace(/\r\n?/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}
