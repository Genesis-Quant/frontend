import { Code2, Pencil, Save } from "lucide-react";

import VersionNavigator from "@/components/bar/VersionNavigator";
import AnalysisMoreActions from "@/components/button/AnalysisMoreActions";
import WorkflowExecutionButton from "@/components/button/WorkflowExecutionButton";
import BacktestEditor from "@/components/editor/BacktestEditor";
import { Button } from "@/ui/button";
import type { BacktestCatalog, BacktestParameters, BacktestProject, BacktestVersionListItem } from "@/types/backtest";

type BacktestControlsPanelProps = {
  activeWorkflow: boolean;
  catalog: BacktestCatalog;
  displayedParameters: BacktestParameters;
  displayedState: string;
  displayedWorkflowInstanceId: number | null;
  project: BacktestProject;
  projectId: number;
  queueCount: number;
  readOnly: boolean;
  ready: boolean;
  selectedVersion: number | null;
  stopping: boolean;
  submitting: boolean;
  workflowState: string;
  versions: BacktestVersionListItem[];
  onContinue: () => void;
  onCompare: () => void;
  onFeeAnalysis: () => void;
  onOptimization: () => void;
  onSensitivity: () => void;
  onDeleteVersion: () => void;
  onLogs: () => void;
  onOpenQueue: () => void;
  onParameters: (parameters: BacktestParameters) => void;
  onQueue: () => void;
  onRun: () => void;
  onRenameProject: () => void;
  onRenameVersion: () => void;
  onSave: () => void;
  onShowParameters: () => void;
  onStop: () => void;
  onValidity: (valid: boolean) => void;
  onVersion: (version: number | null) => void;
};

export default function BacktestControlsPanel({ activeWorkflow, catalog, displayedParameters, displayedState, displayedWorkflowInstanceId, onFeeAnalysis, onOptimization, onSensitivity, project, projectId, queueCount, readOnly, ready, selectedVersion, stopping, submitting, workflowState, versions, onCompare, onContinue, onDeleteVersion, onLogs, onOpenQueue, onParameters, onQueue, onRenameProject, onRenameVersion, onRun, onSave, onShowParameters, onStop, onValidity, onVersion }: BacktestControlsPanelProps) {
  const selectedSaved = versions.find((version) => version.version === selectedVersion)?.saved === true;
  return <section className="h-full min-h-0 min-w-0"><div className="h-full overflow-y-auto">
    <div className="space-y-4 px-5 pt-5"><div className="flex items-center gap-3"><h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{project.title}</h1><Button aria-label="重命名项目" size="icon-sm" variant="ghost" onClick={onRenameProject}><Pencil /></Button></div><p className="text-sm leading-6 text-muted-foreground">切换历史版本，或重新执行后保存为新版本。</p><VersionNavigator displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} onCompare={versions.length > 1 ? onCompare : undefined} onDeleteVersion={onDeleteVersion} onRenameVersion={onRenameVersion} selectedVersion={selectedVersion} versions={versions} onVersion={onVersion} /></div>
    <div className="space-y-5 p-5"><BacktestEditor catalog={catalog} parameters={displayedParameters} projectId={projectId} readOnly={readOnly} onChange={onParameters} onValidityChange={onValidity} /><div className="flex gap-3">{readOnly ? <Button className="min-w-0 flex-1" onClick={onContinue}><Code2 />基于此版本回测</Button> : <><WorkflowExecutionButton className="min-w-0 flex-1" active={activeWorkflow} disabled={!ready} label="执行回测" stopping={stopping} submitting={submitting} onRun={onRun} onStop={onStop} /><Button className="min-w-0 flex-1" variant="outline" disabled={workflowState !== "SUCCESS"} onClick={onSave}><Save />保存</Button></>}<AnalysisMoreActions feeAnalysisDisabled={!selectedSaved} optimizationDisabled={!selectedSaved} onFeeAnalysis={onFeeAnalysis} onOptimization={onOptimization} onSensitivity={onSensitivity} queueCount={queueCount} queueDisabled={readOnly || !ready} sensitivityDisabled={!selectedSaved} onLogs={onLogs} onOpenQueue={onOpenQueue} onQueue={onQueue} onShowParameters={onShowParameters} workflowInstanceId={displayedWorkflowInstanceId} /></div></div>
  </div></section>;
}
