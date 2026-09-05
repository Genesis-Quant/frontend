import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import IconLoaderCircle from "~icons/lucide/loader-circle";

import { factorApi } from "@/assets/lib/factor";
import { dslSourceKey } from "@/assets/lib/dslSource";
import { useProjectQueue } from "@/assets/lib/useProjectQueue";
import { errorMessage } from "@/assets/lib/utils";
import { workflowsApi } from "@/assets/lib/workflows";
import AnalysisWorkspace from "@/components/layout/AnalysisWorkspace";
import RequestBodyDialog from "@/components/modal/RequestBodyDialog";
import QueueSubmitDialog from "@/components/modal/QueueSubmitDialog";
import { DeleteVersionDialog, RenameDialog } from "@/components/modal/ProjectDialogs";
import SaveVersionDialog from "@/components/modal/SaveVersionDialog";
import FactorCandidateSelectionReport from "@/components/modal/FactorCandidateSelectionReport";
import VersionCompareDialog from "@/components/modal/VersionCompareDialog";
import TaskLogModal from "@/components/modal/TaskLogModal";
import FactorAnalysisControlsPanel from "@/components/panel/FactorAnalysisControlsPanel";
import FactorAnalysisResultsPanel from "@/components/panel/FactorAnalysisResultsPanel";
import ErrorPanel from "@/components/panel/ErrorPanel";
import ExecutionQueuePanel from "@/components/panel/ExecutionQueuePanel";
import TaskLogPanel from "@/components/panel/TaskLogPanel";
import { analysisExecutionParameters, factorAnalysisParameterError, factorAnalysisParameterIssues, factorReportParameterIssues, factorReportParameters, isFactorAnalysisDraftParameters, isFactorAnalysisParameters, requireFactorAnalysisParameters, type DslCatalog, type DslCompilation, type DslDocument, type FactorAnalysisParameters, type FactorProject, type FactorVersion, type FactorVersionListItem } from "@/types/factor";
import { terminalStates } from "@/types/workflow";
import { useAppStore } from "@/store";

export default function FactorAnalysisDetailPage() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const userId = useAppStore((state) => state.user!.id);
  const [project, setProject] = useState<FactorProject | null>(null);
  const [versions, setVersions] = useState<FactorVersionListItem[]>([]);
  const [currentVersion, setCurrentVersion] = useState<FactorVersion | null>(null);
  const [catalog, setCatalog] = useState<DslCatalog | null>(null);
  const [parameters, setParameters] = useState<FactorAnalysisParameters | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [workflowInstanceId, setWorkflowInstanceId] = useState<number | null>(null);
  const [workflowState, setWorkflowState] = useState("IDLE");
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [logTaskInstanceId, setLogTaskInstanceId] = useState<number | null>(null);
  const [dslCompilation, setDslCompilation] = useState<DslCompilation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [candidateReportOpen, setCandidateReportOpen] = useState(false);
  const [parametersOpen, setParametersOpen] = useState(false);
  const [remark, setRemark] = useState("");
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
  const [error, setError] = useState("");
  const loadRequest = useRef(0);
  const versionRequest = useRef(0);
  const queueVersionsRequest = useRef(0);
  const queue = useProjectQueue({
    application: "factor",
    executeBatch: (request) => factorApi.executeBatch(projectId, request),
    normalizeParameters: requireFactorAnalysisParameters,
    onError: setError,
    pollingErrorMessage: "部分因子分析队列状态读取失败，将继续重试。",
    projectId,
    userId,
    validateParameters: isFactorAnalysisParameters
  });
  const storedParameters = currentVersion?.parameters ?? parameters ?? project?.draft.parameters ?? null;
  const displayedParameters = isFactorAnalysisDraftParameters(storedParameters) ? storedParameters : null;
  const parameterError = storedParameters === null || displayedParameters ? null : factorAnalysisParameterError(storedParameters);
  const displayedWorkflowInstanceId = currentVersion ? currentVersion.workflow_instance_id : workflowInstanceId;
  const resultSourceParameters = currentVersion?.parameters ?? project?.draft.parameters ?? null;
  const resultParameters = factorReportParameters(resultSourceParameters);
  const resultParameterIssues = resultSourceParameters === null ? [] : factorReportParameterIssues(resultSourceParameters);
  const displayedState = currentVersion ? currentVersion.saved ? "SUCCESS" : "IDLE" : workflowState;
  const displayedWorkflowError = currentVersion ? null : workflowError;
  const readOnly = currentVersion !== null;
  const activeWorkflow = !currentVersion && workflowInstanceId !== null && !terminalStates.has(workflowState);
  const running = submitting || activeWorkflow;
  const compiledDocument = parameters !== null && dslCompilation?.sourceKey === dslSourceKey(parameters.dataset_query.dsl_source)
    ? dslCompilation.document
    : null;
  const executableParameters = parameters === null || compiledDocument === null ? null : analysisExecutionParameters(parameters, compiledDocument);
  const analysisReady = executableParameters !== null
    && isFactorAnalysisParameters(executableParameters)
    && compiledDocument !== null
    && validAnalysisContract(executableParameters, compiledDocument, catalog);

  useEffect(() => {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      navigate("/factor", { replace: true });
      return;
    }
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
        const refreshed = terminalStates.has(workflow.state) ? await factorApi.getProject(projectId) : null;
        if (disposed) return;
        setError("");
        setWorkflowState(workflow.state);
        setWorkflowError(workflow.error);
        if (refreshed) {
          setStopping(false);
          window.clearInterval(timer);
          setProject(refreshed);
        }
      } catch (reason) { if (!disposed) setError(reason instanceof Error ? reason.message : String(reason)); }
      finally { polling = false; }
    }, 2500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [projectId, workflowInstanceId, workflowState]);

  const completedQueueVersions = queue.completedVersionsKey;
  const projectLoaded = project !== null;

  useEffect(() => {
    if (!projectLoaded || !completedQueueVersions) return;
    const requestId = ++queueVersionsRequest.current;
    Promise.all([factorApi.getProject(projectId), factorApi.listVersions(projectId)]).then(([nextProject, nextVersions]) => {
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
      const [nextProject, nextVersions, nextCatalog] = await Promise.all([factorApi.getProject(projectId), factorApi.listVersions(projectId), factorApi.catalog()]);
      const latestVersion = nextProject.latest_version === null
        ? null
        : await factorApi.getVersion(projectId, nextProject.latest_version);
      const draftParameters = isFactorAnalysisDraftParameters(nextProject.draft.parameters)
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
    } catch (reason) { if (requestId === loadRequest.current) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (requestId === loadRequest.current) setLoading(false); }
  }

  async function analyze() {
    if (!executableParameters || !analysisReady || running || readOnly) return;
    setSubmitting(true);
    setStopping(false);
    setError("");
    setWorkflowError(null);
    try {
      setParameters(executableParameters);
      const submitted = await factorApi.analyze(projectId, executableParameters);
      setWorkflowInstanceId(submitted.workflow_instance_id);
      setWorkflowState("SUBMITTED_SUCCESS");
      setSelectedVersion(null);
      const refreshed = await factorApi.getProject(projectId);
      setProject(refreshed);
      setWorkflowState(refreshed.draft?.state ?? "SUBMITTED_SUCCESS");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSubmitting(false); }
  }

  async function stopAnalysis() {
    if (!workflowInstanceId || !activeWorkflow || stopping) return;
    setStopping(true);
    setError("");
    try {
      const response = await workflowsApi.stop(workflowInstanceId);
      setWorkflowState(response.workflow.state);
      setWorkflowError(response.workflow.error);
      if (terminalStates.has(response.workflow.state)) {
        setStopping(false);
        setProject(await factorApi.getProject(projectId));
      }
    } catch (reason) {
      setStopping(false);
      setError(reason instanceof Error ? reason.message : String(reason));
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
      const saved = await factorApi.saveVersion(projectId, workflowInstanceId, remark);
      const [nextProject, nextVersions] = await Promise.all([factorApi.getProject(projectId), factorApi.listVersions(projectId)]);
      setProject(nextProject);
      setVersions(nextVersions);
      setCurrentVersion(saved);
      setSelectedVersion(saved.version);
      setSaveOpen(false);
      setRemark("");
      setWorkflowInstanceId(null);
      setWorkflowState("IDLE");
      setWorkflowError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }

  function continueFromVersion() {
    if (!currentVersion) return;
    if (!isFactorAnalysisDraftParameters(currentVersion.parameters)) {
      setError(factorAnalysisParameterError(currentVersion.parameters) ?? "该版本参数不可继续研究。");
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
    if (!executableParameters || !analysisReady || readOnly || queue.executing) return;
    if (!queue.add(queueRemark, executableParameters)) return;
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
      setProject(await factorApi.updateProject(projectId, title));
      setRenameProjectOpen(false);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setRenaming(false); }
  }

  async function renameVersion() {
    if (selectedVersion === null || !versionTitle.trim() || renaming) return;
    setRenaming(true);
    setError("");
    try {
      const updated = await factorApi.updateVersion(projectId, selectedVersion, versionTitle.trim());
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
      await factorApi.deleteVersion(projectId, selectedVersion);
      versionRequest.current += 1;
      const [nextProject, nextVersions] = await Promise.all([factorApi.getProject(projectId), factorApi.listVersions(projectId)]);
      setProject(nextProject);
      setVersions(nextVersions);
      setDeleteVersionOpen(false);
      if (nextProject.latest_version !== null) {
        const nextVersion = await factorApi.getVersion(projectId, nextProject.latest_version);
        const nextDraftParameters = isFactorAnalysisDraftParameters(nextProject.draft.parameters) ? structuredClone(nextProject.draft.parameters) : null;
        setCurrentVersion(nextVersion);
        setSelectedVersion(nextVersion.version);
        setParameters(nextDraftParameters);
        setWorkflowInstanceId(nextProject.draft.workflow_instance_id);
        setWorkflowState(nextProject.draft.state);
        setWorkflowError(nextProject.draft.error);
      } else if (nextProject.draft) {
        const nextDraftParameters = isFactorAnalysisDraftParameters(nextProject.draft.parameters) ? structuredClone(nextProject.draft.parameters) : null;
        setCurrentVersion(null);
        setSelectedVersion(null);
        setParameters(nextDraftParameters);
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
      const nextVersion = await factorApi.getVersion(projectId, version);
      if (requestId !== versionRequest.current) return;
      setCurrentVersion(nextVersion);
      setSelectedVersion(version);
    } catch (reason) {
      if (requestId === versionRequest.current) setError(errorMessage(reason));
    }
  }

  if (loading) return <div className="grid min-h-[calc(100vh-4rem)] place-items-center"><IconLoaderCircle className="animate-spin text-primary" width={26} height={26} /></div>;
  if (!project || !catalog) return <div className="mx-auto w-full max-w-xl py-20"><ErrorPanel message={error} /></div>;

  return <>
    <AnalysisWorkspace backTo="/factor" sidebar={<FactorAnalysisControlsPanel
      catalog={catalog}
      activeWorkflow={activeWorkflow}
      displayedParameters={displayedParameters}
      displayedState={displayedState}
      displayedWorkflowInstanceId={displayedWorkflowInstanceId}
      dslValid={analysisReady}
      parameterError={parameterError}
      project={project}
      queueCount={queue.items.length}
      readOnly={readOnly}
      stopping={stopping}
      submitting={submitting}
      selectedVersion={selectedVersion}
      workflowState={workflowState}
      versions={versions}
      projectId={projectId}
      onAnalyze={analyze}
      onCandidateReport={() => setCandidateReportOpen(true)}
      onCompare={() => setCompareOpen(true)}
      onContinue={continueFromVersion}
      onDeleteVersion={() => { setError(""); setDeleteVersionOpen(true); }}
      onLogs={openTaskLog}
      onOpenQueue={() => setQueueOpen(true)}
      onRenameProject={() => { setError(""); setProjectTitle(project.title); setRenameProjectOpen(true); }}
      onRenameVersion={() => { setError(""); setVersionTitle(versions.find((version) => version.version === selectedVersion)?.remark ?? ""); setRenameVersionOpen(true); }}
      onShowParameters={() => setParametersOpen(true)}
      onSave={() => setSaveOpen(true)}
      onStop={stopAnalysis}
      onParameters={setParameters}
      onQueue={() => { setQueueRemark(""); setQueueSubmitOpen(true); }}
      onValidity={(valid, compilation) => setDslCompilation(valid && compilation ? compilation : null)}
      onVersion={selectVersion}
    />}>
      {activeWorkflow && workflowInstanceId
        ? <TaskLogPanel className="h-[calc(100dvh-9rem)] min-h-[32rem]" taskInstanceId={null} workflowInstanceId={workflowInstanceId} />
        : <FactorAnalysisResultsPanel
          displayedParameters={resultParameters}
          displayedState={displayedState}
          displayedWorkflowInstanceId={displayedWorkflowInstanceId}
          error={error}
          parameterError={resultParameterIssues.length ? `因子分析结果参数不完整：${resultParameterIssues.join("；")}` : null}
          readOnly={readOnly}
          running={running}
          workflowError={displayedWorkflowError}
        />}
    </AnalysisWorkspace>
    <SaveVersionDialog
      version={project.draft.version}
      open={saveOpen}
      remark={remark}
      submitting={saving}
      onClose={() => setSaveOpen(false)}
      onRemark={setRemark}
      onSave={saveVersion}
    />
    <VersionCompareDialog currentVersion={currentVersion} currentVersionNumber={currentVersion?.version ?? project.draft.version} kind="factor" loadVersion={(version) => factorApi.getVersion(projectId, version)} open={compareOpen} projectTitle={project.title} versions={versions} onOpenChange={setCompareOpen} />
    <FactorCandidateSelectionReport open={candidateReportOpen} onOpenChange={setCandidateReportOpen} projectId={projectId} projectTitle={project.title} versions={versions.filter((version) => version.saved)} />
    <RequestBodyDialog editable={!readOnly} endpoint={`/api/v1/factor/projects/${projectId}/analyses`} open={parametersOpen} value={storedParameters} validate={(value) => {
      if (isFactorAnalysisDraftParameters(value)) return null;
      const issues = factorAnalysisParameterIssues(value);
      return issues.length ? issues.join("；") : "因子分析参数结构无效";
    }} onApply={(value) => {
      if (isFactorAnalysisDraftParameters(value)) setParameters(structuredClone(value));
    }} onClose={() => setParametersOpen(false)} />
    <TaskLogModal open={logsOpen} workflowInstanceId={displayedWorkflowInstanceId} taskInstanceId={logTaskInstanceId} onOpenChange={setLogsOpen} />
    <RenameDialog description="项目名称会同步更新到项目列表和研究页面。" error={renameProjectOpen ? error : undefined} inputId="factor-project-title" label="项目名称" maxLength={128} open={renameProjectOpen} submitting={renaming} title="重命名项目" value={projectTitle} onOpenChange={setRenameProjectOpen} onRename={renameProject} onValue={setProjectTitle} />
    <RenameDialog description={`修改 v${selectedVersion ?? ""} 的显示名称，不影响版本参数和结果。`} error={renameVersionOpen ? error : undefined} inputId="factor-version-title" label="版本名称" maxLength={512} open={renameVersionOpen} submitting={renaming} title={`重命名版本 v${selectedVersion ?? ""}`} value={versionTitle} onOpenChange={setRenameVersionOpen} onRename={renameVersion} onValue={setVersionTitle} />
    <DeleteVersionDialog error={deleteVersionOpen ? error : undefined} open={deleteVersionOpen} submitting={deletingVersion} version={selectedVersion} onDelete={deleteVersion} onOpenChange={setDeleteVersionOpen} />
    <QueueSubmitDialog open={queueSubmitOpen} remark={queueRemark} submitting={queue.executing} onOpenChange={setQueueSubmitOpen} onRemark={setQueueRemark} onSubmit={submitToQueue} />
    <ExecutionQueuePanel executing={queue.executing} items={queue.items} loadError={queue.loadError} open={queueOpen} validate={isFactorAnalysisParameters} onDelete={queue.remove} onExecute={queue.execute} onOpenChange={setQueueOpen} onUpdate={queue.update} />
  </>;
}
function validAnalysisContract(parameters: FactorAnalysisParameters, document: DslDocument, catalog: DslCatalog | null) {
  if (!catalog) return false;
  const numericDerivatives = Object.entries(document.derivatives)
    .filter(([, node]) => catalog.operators.find((operator) => operator.op === node.op)?.output_kind !== "BOOL")
    .map(([name]) => name);
  const outputs = new Set([...document.factors, ...numericDerivatives]);
  return parameters.factor_columns.length > 0
    && parameters.factor_columns.every((column) => outputs.has(column))
    && parameters.return_columns.length > 0
    && parameters.return_columns.every((column) => {
      const node = parameters.dataset_query.derivatives[column];
      return node !== undefined && catalog.operators.find((operator) => operator.op === node.op)?.output_kind !== "BOOL";
    });
}
