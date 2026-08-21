import { History, Loader2, Trash2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import SchedulerState from "@/components/status/SchedulerState";
import { Button } from "@/ui/button";

type AnalysisHistoryPanelProps = {
  children?: ReactNode;
  count: number;
  emptyMessage: string;
  footer?: ReactNode;
  loading?: boolean;
  title: string;
};

type AnalysisHistoryItemProps = {
  deleteDisabled?: boolean;
  deleteLabel: string;
  description: string;
  icon?: LucideIcon;
  loading?: boolean;
  onDelete: () => void;
  onOpen: () => void;
  state: string;
  title: string;
};

export function AnalysisHistoryPanel({ children, count, emptyMessage, footer, loading = false, title }: AnalysisHistoryPanelProps) {
  return <aside className="flex min-h-0 flex-col overflow-hidden rounded-md border bg-card">
    <div className="flex shrink-0 items-center gap-2 border-b px-3.5 py-3">
      <History className="size-4 text-primary" />
      <span className="text-sm font-medium">{title}</span>
      <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{count}</span>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      {loading
        ? <div className="grid min-h-28 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
        : count > 0
          ? <div className="space-y-1.5">{children}</div>
          : <div className="grid min-h-28 place-items-center rounded-md border border-dashed px-4 text-center text-xs leading-5 text-muted-foreground">{emptyMessage}</div>}
    </div>
    {footer ? <div className="shrink-0 border-t p-2">{footer}</div> : null}
  </aside>;
}

export function AnalysisHistoryItem({ deleteDisabled = false, deleteLabel, description, icon: Icon, loading = false, onDelete, onOpen, state, title }: AnalysisHistoryItemProps) {
  return <div className="group flex items-center gap-1 rounded-md border bg-background p-1 transition-colors hover:bg-muted/40">
    <button className="min-w-0 flex-1 rounded-sm px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={loading} onClick={onOpen} type="button">
      <span className="flex min-w-0 items-center gap-2">
        {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-primary" /> : Icon ? <Icon className="size-4 shrink-0 text-primary" /> : null}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <SchedulerState state={state} />
      </span>
      <span className="mt-1 block truncate pl-6 text-xs text-muted-foreground">{description}</span>
    </button>
    <Button aria-label={deleteLabel} className="shrink-0 text-destructive opacity-70 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100" disabled={deleteDisabled} onClick={onDelete} size="icon-sm" variant="ghost"><Trash2 /></Button>
  </div>;
}
