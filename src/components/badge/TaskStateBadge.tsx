import type { ReactNode } from "react";
import { CheckCircle2, CircleDashed, CircleX, Clock3, Loader2, PauseCircle, type LucideIcon } from "lucide-react";

import { cn } from "@/assets/lib/utils";
import { StatusBadge } from "@/components/badge/StatusBadge";
import { schedulerStateLabel, schedulerStateTone } from "@/components/status/SchedulerState";

const runningStates = new Set(["RUNNING_EXECUTION", "DISPATCH", "RETRYING"]);
const queuedStates = new Set(["CREATED", "QUEUED", "SUBMITTING", "SUBMITTED", "AUTO_SAVE_PENDING", "RESULT_PENDING", "SUBMITTED_SUCCESS", "WAITING", "WAIT_TO_RUN", "SERIAL_WAIT", "DELAY_EXECUTION", "READY_BLOCK", "BLOCK"]);
const pausedStates = new Set(["READY_PAUSE", "PAUSE"]);
const stoppingStates = new Set(["READY_STOP", "NEED_FAULT_TOLERANCE"]);

export default function TaskStateBadge({ className, label, state, title }: { className?: string; label?: ReactNode; state: string; title?: string }) {
  const visual = taskStateVisual(state);
  const Icon = visual.icon;
  return <StatusBadge className={cn("gap-1.5 font-mono", className)} title={title} tone={schedulerStateTone(state)}>{Icon ? <Icon className={cn("size-3", visual.animate && "animate-spin")} /> : null}{label ?? schedulerStateLabel(state)}</StatusBadge>;
}

function taskStateVisual(state: string): { icon?: LucideIcon; animate?: boolean } {
  if (stoppingStates.has(state)) return { icon: Loader2, animate: true };
  if (runningStates.has(state)) return { icon: Loader2, animate: true };
  if (queuedStates.has(state)) return { icon: Clock3 };
  if (pausedStates.has(state)) return { icon: PauseCircle };
  if (schedulerStateTone(state) === "green") return { icon: CheckCircle2 };
  if (schedulerStateTone(state) === "red") return { icon: CircleX };
  if (state === "IDLE" || state === "LOADING") return {};
  return { icon: CircleDashed };
}
