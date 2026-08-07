import type { ReactNode } from "react";
import { CheckCircle2, CircleDashed, CircleX, Clock3, Loader2, PauseCircle, type LucideIcon } from "lucide-react";

import { cn } from "@/assets/lib/utils";
import { StatusBadge } from "@/components/badge/StatusBadge";
import { terminalStates } from "@/types/workflow";

export default function SchedulerStateBadge({ className, label, state, title }: { className?: string; label?: ReactNode; state: string; title?: string }) {
  const visual = schedulerStateVisual(state);
  const Icon = visual.icon;
  return <StatusBadge className={cn("gap-1.5 font-mono", className)} title={title} tone={visual.tone}>{Icon ? <Icon className={cn("size-3", visual.animate && "animate-spin")} /> : null}{label ?? schedulerStateLabel(state)}</StatusBadge>;
}

const schedulerStateLabels: Record<string, string> = {
  RUNNING_EXECUTION: "RUNNING",
  SUBMITTED_SUCCESS: "WAITING",
  WAIT_TO_RUN: "WAITING",
  SERIAL_WAIT: "WAITING",
  DELAY_EXECUTION: "DELAYED",
  READY_BLOCK: "BLOCKED",
  READY_PAUSE: "PAUSING",
  READY_STOP: "STOPPING",
  NEED_FAULT_TOLERANCE: "RECOVERING",
  FORCED_SUCCESS: "FORCED",
  SUBMIT_FAILED: "FAILED"
};

export function schedulerStateLabel(state: string) { return schedulerStateLabels[state] ?? state; }

type SchedulerStateTone = "blue" | "green" | "amber" | "red" | "neutral";
type SchedulerStateVisual = { tone: SchedulerStateTone; icon?: LucideIcon; animate?: boolean };

const successStates = new Set(["SUCCESS", "FORCED_SUCCESS"]);
const runningStates = new Set(["RUNNING_EXECUTION", "DISPATCH"]);
const queuedStates = new Set([
  "CREATED",
  "SUBMITTING",
  "SUBMITTED",
  "SUBMITTED_SUCCESS",
  "WAITING",
  "WAIT_TO_RUN",
  "SERIAL_WAIT",
  "DELAY_EXECUTION",
  "READY_BLOCK",
  "BLOCK"
]);
const pausedStates = new Set(["READY_PAUSE", "PAUSE"]);
const stoppingStates = new Set(["READY_STOP", "NEED_FAULT_TOLERANCE"]);

function schedulerStateVisual(state: string): SchedulerStateVisual {
  if (successStates.has(state)) return { tone: "green", icon: CheckCircle2 };
  if (terminalStates.has(state)) return { tone: "red", icon: CircleX };
  if (runningStates.has(state)) return { tone: "blue", icon: Loader2, animate: true };
  if (queuedStates.has(state)) return { tone: "amber", icon: Clock3 };
  if (pausedStates.has(state)) return { tone: "neutral", icon: PauseCircle };
  if (stoppingStates.has(state)) return { tone: "red", icon: Loader2, animate: true };
  if (state === "IDLE" || state === "LOADING") return { tone: "neutral" };
  return { tone: "neutral", icon: CircleDashed };
}
