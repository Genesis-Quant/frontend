import { Braces, Code2, Pencil, Save, Terminal } from "lucide-react";

import VersionNavigator from "@/components/bar/VersionNavigator";
import WorkflowRunButton from "@/components/button/WorkflowRunButton";
import FactorAnalysisEditor from "@/components/editor/FactorAnalysisEditor";
import { Button } from "@/ui/button";
import type { DslCatalog, FactorAnalysisParameters, FactorMetrics, FactorProject, FactorVersionListItem } from "@/types/factor";

type FactorAnalysisControlsPanelProps = {
  activeWorkflow: boolean;
  catalog: DslCatalog;
  displayedParameters: FactorAnalysisParameters;
  displayedState: string;
  displayedWorkflowInstanceId: number | null;
  dslValid: boolean;
  metrics: FactorMetrics | null;
  project: FactorProject;
  projectId: number;
  readOnly: boolean;
  stopping: boolean;
  submitting: boolean;
  selectedVersion: number | null;
  workflowState: string;
  versions: FactorVersionListItem[];
  onAnalyze: () => void;
  onCompare: () => void;
  onContinue: () => void;
  onLogs: () => void;
  onParameters: (parameters: FactorAnalysisParameters) => void;
  onSave: () => void;
  onShowParameters: () => void;
  onStop: () => void;
  onValidity: (valid: boolean) => void;
  onVersion: (version: number | null) => void;
};

export default function FactorAnalysisControlsPanel({ activeWorkflow, catalog, displayedParameters, displayedState, displayedWorkflowInstanceId, dslValid, metrics, project, projectId, readOnly, selectedVersion, stopping, submitting, workflowState, versions, onAnalyze, onCompare, onContinue, onLogs, onParameters, onSave, onShowParameters, onStop, onValidity, onVersion }: FactorAnalysisControlsPanelProps) {
  return <section className="h-full min-h-0 min-w-0"><div className="h-full overflow-y-auto">
    <div className="space-y-4 px-5 pb-0 pt-5"><div className="flex items-center gap-3"><h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{project.title}</h1><Pencil className="size-4" /></div><p className="text-sm leading-6 text-muted-foreground">切换历史版本，或重新执行后保存为新版本。</p><VersionNavigator displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} hasDraft={Boolean(project.draft)} onCompare={selectedVersion !== null && versions.length > 1 ? onCompare : undefined} selectedVersion={selectedVersion} versions={versions} onVersion={onVersion} /></div>
    <div className="space-y-5 p-5"><FactorAnalysisEditor catalog={catalog} parameters={displayedParameters} projectId={projectId} readOnly={readOnly} onChange={onParameters} onValidityChange={onValidity} /><div className="grid grid-cols-2 gap-3">{readOnly ? <Button className="col-span-2" onClick={onContinue}><Code2 />基于此版本研究</Button> : <><WorkflowRunButton active={activeWorkflow} disabled={!dslValid} label="执行分析" stopping={stopping} submitting={submitting} onRun={onAnalyze} onStop={onStop} /><Button variant="outline" disabled={!metrics || workflowState !== "SUCCESS"} onClick={onSave}><Save />保存</Button></>}</div><div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={onShowParameters}><Braces />展示参数</Button><Button variant="outline" disabled={!displayedWorkflowInstanceId} onClick={onLogs}><Terminal />Task 日志</Button></div></div>
  </div></section>;
}
