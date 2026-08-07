import { ChevronLeft, ChevronRight, Ellipsis, GitCompare } from "lucide-react";

import SchedulerStateBadge from "@/components/badge/SchedulerStateBadge";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";

type VersionItem = { id: number; version: number; remark: string };

export default function VersionNavigator({ displayedState, displayedWorkflowInstanceId, hasDraft, onCompare, onVersion, selectedVersion, versions }: { displayedState: string; displayedWorkflowInstanceId: number | null; hasDraft: boolean; onCompare?: () => void; onVersion: (version: number | null) => void; selectedVersion: number | null; versions: VersionItem[] }) {
  const ordered = [...versions].sort((left, right) => left.version - right.version);
  const currentIndex = selectedVersion === null ? ordered.length : ordered.findIndex((version) => version.version === selectedVersion);
  const previous = ordered[currentIndex - 1]?.version;
  const next = currentIndex < ordered.length - 1 ? ordered[currentIndex + 1]?.version : selectedVersion !== null && hasDraft ? null : undefined;
  const current = ordered.find((version) => version.version === selectedVersion);
  const label = selectedVersion === null ? hasDraft ? "new" : "未运行" : `v${selectedVersion}`;

  return <div className="rounded-md border bg-muted/20 p-2">
    <div className="grid grid-cols-[34px_minmax(0,1fr)_34px] items-center gap-2">
      <Button aria-label="上一版本" className="size-8" disabled={previous === undefined} size="icon" variant="outline" onClick={() => previous !== undefined && onVersion(previous)}><ChevronLeft /></Button>
      <div className="flex min-w-0 items-center justify-center gap-2"><Badge variant={label === "new" ? "default" : "secondary"}>{label}</Badge><DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="版本操作" className="size-8" size="icon" variant="outline"><Ellipsis /></Button></DropdownMenuTrigger><DropdownMenuContent align="center"><DropdownMenuItem onSelect={() => onVersion(null)}>当前研究</DropdownMenuItem>{[...ordered].reverse().map((version) => <DropdownMenuItem key={version.id} onSelect={() => onVersion(version.version)}>v{version.version}{version.remark ? ` · ${version.remark}` : ""}</DropdownMenuItem>)}<DropdownMenuItem disabled={!onCompare} onSelect={onCompare}><GitCompare />版本对比</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
      <Button aria-label="下一版本" className="size-8" disabled={next === undefined} size="icon" variant="outline" onClick={() => next !== undefined && onVersion(next)}><ChevronRight /></Button>
    </div>
    {current?.remark ? <div className="mt-2 rounded-md border bg-background/60 px-3 py-2 text-sm leading-6 text-muted-foreground"><div className="mb-1 text-xs font-medium text-foreground">版本备注</div><div className="whitespace-pre-wrap break-words">{current.remark}</div></div> : null}
    {displayedWorkflowInstanceId && !current?.remark ? <div className="mt-2 flex items-center gap-2 rounded-md border bg-background/60 px-3 py-2 text-xs text-muted-foreground"><SchedulerStateBadge state={displayedState} /><span className="font-mono">Workflow {displayedWorkflowInstanceId}</span></div> : null}
  </div>;
}
