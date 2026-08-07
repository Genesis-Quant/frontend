import { Braces, Terminal } from "lucide-react";

import SchedulerStateBadge from "@/components/badge/SchedulerStateBadge";
import WorkflowRunButton from "@/components/button/WorkflowRunButton";
import DslEditor from "@/components/editor/DslEditor";
import QueryField from "@/components/field/QueryField";
import StockCodesField from "@/components/field/StockCodesField";
import { Button } from "@/ui/button";
import type { FactorQuery } from "@/types/factor";
import { applyQueryDsl, queryDsl, type QueryCatalog, type QueryProject } from "@/types/query";

type QueryControlsPanelProps = {
  activeWorkflow: boolean;
  catalog: QueryCatalog;
  dslValid: boolean;
  parameters: FactorQuery;
  project: QueryProject;
  projectId: number;
  stopping: boolean;
  submitting: boolean;
  workflowInstanceId: number | null;
  workflowState: string;
  onLogs: () => void;
  onParameters: (parameters: FactorQuery) => void;
  onRun: () => void;
  onShowParameters: () => void;
  onStop: () => void;
  onValidity: (valid: boolean) => void;
};

export default function QueryControlsPanel({ activeWorkflow, catalog, dslValid, parameters, project, projectId, stopping, submitting, workflowInstanceId, workflowState, onLogs, onParameters, onRun, onShowParameters, onStop, onValidity }: QueryControlsPanelProps) {
  return <section className="h-full min-h-0 min-w-0"><div className="h-full overflow-y-auto">
    <div className="flex items-start justify-between gap-3 border-b px-5 py-5"><div className="min-w-0"><h1 className="truncate text-lg font-semibold">{project.title}</h1><p className="mt-1 text-xs text-muted-foreground">Workflow ID：{workflowInstanceId ?? "—"}</p></div><SchedulerStateBadge state={workflowState} /></div>
    <div className="space-y-5 p-5">
      <div className="grid grid-cols-2 gap-3"><QueryField label="开始日期" type="date" value={parameters.start_date} onChange={(startDate) => onParameters({ ...parameters, start_date: startDate })} /><QueryField label="结束日期" type="date" value={parameters.end_date} onChange={(endDate) => onParameters({ ...parameters, end_date: endDate })} /></div>
      <div className="grid grid-cols-2 gap-3"><QueryField label="回溯周期" value={parameters.lookback} onChange={(lookback) => onParameters({ ...parameters, lookback })} /><StockCodesField codes={parameters.codes} onChange={(codes) => onParameters({ ...parameters, codes })} /></div>
      <div className="h-[430px]"><DslEditor catalog={catalog} modelPath={`factor-dsl://query/${projectId}/dataset.json`} value={queryDsl(parameters)} onChange={(dsl) => onParameters(applyQueryDsl(parameters, dsl))} onValidityChange={onValidity} /></div>
      <WorkflowRunButton active={activeWorkflow} className="w-full" disabled={!dslValid} label="执行查询" stopping={stopping} submitting={submitting} onRun={onRun} onStop={onStop} />
      <div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={onShowParameters}><Braces />展示参数</Button><Button variant="outline" disabled={!workflowInstanceId} onClick={onLogs}><Terminal />Task 日志</Button></div>
    </div>
  </div></section>;
}
