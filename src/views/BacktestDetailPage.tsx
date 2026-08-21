import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { backtestApi, isBacktestParameters, validBacktestParameters } from "@/assets/lib/backtest";
import { applyAcceptedBatch, createProjectQueueItem, loadProjectQueue, maxBatchRunItems, pendingBatchRequest, queueNeedsPolling, refreshProjectQueue, saveProjectQueue } from "@/assets/lib/projectQueue";
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
import { defaultBacktestParameters, type BacktestParameters, type BacktestProject, type BacktestVersion, type BacktestVersionListItem } from "@/types/backtest";
import type { DslCatalog } from "@/types/factor";
import type { ProjectQueueItem } from "@/types/queue";
import { terminalStates } from "@/types/workflow";
import { useAppStore } from "@/store";

export default function BacktestDetailPage() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const userId = useAppStore((state) => state.user!.id);
  const [project, setProject] = useState<BacktestProject | null>(null);
  const [versions, setVersions] = useState<BacktestVersionListItem[]>([]);
  const [currentVersion, setCurrentVersion] = useState<BacktestVersion | null>(null);
  const [catalog, setCatalog] = useState<DslCatalog | null>(null);
  const [parameters, setParameters] = useState<BacktestParameters>(defaultBacktestParameters());
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
  const [queueItems, setQueueItems] = useState<ProjectQueueItem<BacktestParameters>[]>(() => loadProjectQueue(userId, "backtest", projectId, isBacktestParameters));
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueSubmitOpen, setQueueSubmitOpen] = useState(false);
  const [queueRemark, setQueueRemark] = useState("");
  const [queueExecuting, setQueueExecuting] = useState(false);
  const [queueSavingId, setQueueSavingId] = useState<string | null>(null);
  const [queueDeletingId, setQueueDeletingId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [versionTitle, setVersionTitle] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");
  const loadRequest = useRef(0);
  const versionRequest = useRef(0);
  const queueVersionsRequest = useRef(0);
  const queueItemsRef = useRef(queueItems);
  const displayedWorkflowInstanceId = currentVersion ? currentVersion.workflow_instance_id : workflowInstanceId;
  const displayedParameters = currentVersion?.parameters ?? parameters;
  const resultParameters = currentVersion?.parameters ?? project?.draft?.parameters ?? parameters;
  const displayedState = currentVersion ? currentVersion.saved ? "SUCCESS" : "IDLE" : workflowState;
  const displayedWorkflowError = currentVersion ? null : workflowError;
  const readOnly = currentVersion !== null;
  const activeWorkflow = !currentVersion && workflowInstanceId !== null && !terminalStates.has(workflowState);
  const running = submitting || activeWorkflow;
  const ready = editorValid && validBacktestParameters(parameters);

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

  const queuePolling = queueNeedsPolling(queueItems);
  const completedQueueVersions = queueItems.filter((item) => item.version !== null).map((item) => `${item.id}:${item.version}`).sort().join("|");
  const projectLoaded = project !== null;

  useEffect(() => {
    if (!queuePolling) return undefined;
    let disposed = false;
    let polling = false;
    const refresh = async () => {
      if (polling) return;
      polling = true;
      try {
        const refreshed = await refreshProjectQueue(queueItemsRef.current);
        if (disposed) return;
        const byId = new Map(refreshed.items.map((item) => [item.id, item]));
        setQueueItems((current) => current.map((item) => byId.get(item.id) ?? item));
        if (refreshed.errors.length) console.warn("部分回测队列状态读取失败，将继续重试。", refreshed.errors);
      } catch (reason) {
        if (!disposed) setError(errorMessage(reason));
      } finally {
        polling = false;
      }
    };
    const timer = window.setInterval(refresh, 2500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [queuePolling]);

  useEffect(() => { queueItemsRef.current = queueItems; saveProjectQueue(userId, "backtest", projectId, queueItems); }, [projectId, queueItems, userId]);

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
      setParameters(isBacktestParameters(nextProject.draft.parameters) ? nextProject.draft.parameters : defaultBacktestParameters());
      setWorkflowInstanceId(nextProject.draft.workflow_instance_id);
      setWorkflowState(nextProject.draft.state);
      setWorkflowError(nextProject.draft.error);
    } catch (reason) { if (requestId === loadRequest.current) setError(errorMessage(reason)); }
    finally { if (requestId === loadRequest.current) setLoading(false); }
  }

  async function run() {
    if (!ready || running || readOnly) return;
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
    setParameters(structuredClone(currentVersion.parameters));
    setCurrentVersion(null);
    setSelectedVersion(null);
    setWorkflowInstanceId(project?.draft?.workflow_instance_id ?? null);
    setWorkflowState(project?.draft?.state ?? "IDLE");
    setWorkflowError(project?.draft?.error ?? null);
    setError("");
  }

  function submitToQueue() {
    if (!ready || readOnly || queueExecuting) return;
    if (queueItems.filter((item) => item.workspace_id === null).length >= maxBatchRunItems) {
      setError(`执行队列最多保留 ${maxBatchRunItems} 个待执行任务。`);
      return;
    }
    setQueueItems((current) => [...current, createProjectQueueItem(queueRemark, parameters)]);
    setQueueRemark("");
    setQueueSubmitOpen(false);
  }

  async function updateQueueItem(item: ProjectQueueItem<BacktestParameters>, nextRemark: string, nextParameters: BacktestParameters) {
    if (queueExecuting) return;
    setQueueSavingId(item.id);
    try {
      setQueueItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, remark: nextRemark.trim(), parameters: nextParameters, updated_at: new Date().toISOString() } : currentItem));
    } finally { setQueueSavingId(null); }
  }

  async function deleteQueueItem(item: ProjectQueueItem<BacktestParameters>) {
    if (queueExecuting) return;
    setQueueDeletingId(item.id);
    try {
      setQueueItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    } finally { setQueueDeletingId(null); }
  }

  async function executeQueue() {
    if (queueExecuting) return;
    setQueueExecuting(true);
    setError("");
    try {
      const request = pendingBatchRequest(queueItems);
      if (!request.items.length) return;
      const accepted = await backtestApi.executeBatch(projectId, request);
      setQueueItems((current) => applyAcceptedBatch(current, accepted));
    }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setQueueExecuting(false); }
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
        setParameters(nextProject.draft.parameters);
        setWorkflowInstanceId(null);
        setWorkflowState("IDLE");
        setWorkflowError(null);
      } else if (nextProject.draft) {
        setCurrentVersion(null);
        setSelectedVersion(null);
        setParameters(nextProject.draft.parameters);
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
    <AnalysisWorkspace backTo="/backtest" sidebar={<BacktestControlsPanel activeWorkflow={activeWorkflow} catalog={catalog} displayedParameters={displayedParameters} displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} onFeeAnalysis={() => setFeeAnalysisOpen(true)} onOptimization={() => setOptimizationOpen(true)} onSensitivity={() => setSensitivityOpen(true)} project={project} projectId={projectId} queueCount={queueItems.length} readOnly={readOnly} ready={ready} selectedVersion={selectedVersion} stopping={stopping} submitting={submitting} workflowState={workflowState} versions={versions} onCompare={() => setCompareOpen(true)} onContinue={continueFromVersion} onDeleteVersion={() => { setError(""); setDeleteVersionOpen(true); }} onLogs={openTaskLog} onOpenQueue={() => setQueueOpen(true)} onParameters={setParameters} onQueue={() => { setQueueRemark(""); setQueueSubmitOpen(true); }} onRenameProject={() => { setError(""); setProjectTitle(project.title); setRenameProjectOpen(true); }} onRenameVersion={() => { setError(""); setVersionTitle(versions.find((version) => version.version === selectedVersion)?.remark ?? ""); setRenameVersionOpen(true); }} onRun={run} onSave={() => setSaveOpen(true)} onShowParameters={() => setParametersOpen(true)} onStop={stopBacktest} onValidity={setEditorValid} onVersion={selectVersion} />}>
      <BacktestResultsPanel annualTradingDays={resultParameters.annual_trading_days} displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} error={error} readOnly={readOnly} riskFreeRate={resultParameters.risk_free_rate} running={running} workflowError={displayedWorkflowError} />
    </AnalysisWorkspace>
    <SaveVersionDialog version={project.draft.version} open={saveOpen} remark={remark} submitting={saving} onClose={() => setSaveOpen(false)} onRemark={setRemark} onSave={saveVersion} />
    <VersionCompareDialog currentVersion={currentVersion} currentVersionNumber={currentVersion?.version ?? project.draft.version} kind="backtest" loadVersion={(version) => backtestApi.getVersion(projectId, version)} open={compareOpen} projectTitle={project.title} versions={versions} onOpenChange={setCompareOpen} />
    <FeeAnalysisDialog open={feeAnalysisOpen} projectId={projectId} projectTitle={project.title} version={selectedVersion} onOpenChange={setFeeAnalysisOpen} />
    <ParameterOptimizationDialog baseParameters={displayedParameters} open={optimizationOpen} projectId={projectId} projectTitle={project.title} version={selectedVersion} onOpenChange={setOptimizationOpen} />
    <SensitivityAnalysisDialog baseParameters={displayedParameters} open={sensitivityOpen} projectId={projectId} projectTitle={project.title} version={selectedVersion} onOpenChange={setSensitivityOpen} />
    <RequestBodyDialog editable={!readOnly} endpoint={`/api/v1/backtest/projects/${projectId}/runs`} open={parametersOpen} value={displayedParameters} validate={(value) => isBacktestParameters(value) ? null : "回测参数结构不完整。"} onApply={setParameters} onClose={() => setParametersOpen(false)} />
    <TaskLogModal open={logsOpen} workflowInstanceId={displayedWorkflowInstanceId} taskInstanceId={logTaskInstanceId} onOpenChange={setLogsOpen} />
    <RenameDialog description="项目名称会同步更新到项目列表和研究页面。" error={renameProjectOpen ? error : undefined} inputId="backtest-project-title" label="项目名称" maxLength={128} open={renameProjectOpen} submitting={renaming} title="重命名项目" value={projectTitle} onOpenChange={setRenameProjectOpen} onRename={renameProject} onValue={setProjectTitle} />
    <RenameDialog description={`修改 v${selectedVersion ?? ""} 的显示名称，不影响版本参数和结果。`} error={renameVersionOpen ? error : undefined} inputId="backtest-version-title" label="版本名称" maxLength={512} open={renameVersionOpen} submitting={renaming} title={`重命名版本 v${selectedVersion ?? ""}`} value={versionTitle} onOpenChange={setRenameVersionOpen} onRename={renameVersion} onValue={setVersionTitle} />
    <DeleteVersionDialog error={deleteVersionOpen ? error : undefined} open={deleteVersionOpen} submitting={deletingVersion} version={selectedVersion} onDelete={deleteVersion} onOpenChange={setDeleteVersionOpen} />
    <QueueSubmitDialog open={queueSubmitOpen} remark={queueRemark} submitting={queueExecuting} onOpenChange={setQueueSubmitOpen} onRemark={setQueueRemark} onSubmit={submitToQueue} />
    <ExecutionQueuePanel deletingId={queueDeletingId} executing={queueExecuting} items={queueItems} open={queueOpen} savingId={queueSavingId} validate={isBacktestParameters} onDelete={deleteQueueItem} onExecute={executeQueue} onOpenChange={setQueueOpen} onUpdate={updateQueueItem} />
  </>;
}
