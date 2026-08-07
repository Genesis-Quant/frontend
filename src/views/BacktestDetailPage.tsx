import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { backtestApi, isBacktestParameters, validBacktestParameters } from "@/assets/lib/backtest";
import { errorMessage } from "@/assets/lib/utils";
import { workflowsApi } from "@/assets/lib/workflows";
import AnalysisWorkspace from "@/components/layout/AnalysisWorkspace";
import RequestBodyDialog from "@/components/modal/RequestBodyDialog";
import SaveVersionDialog from "@/components/modal/SaveVersionDialog";
import VersionCompareDialog from "@/components/modal/VersionCompareDialog";
import TaskLogModal from "@/components/modal/TaskLogModal";
import BacktestControlsPanel from "@/components/panel/BacktestControlsPanel";
import BacktestResultsPanel from "@/components/panel/BacktestResultsPanel";
import ErrorPanel from "@/components/panel/ErrorPanel";
import { defaultBacktestParameters, type BacktestParameters, type BacktestProject, type BacktestSummary, type BacktestVersion, type BacktestVersionListItem } from "@/types/backtest";
import type { DslCatalog } from "@/types/factor";
import { terminalStates } from "@/types/workflow";

export default function BacktestDetailPage() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
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
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [editorValid, setEditorValid] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [parametersOpen, setParametersOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");
  const loadRequest = useRef(0);
  const versionRequest = useRef(0);
  const displayedWorkflowInstanceId = currentVersion?.workflow_instance_id ?? workflowInstanceId;
  const displayedParameters = currentVersion?.parameters ?? parameters;
  const resultParameters = currentVersion?.parameters ?? project?.draft?.parameters ?? parameters;
  const displayedState = currentVersion ? "SUCCESS" : workflowState;
  const displayedWorkflowError = currentVersion ? null : workflowError;
  const readOnly = currentVersion !== null;
  const activeWorkflow = !currentVersion && workflowInstanceId !== null && !terminalStates.has(workflowState);
  const running = submitting || activeWorkflow;
  const ready = editorValid && validBacktestParameters(parameters);
  const captureSummary = useCallback((value: BacktestSummary) => setSummary(value), []);

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

  async function load() {
    const requestId = ++loadRequest.current;
    setLoading(true);
    setError("");
    try {
      const [nextProject, nextVersions, nextCatalog] = await Promise.all([backtestApi.getProject(projectId), backtestApi.listVersions(projectId), backtestApi.catalog()]);
      const nextCurrentVersion = !nextProject.draft && nextVersions[0] ? await backtestApi.getVersion(projectId, nextVersions[0].version) : null;
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
        setParameters(nextProject.draft.parameters);
        setWorkflowInstanceId(nextProject.draft.workflow_instance_id);
        setWorkflowState(nextProject.draft.state);
        setWorkflowError(nextProject.draft.error);
      } else if (nextVersions[0]) {
        setSelectedVersion(nextVersions[0].version);
        if (nextCurrentVersion) setParameters(nextCurrentVersion.parameters);
      }
    } catch (reason) { if (requestId === loadRequest.current) setError(errorMessage(reason)); }
    finally { if (requestId === loadRequest.current) setLoading(false); }
  }

  async function run() {
    if (!ready || running || readOnly) return;
    setSubmitting(true);
    setStopping(false);
    setError("");
    setWorkflowError(null);
    setSummary(null);
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
    if (!workflowInstanceId || !summary || saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await backtestApi.saveVersion(projectId, workflowInstanceId, remark, summary);
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
    setSummary(null);
    setError("");
  }

  async function selectVersion(version: number | null) {
    const requestId = ++versionRequest.current;
    setSummary(null);
    setError("");
    if (version === null) {
      setCurrentVersion(null);
      setSelectedVersion(null);
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
    <AnalysisWorkspace backTo="/backtest" sidebar={<BacktestControlsPanel activeWorkflow={activeWorkflow} catalog={catalog} displayedParameters={displayedParameters} displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} project={project} projectId={projectId} readOnly={readOnly} ready={ready} selectedVersion={selectedVersion} stopping={stopping} submitting={submitting} summary={summary} workflowState={workflowState} versions={versions} onCompare={() => setCompareOpen(true)} onContinue={continueFromVersion} onLogs={openTaskLog} onParameters={setParameters} onRun={run} onSave={() => setSaveOpen(true)} onShowParameters={() => setParametersOpen(true)} onStop={stopBacktest} onValidity={setEditorValid} onVersion={selectVersion} />}>
      <BacktestResultsPanel annualTradingDays={resultParameters.annual_trading_days} displayedState={displayedState} displayedWorkflowInstanceId={displayedWorkflowInstanceId} error={error} readOnly={readOnly} riskFreeRate={resultParameters.risk_free_rate} running={running} workflowError={displayedWorkflowError} onSummary={captureSummary} />
    </AnalysisWorkspace>
    <SaveVersionDialog latestVersion={project.latest_version} open={saveOpen} remark={remark} submitting={saving} onClose={() => setSaveOpen(false)} onRemark={setRemark} onSave={saveVersion} />
    <VersionCompareDialog currentVersion={currentVersion} kind="backtest" loadVersion={(version) => backtestApi.getVersion(projectId, version)} open={compareOpen} projectTitle={project.title} versions={versions} onOpenChange={setCompareOpen} />
    <RequestBodyDialog editable={!readOnly} endpoint={`/api/v1/backtest/projects/${projectId}/runs`} open={parametersOpen} value={displayedParameters} validate={(value) => isBacktestParameters(value) ? null : "回测参数结构不完整。"} onApply={setParameters} onClose={() => setParametersOpen(false)} />
    <TaskLogModal open={logsOpen} workflowInstanceId={displayedWorkflowInstanceId} taskInstanceId={logTaskInstanceId} onOpenChange={setLogsOpen} />
  </>;
}
