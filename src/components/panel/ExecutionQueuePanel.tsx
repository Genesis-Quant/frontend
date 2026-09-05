import { CheckCircle2, CircleX, Clock3, Loader2, Pencil, Play, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { maxBatchRunItems } from "@/assets/lib/projectQueue";
import { errorMessage } from "@/assets/lib/utils";
import JsonEditor from "@/components/editor/JsonEditor";
import SchedulerState from "@/components/status/SchedulerState";
import type { ProjectQueueItem } from "@/types/queue";
import { terminalStates } from "@/types/workflow";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/ui/sheet";

type ExecutionQueuePanelProps<T> = {
  executing: boolean;
  items: ProjectQueueItem<T>[];
  loadError?: string | null;
  open: boolean;
  validate: (value: unknown) => value is T;
  onDelete: (item: ProjectQueueItem<T>) => void | Promise<void>;
  onExecute: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onUpdate: (item: ProjectQueueItem<T>, remark: string, parameters: T) => void | Promise<void>;
};

export default function ExecutionQueuePanel<T>({ executing, items, loadError, open, validate, onDelete, onExecute, onOpenChange, onUpdate }: ExecutionQueuePanelProps<T>) {
  const [editing, setEditing] = useState<ProjectQueueItem<T> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [remark, setRemark] = useState("");
  const [source, setSource] = useState("");
  const [editError, setEditError] = useState("");
  const stats = useMemo(() => queueStats(items), [items]);

  function openEditor(item: ProjectQueueItem<T>) {
    if (executing) return;
    setEditing(item);
    setRemark(item.remark);
    setSource(JSON.stringify(item.parameters, null, 2));
    setEditError("");
  }

  async function save() {
    if (!editing || executing || saving) return;
    setSaving(true);
    try {
      const parsed: unknown = JSON.parse(source);
      if (!validate(parsed)) throw new Error("参数结构不完整。");
      await onUpdate(editing, remark, parsed);
      setEditing(null);
    } catch (reason) {
      setEditError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ProjectQueueItem<T>) {
    if (executing || deletingId !== null) return;
    setDeletingId(item.id);
    try {
      await onDelete(item);
    } finally {
      setDeletingId(null);
    }
  }

  return <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(96vw,620px)] gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-5 py-4"><SheetTitle>执行队列</SheetTitle><SheetDescription>{items.length} 个任务</SheetDescription></SheetHeader>
        <div className="grid grid-cols-4 gap-2 border-b px-5 py-3 text-center text-xs">
          <QueueStat icon={<Clock3 />} label="待执行" value={stats.pending} />
          <QueueStat icon={<Loader2 className="animate-spin" />} label="运行中" value={stats.running} />
          <QueueStat icon={<CheckCircle2 />} label="已保存" value={stats.succeeded} />
          <QueueStat icon={<CircleX />} label="失败" value={stats.failed} />
        </div>
        {loadError ? <div className="mx-5 mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{loadError}</div> : null}
        {stats.pending > maxBatchRunItems ? <div className="mx-5 mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">一次最多执行 {maxBatchRunItems} 个待执行任务，请先删除多余任务。</div> : null}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {items.map((item, index) => {
            const pending = item.workspace_id === null;
            const active = !pending && item.version === null && !item.error && (!terminalStates.has(item.state) || item.state === "SUCCESS");
            return <div className="rounded-md border bg-card p-3 shadow-xs" key={item.id}>
              <div className="flex items-start gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-xs font-semibold tabular-nums">{index + 1}</div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">任务 #{item.workspace_id ?? index + 1}</span><QueueItemState item={item} pending={pending} /></div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</div>
                  {item.remark ? <div className="rounded-md bg-muted/40 px-2.5 py-2 text-xs leading-5 text-muted-foreground">{item.remark}</div> : null}
                  {item.error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs leading-5 text-destructive">{item.error}</div> : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button aria-label="编辑队列任务" disabled={executing || !pending || saving} size="icon-xs" variant="ghost" onClick={() => openEditor(item)}><Pencil /></Button>
                  <Button aria-label="删除队列任务" disabled={executing || active || deletingId !== null} size="icon-xs" variant="ghost" onClick={() => remove(item)}>{deletingId === item.id ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button>
                </div>
              </div>
            </div>;
          })}
          {!items.length ? <div className="rounded-md border border-dashed py-14 text-center text-sm text-muted-foreground">暂无队列任务</div> : null}
        </div>
        <SheetFooter className="border-t px-5 py-4"><Button disabled={executing || stats.pending === 0 || stats.pending > maxBatchRunItems} onClick={onExecute}>{executing ? <Loader2 className="animate-spin" /> : <Play />}批量执行{stats.pending ? `（${stats.pending}）` : ""}</Button></SheetFooter>
      </SheetContent>
    </Sheet>
    <Dialog open={editing !== null} onOpenChange={(nextOpen) => { if (!nextOpen && !saving) setEditing(null); }}>
      <DialogContent className="flex h-[82vh] max-h-[860px] flex-col overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-5 py-4 pr-12"><DialogTitle>编辑队列任务</DialogTitle></DialogHeader>
        <div className="space-y-3 px-5 pt-4"><div className="space-y-2"><Label htmlFor="queue-edit-remark">备注（可选）</Label><Input disabled={executing} id="queue-edit-remark" maxLength={512} value={remark} onChange={(event) => setRemark(event.target.value)} /></div></div>
        <div className="min-h-0 flex-1 p-5 pt-3"><JsonEditor ariaLabel="队列任务 JSON 参数" modelPath={`json://execution-queue/${editing?.id ?? "draft"}/parameters.json`} readOnly={executing} value={source} onChange={(value) => { setSource(value); setEditError(""); }} /></div>
        <DialogFooter className="border-t px-5 py-3"><span className="mr-auto text-xs text-destructive">{editError}</span><Button variant="outline" onClick={() => setEditing(null)}>取消</Button><Button disabled={executing || saving} onClick={save}>{saving ? <Loader2 className="animate-spin" /> : null}保存</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function QueueItemState<T>({ item, pending }: { item: ProjectQueueItem<T>; pending: boolean }) {
  if (item.version !== null) return <Badge>v{item.version}</Badge>;
  if (pending) return <Badge variant="secondary">待执行</Badge>;
  if (item.error) return <Badge variant="destructive">保存失败</Badge>;
  if (item.state === "SUCCESS") return <Badge variant="secondary"><Loader2 className="animate-spin" />生成版本</Badge>;
  return <SchedulerState state={item.state} />;
}

function QueueStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-md bg-muted/35 px-2 py-2"><div className="flex items-center justify-center gap-1.5 text-base font-semibold tabular-nums [&_svg]:size-3.5">{icon}{value}</div><div className="mt-0.5 text-muted-foreground">{label}</div></div>;
}

function queueStats<T>(items: ProjectQueueItem<T>[]) {
  return items.reduce((result, item) => {
    if (item.workspace_id === null) result.pending += 1;
    else if (item.version !== null) result.succeeded += 1;
    else if (item.error || terminalStates.has(item.state) && item.state !== "SUCCESS") result.failed += 1;
    else result.running += 1;
    return result;
  }, { pending: 0, running: 0, succeeded: 0, failed: 0 });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}
