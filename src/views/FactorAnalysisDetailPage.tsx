import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import IconLoaderCircle from "~icons/lucide/loader-circle";

import { factorApi } from "@/assets/lib/factor";
import { errorMessage } from "@/assets/lib/utils";
import { workflowsApi } from "@/assets/lib/workflows";
import AnalysisWorkspace from "@/components/layout/AnalysisWorkspace";
import RequestBodyDialog from "@/components/modal/RequestBodyDialog";
import SaveVersionDialog from "@/components/modal/SaveVersionDialog";
import VersionCompareDialog from "@/components/modal/VersionCompareDialog";
import TaskLogModal from "@/components/modal/TaskLogModal";
import FactorAnalysisControlsPanel from "@/components/panel/FactorAnalysisControlsPanel";
import FactorAnalysisResultsPanel from "@/components/panel/FactorAnalysisResultsPanel";
import ErrorPanel from "@/components/panel/ErrorPanel";
import { canNormalizeFactorAnalysisParameters, defaultAnalysisParameters, normalizeAnalysisParameters, type DslCatalog, type FactorAnalysisParameters, type FactorMetrics, type FactorProject, type FactorVersion, type FactorVersionListItem } from "@/types/factor";
import { terminalStates } from "@/types/workflow";

export default function FactorAnalysisDetailPage() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const [project, setProject] = useState<FactorProject | null>(null);
  const [versions, setVersions] = useState<FactorVersionListItem[]>([]);
  const [currentVersion, setCurrentVersion] = useState<FactorVersion | null>(null);
  const [catalog, setCatalog] = useState<DslCatalog | null>(null);
  const [parameters, setParameters] = useState<FactorAnalysisParameters>(defaultAnalysisParameters());
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [workflowInstanceId, setWorkflowInstanceId] = useState<number | null>(null);
  const [workflowState, setWorkflowState] = useState("IDLE");
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [logTaskInstanceId, setLogTaskInstanceId] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<FactorMetrics | null>(null);
  const [dslValid, setDslValid] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [parametersOpen, setParametersOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [logsOpen, setLogsOpen] = useState(false);
  const [error, setError] = useState("");
  const loadRequest = useRef(0);
  const versionRequest = useRef(0);
  const displayedWorkflowInstanceId = currentVersion?.workflow_instance_id ?? workflowInstanceId;
  const displayedParameters = useMemo(() => normalizeAnalysisParameters(currentVersion?.parameters ?? parameters), [currentVersion, parameters]);
  const resultParameters = useMemo(() => normalizeAnalysisParameters(currentVersion?.parameters ?? project?.draft?.parameters ?? parameters), [currentVersion, parameters, project?.draft?.parameters]);
  const displayedState = currentVersion ? "SUCCESS" : workflowState;
  const displayedWorkflowError = currentVersion ? null : workflowError;
  const readOnly = currentVersion !== null;
  const activeWorkflow = !currentVersion && workflowInstanceId !== null && !terminalStates.has(workflowState);
  const running = submitting || activeWorkflow;
  const analysisReady = dslValid && validAnalysisContract(parameters, catalog);
  const captureMetrics = useCallback((value: FactorMetrics) => setMetrics(value), []);

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

  async function load() {
    const requestId = ++loadRequest.current;
    setLoading(true);
    setError("");
    try {
      const [nextProject, nextVersions, nextCatalog] = await Promise.all([factorApi.getProject(projectId), factorApi.listVersions(projectId), factorApi.catalog()]);
      const nextCurrentVersion = !nextProject.draft && nextVersions[0] ? await factorApi.getVersion(projectId, nextVersions[0].version) : null;
      if (requestId !== loadRequest.current) return;
      setProject(nextProject);
      setVersions(nextVersions);
      setCurrentVersion(nextCurrentVersion);
      setCatalog(nextCatalog);
      setStopping(false);
      setSelectedVersion(null);
      setWorkflowInstanceId(null);
      setWorkflowState("IDLE");
      setWorkflowError(null);
      if (nextProject.draft) {
        setParameters(normalizeAnalysisParameters(nextProject.draft.parameters));
        setWorkflowInstanceId(nextProject.draft.workflow_instance_id);
        setWorkflowState(nextProject.draft.state);
        setWorkflowError(nextProject.draft.error);
      } else if (nextVersions[0]) {
        setSelectedVersion(nextVersions[0].version);
        if (nextCurrentVersion) setParameters(normalizeAnalysisParameters(nextCurrentVersion.parameters));
      }
    } catch (reason) { if (requestId === loadRequest.current) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (requestId === loadRequest.current) setLoading(false); }
  }

  async function analyze() {
    if (!analysisReady || running || readOnly) return;
    setSubmitting(true);
    setStopping(false);
    setError("");
    setMetrics(null);
    setWorkflowError(null);
    try {
      const submitted = await factorApi.analyze(projectId, normalizeAnalysisParameters(parameters));
      setWorkflowInstanceId(submitted.workflow_instance_id);
      setWorkflowState("SUBMITTED_SUCCESS");
      setSelectedVersion(null);
      const refreshed = await factorApi.getProject(projectId);
      setProject(refreshed);
      if (refreshed.draft) setParameters(normalizeAnalysisParameters(refreshed.draft.parameters));
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
    if (!workflowInstanceId || !metrics || saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await factorApi.saveVersion(projectId, workflowInstanceId, remark, metrics);
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
    setParameters(normalizeAnalysisParameters(structuredClone(currentVersion.parameters)));
    setCurrentVersion(null);
    setSelectedVersion(null);
    setWorkflowInstanceId(project?.draft?.workflow_instance_id ?? null);
    setWorkflowState(project?.draft?.state ?? "IDLE");
    setWorkflowError(project?.draft?.error ?? null);
    setMetrics(null);
    setError("");
  }

  async function selectVersion(version: number | null) {
    const requestId = ++versionRequest.current;
    setMetrics(null);
    setError("");
    if (version === null) {
      setCurrentVersion(null);
      setSelectedVersion(null);
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
      metrics={metrics}
      project={project}
      readOnly={readOnly}
      stopping={stopping}
      submitting={submitting}
      selectedVersion={selectedVersion}
      workflowState={workflowState}
      versions={versions}
      projectId={projectId}
      onAnalyze={analyze}
      onCompare={() => setCompareOpen(true)}
      onContinue={continueFromVersion}
      onLogs={openTaskLog}
      onShowParameters={() => setParametersOpen(true)}
      onSave={() => setSaveOpen(true)}
      onStop={stopAnalysis}
      onParameters={setParameters}
      onValidity={setDslValid}
      onVersion={selectVersion}
    />}>
      <FactorAnalysisResultsPanel
        displayedParameters={resultParameters}
        displayedState={displayedState}
        displayedWorkflowInstanceId={displayedWorkflowInstanceId}
        error={error}
        readOnly={readOnly}
        running={running}
        workflowError={displayedWorkflowError}
        onMetrics={captureMetrics}
      />
    </AnalysisWorkspace>
    <SaveVersionDialog
      latestVersion={project.latest_version}
      open={saveOpen}
      remark={remark}
      submitting={saving}
      onClose={() => setSaveOpen(false)}
      onRemark={setRemark}
      onSave={saveVersion}
    />
    <VersionCompareDialog currentVersion={currentVersion} kind="factor" loadVersion={(version) => factorApi.getVersion(projectId, version)} open={compareOpen} projectTitle={project.title} versions={versions} onOpenChange={setCompareOpen} />
    <RequestBodyDialog editable={!readOnly} endpoint={`/api/v1/factor/projects/${projectId}/analyses`} open={parametersOpen} value={displayedParameters} validate={(value) => canNormalizeFactorAnalysisParameters(value) ? null : "因子分析参数结构不完整。"} onApply={(value) => setParameters(normalizeAnalysisParameters(value))} onClose={() => setParametersOpen(false)} />
    <TaskLogModal open={logsOpen} workflowInstanceId={displayedWorkflowInstanceId} taskInstanceId={logTaskInstanceId} onOpenChange={setLogsOpen} />
  </>;
}
function validAnalysisContract(parameters: FactorAnalysisParameters, catalog: DslCatalog | null) {
  if (!catalog) return false;
  const numericDerivatives = Object.entries(parameters.dataset_query.derivatives)
    .filter(([, node]) => catalog.operators.find((operator) => operator.op === node.op)?.output_kind !== "BOOL")
    .map(([name]) => name);
  const outputs = new Set([...parameters.dataset_query.factors, ...numericDerivatives]);
  const derivatives = new Set(numericDerivatives);
  return parameters.codes_query !== null
    && parameters.factor_columns.length > 0
    && parameters.factor_columns.every((column) => outputs.has(column))
    && parameters.return_columns.length > 0
    && parameters.return_columns.every((column) => derivatives.has(column));
}
