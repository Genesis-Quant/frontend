import { Database, Loader2, Play } from "lucide-react";

import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/ui/dialog";
import type { AdminIncrementalWorker } from "@/types/admin";

type IncrementalWorkerDialogProps = {
  error: string;
  open: boolean;
  selected: string[];
  submitting: boolean;
  workers: AdminIncrementalWorker[];
  onOpenChange: (open: boolean) => void;
  onSelectedChange: (workers: string[]) => void;
  onSubmit: () => void;
};

export default function IncrementalWorkerDialog({ error, open, selected, submitting, workers, onOpenChange, onSelectedChange, onSubmit }: IncrementalWorkerDialogProps) {
  const selectedNames = new Set(selected);
  const allSelected = workers.length > 0 && selected.length === workers.length;

  function toggle(name: string, checked: boolean) {
    onSelectedChange(
      checked
        ? workers.filter((worker) => selectedNames.has(worker.name) || worker.name === name).map((worker) => worker.name)
        : selected.filter((worker) => worker !== name)
    );
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!submitting) onOpenChange(nextOpen); }}>
    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader className="border-b px-5 py-4 pr-12">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-muted/45"><Database className="size-4" /></span>
          <div>
            <DialogTitle className="text-base">运行增量更新</DialogTitle>
            <DialogDescription className="mt-1">选择本次需要运行的 Worker，未选节点会直接跳过。</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="flex items-center justify-between gap-3 border-b bg-muted/15 px-5 py-3">
        <span className="text-xs text-muted-foreground">已选择 {selected.length} / {workers.length}</span>
        <Button size="xs" variant="ghost" disabled={!workers.length || submitting} onClick={() => onSelectedChange(allSelected ? [] : workers.map((worker) => worker.name))}>{allSelected ? "清空" : "全选"}</Button>
      </div>

      <div className="grid max-h-[52vh] gap-2 overflow-y-auto p-5 sm:grid-cols-2">
        {workers.map((worker) => {
          const checked = selectedNames.has(worker.name);
          return <label key={worker.name} className="flex cursor-pointer items-start gap-3 rounded-md border bg-input/20 p-3 transition-colors hover:bg-input/35 has-data-[state=checked]:border-primary/70 has-data-[state=checked]:bg-primary/5">
            <Checkbox className="mt-0.5" checked={checked} disabled={submitting} onCheckedChange={(value) => toggle(worker.name, value === true)} />
            <span className="min-w-0">
              <span className="block font-mono text-xs font-medium text-foreground">{worker.name}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{worker.description}</span>
            </span>
          </label>;
        })}
        {!workers.length ? <p className="col-span-full py-8 text-center text-sm text-muted-foreground">没有可用的增量 Worker</p> : null}
      </div>

      {error ? <p className="border-t bg-destructive/5 px-5 py-3 text-sm text-destructive">{error}</p> : null}

      <DialogFooter className="border-t px-5 py-3">
        <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>取消</Button>
        <Button disabled={submitting || selected.length === 0} onClick={onSubmit}>{submitting ? <Loader2 className="animate-spin" /> : <Play />}运行 {selected.length} 个 Worker</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
