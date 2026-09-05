import { Braces, Code2, Pencil, Save } from "lucide-react";

import VersionNavigator from "@/components/bar/VersionNavigator";
import AnalysisMoreActions from "@/components/button/AnalysisMoreActions";
import WorkflowExecutionButton from "@/components/button/WorkflowExecutionButton";
import FactorAnalysisEditor from "@/components/editor/FactorAnalysisEditor";
import ErrorPanel from "@/components/panel/ErrorPanel";
import { Button } from "@/ui/button";
import type { DslCatalog, DslCompilation, FactorAnalysisParameters, FactorProject, FactorVersionListItem } from "@/types/factor";

type FactorAnalysisControlsPanelProps = {
  activeWorkflow: boolean;
  catalog: DslCatalog;
  displayedParameters: FactorAnalysisParameters | null;
  displayedState: string;
  displayedWorkflowInstanceId: number | null;
  dslValid: boolean;
  project: FactorProject;
  projectId: number;
  parameterError: string | null;
  queueCount: number;
  readOnly: boolean;
  stopping: boolean;
  submitting: boolean;
  selectedVersion: number | null;
  workflowState: string;
  versions: FactorVersionListItem[];
  onAnalyze: () => void;
  onCandidateReport: () => void;
  onCompare: () => void;
  onContinue: () => void;
  onDeleteVersion: () => void;
  onLogs: () => void;
  onOpenQueue: () => void;
  onParameters: (parameters: FactorAnalysisParameters) => void;
  onQueue: () => void;
  onSave: () => void;
  onRenameProject: () => void;
  onRenameVersion: () => void;
  onShowParameters: () => void;
  onStop: () => void;
  onValidity: (valid: boolean, compilation?: DslCompilation) => void;
  onVersion: (version: number | null) => void;
};

export default function FactorAnalysisControlsPanel({ activeWorkflow, catalog, displayedParameters, displayedState, displayedWorkflowInstanceId, dslValid, parameterError, project, projectId, queueCount, readOnly, selectedVersion, stopping, submitting, workflowState, versions, onAnalyze, onCandidateReport, onCompare, onContinue, onDeleteVersion, onLogs, onOpenQueue, onParameters, onQueue, onRenameProject, onRenameVersion, onSave, onShowParameters, onStop, onValidity, onVersion }: FactorAnalysisControlsPanelProps) {
  const savedVersionCount = versions.filter((version) => version.saved).length;
  return <section className="h-full min-h-0 min-w-0"><div className="h-full overflow-y-auto">
    <div className="space-y-4 px-5 pb-0 pt-5"><div className="flex items-center gap-3"><h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{project.title}</h1><Button aria-label="重命名项目" size="icon-sm" variant="ghost" onClick={onRenameProject}><Pencil /></Button></div><p className="text-sm leading-6 text-muted-foreground">切换历史版本，或重新执行后保存为新版本。</p><VersionNavigator displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} onCompare={versions.length > 1 ? onCompare : undefined} onDeleteVersion={onDeleteVersion} onRenameVersion={onRenameVersion} selectedVersion={selectedVersion} versions={versions} onVersion={onVersion} /></div>
    <div className="space-y-5 p-5">
      {displayedParameters
        ? <FactorAnalysisEditor catalog={catalog} editorScope={readOnly ? `version-${selectedVersion}` : `draft-${project.draft.id}`} parameters={displayedParameters} projectId={projectId} readOnly={readOnly} onChange={onParameters} onValidityChange={onValidity} />
        : <div className="space-y-3"><ErrorPanel message={parameterError ?? "该记录的参数不可再次执行。"} /><Button className="w-full" variant="outline" onClick={onShowParameters}><Braces />{readOnly ? "查看原始 JSON" : "查看并修复 JSON"}</Button></div>}
      <div className="flex gap-3">{readOnly ? <Button className="min-w-0 flex-1" disabled={!displayedParameters} onClick={onContinue}><Code2 />基于此版本研究</Button> : <><WorkflowExecutionButton className="min-w-0 flex-1" active={activeWorkflow} disabled={!displayedParameters || !dslValid} label="执行分析" stopping={stopping} submitting={submitting} onRun={onAnalyze} onStop={onStop} /><Button className="min-w-0 flex-1" variant="outline" disabled={workflowState !== "SUCCESS"} onClick={onSave}><Save />保存</Button></>}<AnalysisMoreActions candidateReportDisabled={savedVersionCount < 2} onCandidateReport={onCandidateReport} queueCount={queueCount} queueDisabled={readOnly || !displayedParameters || !dslValid} onLogs={onLogs} onOpenQueue={onOpenQueue} onQueue={onQueue} onShowParameters={onShowParameters} workflowInstanceId={displayedWorkflowInstanceId} /></div>
    </div>
  </div></section>;
}
