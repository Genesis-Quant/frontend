import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { backtestApi, backtestReportParameters, isBacktestParameters, validBacktestParameters } from "@/assets/lib/backtest";
import { useProjectQueue } from "@/assets/lib/useProjectQueue";
import { errorMessage } from "@/assets/lib/utils";
import { workflowsApi } from "@/assets/lib/workflows";
import AnalysisWorkspace from "@/components/layout/AnalysisWorkspace";
import FeeAnalysisDialog from "@/components/modal/FeeAnalysisDialog";
import ParameterOptimizationDialog from "@/components/modal/ParameterOptimizationDialog";
import { DeleteVersionDialog, RenameDialog } from "@/components/modal/ProjectDialogs";
import SensitivityAnalysisDialog from "@/components/modal/SensitivityAnalysisDialog";
import QueueSubmitDialog from "@/components/modal/QueueSubmitDialog";
import RequestBodyDialog from "@/components/modal/RequestBodyDialog";
import SaveVersionDialog from "@/components/modal/SaveVersionDialog";
import VersionCompareDialog from "@/components/modal/VersionCompareDialog";
import TaskLogModal from "@/components/modal/TaskLogModal";
import BacktestControlsPanel from "@/components/panel/BacktestControlsPanel";
import BacktestResultsPanel from "@/components/panel/BacktestResultsPanel";
import ErrorPanel from "@/components/panel/ErrorPanel";
import ExecutionQueuePanel from "@/components/panel/ExecutionQueuePanel";
import TaskLogPanel from "@/components/panel/TaskLogPanel";
import type { BacktestCatalog, BacktestParameters, BacktestProject, BacktestVersion, BacktestVersionListItem } from "@/types/backtest";
import { terminalStates } from "@/types/workflow";
import { useAppStore } from "@/store";

export default function BacktestDetailPage() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const userId = useAppStore((state) => state.user!.id);
  const [project, setProject] = useState<BacktestProject | null>(null);
  const [versions, setVersions] = useState<BacktestVersionListItem[]>([]);
  const [currentVersion, setCurrentVersion] = useState<BacktestVersion | null>(null);
  const [catalog, setCatalog] = useState<BacktestCatalog | null>(null);
  const [parameters, setParameters] = useState<BacktestParameters | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [workflowInstanceId, setWorkflowInstanceId] = useState<number | null>(null);
  const [workflowState, setWorkflowState] = useState("IDLE");
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [logTaskInstanceId, setLogTaskInstanceId] = useState<number | null>(null);
  const [editorValid, setEditorValid] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [feeAnalysisOpen, setFeeAnalysisOpen] = useState(false);
  const [optimizationOpen, setOptimizationOpen] = useState(false);
  const [sensitivityOpen, setSensitivityOpen] = useState(false);
  const [parametersOpen, setParametersOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [renameProjectOpen, setRenameProjectOpen] = useState(false);
  const [renameVersionOpen, setRenameVersionOpen] = useState(false);
  const [deleteVersionOpen, setDeleteVersionOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueSubmitOpen, setQueueSubmitOpen] = useState(false);
  const [queueRemark, setQueueRemark] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [versionTitle, setVersionTitle] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");
  const loadRequest = useRef(0);
  const versionRequest = useRef(0);
  const queueVersionsRequest = useRef(0);
  const queue = useProjectQueue({
    application: "backtest",
    executeBatch: (request) => backtestApi.executeBatch(projectId, request),
    normalizeParameters: (value) => structuredClone(value),
    onError: setError,
    pollingErrorMessage: "部分回测队列状态读取失败，将继续重试。",
    projectId,
    userId,
    validateParameters: isBacktestParameters
  });
  const storedParameters = currentVersion?.parameters ?? parameters ?? project?.draft.parameters ?? null;
  const displayedParameters = isBacktestParameters(storedParameters) ? storedParameters : null;
  const parameterError = storedParameters === null || displayedParameters
    ? null
    : "该记录缺少当前回测格式要求的完整 DSL 双源码、配置或回调，历史结果仍可查看；再次执行前请在原始 JSON 中补全参数。";
  const displayedWorkflowInstanceId = currentVersion ? currentVersion.workflow_instance_id : workflowInstanceId;
  const resultSourceParameters = currentVersion?.parameters ?? project?.draft.parameters ?? null;
  const resultParameters = backtestReportParameters(resultSourceParameters);
  const displayedState = currentVersion ? currentVersion.saved ? "SUCCESS" : "IDLE" : workflowState;
  const displayedWorkflowError = currentVersion ? null : workflowError;
  const readOnly = currentVersion !== null;
  const activeWorkflow = !currentVersion && workflowInstanceId !== null && !terminalStates.has(workflowState);
  const running = submitting || activeWorkflow;
  const ready = parameters !== null && editorValid && validBacktestParameters(parameters);

  useEffect(() => {
    if (!Number.isInteger(projectId) || projectId <= 0) { navigate("/backtest", { replace: true }); return; }
    load();
  }, [projectId]);

  useEffect(() => {
    if (!workflowInstanceId || terminalStates.has(workflowState)) return undefined;
    let disposed = false;
    let polling = false;
    const timer = window.setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const workflow = await workflowsApi.status(workflowInstanceId);
        const refreshed = terminalStates.has(workflow.state) ? await backtestApi.getProject(projectId) : null;
        if (disposed) return;
        setError("");
        setWorkflowState(workflow.state);
        setWorkflowError(workflow.error);
        if (refreshed) {
          setStopping(false);
          window.clearInterval(timer);
          setProject(refreshed);
        }
      } catch (reason) { if (!disposed) setError(errorMessage(reason)); }
      finally { polling = false; }
    }, 2500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [projectId, workflowInstanceId, workflowState]);

  const completedQueueVersions = queue.completedVersionsKey;
  const projectLoaded = project !== null;

  useEffect(() => {
    if (!projectLoaded || !completedQueueVersions) return;
    const requestId = ++queueVersionsRequest.current;
    Promise.all([backtestApi.getProject(projectId), backtestApi.listVersions(projectId)]).then(([nextProject, nextVersions]) => {
      if (requestId !== queueVersionsRequest.current) return;
      setProject(nextProject);
      setVersions(nextVersions);
    }).catch((reason) => { if (requestId === queueVersionsRequest.current) setError(errorMessage(reason)); });
  }, [completedQueueVersions, projectId, projectLoaded]);

  async function load() {
    const requestId = ++loadRequest.current;
    setLoading(true);
    setError("");
    try {
      const [nextProject, nextVersions, nextCatalog] = await Promise.all([backtestApi.getProject(projectId), backtestApi.listVersions(projectId), backtestApi.catalog()]);
      const latestVersion = nextProject.latest_version === null
        ? null
        : await backtestApi.getVersion(projectId, nextProject.latest_version);
      const draftParameters = isBacktestParameters(nextProject.draft.parameters)
        ? structuredClone(nextProject.draft.parameters)
        : null;
      if (requestId !== loadRequest.current) return;
      setProject(nextProject);
      setVersions(nextVersions);
      setCurrentVersion(latestVersion);
      setCatalog(nextCatalog);
      setStopping(false);
      setSelectedVersion(latestVersion?.version ?? null);
      setWorkflowInstanceId(null);
      setWorkflowState("IDLE");
      setWorkflowError(null);
      setParameters(draftParameters);
      setWorkflowInstanceId(nextProject.draft.workflow_instance_id);
      setWorkflowState(nextProject.draft.state);
      setWorkflowError(nextProject.draft.error);
    } catch (reason) { if (requestId === loadRequest.current) setError(errorMessage(reason)); }
    finally { if (requestId === loadRequest.current) setLoading(false); }
  }

  async function run() {
    if (!parameters || !ready || running || readOnly) return;
    setSubmitting(true);
    setStopping(false);
    setError("");
    setWorkflowError(null);
    try {
      const submitted = await backtestApi.run(projectId, parameters);
      setWorkflowInstanceId(submitted.workflow_instance_id);
      setWorkflowState("SUBMITTED_SUCCESS");
      const refreshed = await backtestApi.getProject(projectId);
      setProject(refreshed);
      setWorkflowState(refreshed.draft?.state ?? "SUBMITTED_SUCCESS");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSubmitting(false); }
  }

  async function stopBacktest() {
    if (!workflowInstanceId || !activeWorkflow || stopping) return;
    setStopping(true);
    setError("");
    try {
      const response = await workflowsApi.stop(workflowInstanceId);
      setWorkflowState(response.workflow.state);
      setWorkflowError(response.workflow.error);
      if (terminalStates.has(response.workflow.state)) {
        setStopping(false);
        setProject(await backtestApi.getProject(projectId));
      }
    } catch (reason) {
      setStopping(false);
      setError(errorMessage(reason));
    }
  }

  function openTaskLog() {
    if (!displayedWorkflowInstanceId) return;
    setLogTaskInstanceId(null);
    setLogsOpen(true);
  }

  async function saveVersion() {
    if (!workflowInstanceId || saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await backtestApi.saveVersion(projectId, workflowInstanceId, remark);
      const [nextProject, nextVersions] = await Promise.all([backtestApi.getProject(projectId), backtestApi.listVersions(projectId)]);
      setProject(nextProject);
      setVersions(nextVersions);
      setCurrentVersion(saved);
      setSelectedVersion(saved.version);
      setSaveOpen(false);
      setRemark("");
      setWorkflowInstanceId(null);
      setWorkflowState("IDLE");
      setWorkflowError(null);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }

  function continueFromVersion() {
    if (!currentVersion) return;
    if (!isBacktestParameters(currentVersion.parameters)) {
      setError("该版本参数不符合当前回测契约，无法直接继续；原始参数和历史结果未被修改。");
      return;
    }
    setParameters(structuredClone(currentVersion.parameters));
    setCurrentVersion(null);
    setSelectedVersion(null);
    setWorkflowInstanceId(project?.draft?.workflow_instance_id ?? null);
    setWorkflowState(project?.draft?.state ?? "IDLE");
    setWorkflowError(project?.draft?.error ?? null);
    setError("");
  }

  function submitToQueue() {
    if (!parameters || !ready || readOnly || queue.executing) return;
    if (!queue.add(queueRemark, parameters)) return;
    setQueueRemark("");
    setQueueSubmitOpen(false);
  }

  async function renameProject() {
    const title = projectTitle.trim();
    if (!title || renaming) return;
    if (title === project?.title) { setRenameProjectOpen(false); return; }
    setRenaming(true);
    setError("");
    try {
      setProject(await backtestApi.updateProject(projectId, title));
      setRenameProjectOpen(false);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setRenaming(false); }
  }

  async function renameVersion() {
    if (selectedVersion === null || !versionTitle.trim() || renaming) return;
    setRenaming(true);
    setError("");
    try {
      const updated = await backtestApi.updateVersion(projectId, selectedVersion, versionTitle.trim());
      setCurrentVersion(updated);
      setVersions((current) => current.map((version) => version.version === updated.version ? { ...version, saved: updated.saved, is_current: updated.is_current, workflow_instance_id: updated.workflow_instance_id, remark: updated.remark } : version));
      setRenameVersionOpen(false);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setRenaming(false); }
  }

  async function deleteVersion() {
    if (selectedVersion === null || deletingVersion) return;
    setDeletingVersion(true);
    setError("");
    try {
      await backtestApi.deleteVersion(projectId, selectedVersion);
      versionRequest.current += 1;
      const [nextProject, nextVersions] = await Promise.all([backtestApi.getProject(projectId), backtestApi.listVersions(projectId)]);
      setProject(nextProject);
      setVersions(nextVersions);
      setDeleteVersionOpen(false);
      if (nextProject.latest_version !== null) {
        const nextVersion = await backtestApi.getVersion(projectId, nextProject.latest_version);
        setCurrentVersion(nextVersion);
        setSelectedVersion(nextVersion.version);
        setParameters(isBacktestParameters(nextProject.draft.parameters) ? structuredClone(nextProject.draft.parameters) : null);
        setWorkflowInstanceId(nextProject.draft.workflow_instance_id);
        setWorkflowState(nextProject.draft.state);
        setWorkflowError(nextProject.draft.error);
      } else if (nextProject.draft) {
        setCurrentVersion(null);
        setSelectedVersion(null);
        setParameters(isBacktestParameters(nextProject.draft.parameters) ? structuredClone(nextProject.draft.parameters) : null);
        setWorkflowInstanceId(nextProject.draft.workflow_instance_id);
        setWorkflowState(nextProject.draft.state);
        setWorkflowError(nextProject.draft.error);
      } else {
        setCurrentVersion(null);
        setSelectedVersion(null);
        setWorkflowInstanceId(null);
        setWorkflowState("IDLE");
        setWorkflowError(null);
      }
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setDeletingVersion(false); }
  }

  async function selectVersion(version: number | null) {
    const requestId = ++versionRequest.current;
    setError("");
    if (version === null) {
      setCurrentVersion(null);
      setSelectedVersion(null);
      return;
    }
    if (!versions.some((item) => item.version === version && item.saved)) {
      setError("该批量任务尚未生成可用版本。");
      return;
    }
    try {
      const nextVersion = await backtestApi.getVersion(projectId, version);
      if (requestId !== versionRequest.current) return;
      setCurrentVersion(nextVersion);
      setSelectedVersion(version);
    } catch (reason) {
      if (requestId === versionRequest.current) setError(errorMessage(reason));
    }
  }

  if (loading) return <div className="grid min-h-[calc(100vh-4rem)] place-items-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!project || !catalog) return <div className="mx-auto w-full max-w-xl py-20"><ErrorPanel message={error} /></div>;

  return <>
    <AnalysisWorkspace backTo="/backtest" sidebar={<BacktestControlsPanel activeWorkflow={activeWorkflow} catalog={catalog} displayedParameters={displayedParameters} displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} onFeeAnalysis={() => setFeeAnalysisOpen(true)} onOptimization={() => setOptimizationOpen(true)} onSensitivity={() => setSensitivityOpen(true)} parameterError={parameterError} project={project} projectId={projectId} queueCount={queue.items.length} readOnly={readOnly} ready={ready} selectedVersion={selectedVersion} stopping={stopping} submitting={submitting} workflowState={workflowState} versions={versions} onCompare={() => setCompareOpen(true)} onContinue={continueFromVersion} onDeleteVersion={() => { setError(""); setDeleteVersionOpen(true); }} onLogs={openTaskLog} onOpenQueue={() => setQueueOpen(true)} onParameters={setParameters} onQueue={() => { setQueueRemark(""); setQueueSubmitOpen(true); }} onRenameProject={() => { setError(""); setProjectTitle(project.title); setRenameProjectOpen(true); }} onRenameVersion={() => { setError(""); setVersionTitle(versions.find((version) => version.version === selectedVersion)?.remark ?? ""); setRenameVersionOpen(true); }} onRun={run} onSave={() => setSaveOpen(true)} onShowParameters={() => setParametersOpen(true)} onStop={stopBacktest} onValidity={setEditorValid} onVersion={selectVersion} />}>
      {activeWorkflow && workflowInstanceId ? <TaskLogPanel className="h-[calc(100dvh-9rem)] min-h-[32rem]" taskInstanceId={null} workflowInstanceId={workflowInstanceId} /> : <BacktestResultsPanel annualTradingDays={resultParameters?.annual_trading_days ?? null} displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} error={error} readOnly={readOnly} riskFreeRate={resultParameters?.risk_free_rate ?? null} running={running} workflowError={displayedWorkflowError} />}
    </AnalysisWorkspace>
    <SaveVersionDialog version={project.draft.version} open={saveOpen} remark={remark} submitting={saving} onClose={() => setSaveOpen(false)} onRemark={setRemark} onSave={saveVersion} />
    <VersionCompareDialog currentVersion={currentVersion} currentVersionNumber={currentVersion?.version ?? project.draft.version} kind="backtest" loadVersion={(version) => backtestApi.getVersion(projectId, version)} open={compareOpen} projectTitle={project.title} versions={versions} onOpenChange={setCompareOpen} />
    <FeeAnalysisDialog open={feeAnalysisOpen} projectId={projectId} projectTitle={project.title} version={selectedVersion} onOpenChange={setFeeAnalysisOpen} />
    {displayedParameters ? <ParameterOptimizationDialog baseParameters={displayedParameters} open={optimizationOpen} projectId={projectId} projectTitle={project.title} version={selectedVersion} onOpenChange={setOptimizationOpen} /> : null}
    {displayedParameters ? <SensitivityAnalysisDialog baseParameters={displayedParameters} open={sensitivityOpen} projectId={projectId} projectTitle={project.title} version={selectedVersion} onOpenChange={setSensitivityOpen} /> : null}
    <RequestBodyDialog editable={!readOnly} endpoint={`/api/v1/backtest/projects/${projectId}/runs`} open={parametersOpen} value={storedParameters} validate={(value) => isBacktestParameters(value) ? null : "回测参数结构不完整。"} onApply={(value) => { if (isBacktestParameters(value)) setParameters(structuredClone(value)); }} onClose={() => setParametersOpen(false)} />
    <TaskLogModal open={logsOpen} workflowInstanceId={displayedWorkflowInstanceId} taskInstanceId={logTaskInstanceId} onOpenChange={setLogsOpen} />
    <RenameDialog description="项目名称会同步更新到项目列表和研究页面。" error={renameProjectOpen ? error : undefined} inputId="backtest-project-title" label="项目名称" maxLength={128} open={renameProjectOpen} submitting={renaming} title="重命名项目" value={projectTitle} onOpenChange={setRenameProjectOpen} onRename={renameProject} onValue={setProjectTitle} />
    <RenameDialog description={`修改 v${selectedVersion ?? ""} 的显示名称，不影响版本参数和结果。`} error={renameVersionOpen ? error : undefined} inputId="backtest-version-title" label="版本名称" maxLength={512} open={renameVersionOpen} submitting={renaming} title={`重命名版本 v${selectedVersion ?? ""}`} value={versionTitle} onOpenChange={setRenameVersionOpen} onRename={renameVersion} onValue={setVersionTitle} />
    <DeleteVersionDialog error={deleteVersionOpen ? error : undefined} open={deleteVersionOpen} submitting={deletingVersion} version={selectedVersion} onDelete={deleteVersion} onOpenChange={setDeleteVersionOpen} />
    <QueueSubmitDialog open={queueSubmitOpen} remark={queueRemark} submitting={queue.executing} onOpenChange={setQueueSubmitOpen} onRemark={setQueueRemark} onSubmit={submitToQueue} />
    <ExecutionQueuePanel executing={queue.executing} items={queue.items} loadError={queue.loadError} open={queueOpen} validate={isBacktestParameters} onDelete={queue.remove} onExecute={queue.execute} onOpenChange={setQueueOpen} onUpdate={queue.update} />
  </>;
}
