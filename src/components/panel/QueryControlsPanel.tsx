import { Braces } from "lucide-react";

import SchedulerState from "@/components/status/SchedulerState";
import AnalysisMoreActions from "@/components/button/AnalysisMoreActions";
import WorkflowExecutionButton from "@/components/button/WorkflowExecutionButton";
import DslEditor from "@/components/editor/DslEditor";
import QueryField from "@/components/field/QueryField";
import StockCodesField from "@/components/field/StockCodesField";
import ErrorPanel from "@/components/panel/ErrorPanel";
import type { FactorQuery } from "@/types/factor";
import { applyQueryDsl, queryDsl, type QueryCatalog, type QueryProject } from "@/types/query";
import { Button } from "@/ui/button";

type QueryControlsPanelProps = {
  activeWorkflow: boolean;
  catalog: QueryCatalog;
  dslValid: boolean;
  parameterError: string | null;
  parameters: FactorQuery | null;
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

export default function QueryControlsPanel({ activeWorkflow, catalog, dslValid, parameterError, parameters, project, projectId, stopping, submitting, workflowInstanceId, workflowState, onLogs, onParameters, onRun, onShowParameters, onStop, onValidity }: QueryControlsPanelProps) {
  return <section className="h-full min-h-0 min-w-0"><div className="h-full overflow-y-auto">
    <div className="flex items-start justify-between gap-3 border-b px-5 py-5"><div className="min-w-0"><h1 className="truncate text-lg font-semibold">{project.title}</h1><p className="mt-1 text-xs text-muted-foreground">Workflow ID：{workflowInstanceId ?? "—"}</p></div><SchedulerState state={workflowState} /></div>
    <div className="space-y-5 p-5">
      {parameters
        ? <>
        <div className="grid grid-cols-2 gap-3"><QueryField label="开始日期" type="date" value={parameters.start_date} onChange={(startDate) => onParameters({ ...parameters, start_date: startDate })} /><QueryField label="结束日期" type="date" value={parameters.end_date} onChange={(endDate) => onParameters({ ...parameters, end_date: endDate })} /></div>
        <div className="grid grid-cols-2 gap-3"><QueryField label="回溯周期" value={parameters.lookback} onChange={(lookback) => onParameters({ ...parameters, lookback })} /><StockCodesField codes={parameters.codes} onChange={(codes) => onParameters({ ...parameters, codes })} /></div>
        <div className="h-[430px]"><DslEditor catalog={catalog} compileEndpoint="/query/dsl/compile" modelPath={`factor-dsl://query/${projectId}/dataset.json`} source={parameters.dsl_source} value={queryDsl(parameters)} onChange={(dsl, source) => onParameters(applyQueryDsl(parameters, dsl, source))} onValidityChange={onValidity} /></div>
        </>
        : <div className="space-y-3"><ErrorPanel message={parameterError ?? "该记录的参数不可再次执行。"} /><Button className="w-full" variant="outline" onClick={onShowParameters}><Braces />查看并修复 JSON</Button></div>}
      <div className="flex gap-3"><WorkflowExecutionButton active={activeWorkflow} className="min-w-0 flex-1" disabled={!parameters || !dslValid} label="执行查询" stopping={stopping} submitting={submitting} onRun={onRun} onStop={onStop} /><AnalysisMoreActions onLogs={onLogs} onShowParameters={onShowParameters} workflowInstanceId={workflowInstanceId} /></div>
    </div>
  </div></section>;
}
