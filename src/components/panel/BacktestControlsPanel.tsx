import { Braces, Code2, Pencil, Save, Terminal } from "lucide-react";

import VersionNavigator from "@/components/bar/VersionNavigator";
import WorkflowRunButton from "@/components/button/WorkflowRunButton";
import BacktestEditor from "@/components/editor/BacktestEditor";
import { Button } from "@/ui/button";
import type { BacktestParameters, BacktestProject, BacktestSummary, BacktestVersionListItem } from "@/types/backtest";
import type { DslCatalog } from "@/types/factor";

type BacktestControlsPanelProps = {
  activeWorkflow: boolean;
  catalog: DslCatalog;
  displayedParameters: BacktestParameters;
  displayedState: string;
  displayedWorkflowInstanceId: number | null;
  project: BacktestProject;
  projectId: number;
  readOnly: boolean;
  ready: boolean;
  selectedVersion: number | null;
  stopping: boolean;
  submitting: boolean;
  summary: BacktestSummary | null;
  workflowState: string;
  versions: BacktestVersionListItem[];
  onContinue: () => void;
  onCompare: () => void;
  onLogs: () => void;
  onParameters: (parameters: BacktestParameters) => void;
  onRun: () => void;
  onSave: () => void;
  onShowParameters: () => void;
  onStop: () => void;
  onValidity: (valid: boolean) => void;
  onVersion: (version: number | null) => void;
};

export default function BacktestControlsPanel({ activeWorkflow, catalog, displayedParameters, displayedState, displayedWorkflowInstanceId, project, projectId, readOnly, ready, selectedVersion, stopping, submitting, summary, workflowState, versions, onCompare, onContinue, onLogs, onParameters, onRun, onSave, onShowParameters, onStop, onValidity, onVersion }: BacktestControlsPanelProps) {
  return <section className="h-full min-h-0 min-w-0"><div className="h-full overflow-y-auto">
    <div className="space-y-4 px-5 pt-5"><div className="flex items-center gap-3"><h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{project.title}</h1><Pencil className="size-4" /></div><p className="text-sm leading-6 text-muted-foreground">切换历史版本，或重新执行后保存为新版本。</p><VersionNavigator displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} hasDraft={Boolean(project.draft)} onCompare={selectedVersion !== null && versions.length > 1 ? onCompare : undefined} selectedVersion={selectedVersion} versions={versions} onVersion={onVersion} /></div>
    <div className="space-y-5 p-5"><BacktestEditor catalog={catalog} parameters={displayedParameters} projectId={projectId} readOnly={readOnly} onChange={onParameters} onValidityChange={onValidity} /><div className="grid grid-cols-2 gap-3">{readOnly ? <Button className="col-span-2" onClick={onContinue}><Code2 />基于此版本回测</Button> : <><WorkflowRunButton active={activeWorkflow} disabled={!ready} label="执行回测" stopping={stopping} submitting={submitting} onRun={onRun} onStop={onStop} /><Button variant="outline" disabled={!summary || workflowState !== "SUCCESS"} onClick={onSave}><Save />保存</Button></>}</div><div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={onShowParameters}><Braces />展示参数</Button><Button variant="outline" disabled={!displayedWorkflowInstanceId} onClick={onLogs}><Terminal />Task 日志</Button></div></div>
  </div></section>;
}
