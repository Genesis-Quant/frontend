import { CircleX, Clock3, FileClock } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { resolveWorkflowResultPhase } from "@/assets/lib/workflows";
import EmptyStatePanel from "@/components/panel/EmptyStatePanel";
import ErrorPanel from "@/components/panel/ErrorPanel";
import FactorAnalysisReport from "@/components/panel/FactorAnalysisReport";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";
import type { FactorAnalysisParameters, FactorMetrics } from "@/types/factor";

type FactorAnalysisResultsPanelProps = { displayedParameters: FactorAnalysisParameters; displayedState: string; displayedWorkflowInstanceId: number | null; error: string; readOnly: boolean; running: boolean; workflowError: string | null; onMetrics: (metrics: FactorMetrics) => void };

export default function FactorAnalysisResultsPanel({ displayedParameters, displayedState, displayedWorkflowInstanceId, error, readOnly, running, workflowError, onMetrics }: FactorAnalysisResultsPanelProps) {
  const [factor, setFactor] = useState(displayedParameters.factor_columns[0] ?? "");
  useEffect(() => { if (!displayedParameters.factor_columns.includes(factor)) setFactor(displayedParameters.factor_columns[0] ?? ""); }, [displayedParameters.factor_columns, factor]);
  const phase = resolveWorkflowResultPhase(running, displayedWorkflowInstanceId, displayedState);
  let content: ReactNode;
  if (error && phase !== "success") content = <ErrorPanel message={error} size="xs" />;
  else if (phase === "running") content = <EmptyStatePanel description="中间过程由 Tasks API 轮询，页面刷新后仍可恢复。" icon={Clock3} iconClassName="animate-pulse text-primary" title="DolphinScheduler 正在执行分析" />;
  else if (phase === "failure") content = workflowError ? <ErrorPanel message={workflowError} size="xs" /> : <EmptyStatePanel description="任务已结束，但没有生成因子分析报告。" icon={CircleX} title="因子分析失败" />;
  else if (phase === "success" && factor && displayedWorkflowInstanceId) content = <FactorAnalysisReport factor={factor} key={displayedWorkflowInstanceId} parameters={displayedParameters} workflowInstanceId={displayedWorkflowInstanceId} onMetrics={onMetrics} />;
  else content = !readOnly ? <EmptyStatePanel description="填写左侧参数和 DSL 后执行分析。" icon={FileClock} title="尚未运行分析" /> : null;
  return <section className="min-w-0 space-y-5"><div className="sticky top-20 z-30"><Tabs value={factor} onValueChange={setFactor}><TabsList>{displayedParameters.factor_columns.map((column) => <TabsTrigger key={column} value={column}>{column}</TabsTrigger>)}</TabsList></Tabs></div>{error && phase === "success" ? <ErrorPanel message={error} size="xs" /> : null}{content}</section>;
}
