import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { queryApi } from "@/assets/lib/query";
import { errorMessage } from "@/assets/lib/utils";
import { workflowsApi } from "@/assets/lib/workflows";
import AnalysisWorkspace from "@/components/layout/AnalysisWorkspace";
import RequestBodyDialog from "@/components/modal/RequestBodyDialog";
import TaskLogModal from "@/components/modal/TaskLogModal";
import QueryControlsPanel from "@/components/panel/QueryControlsPanel";
import ErrorPanel from "@/components/panel/ErrorPanel";
import QueryResultPanel from "@/components/panel/QueryResultPanel";
import { isFactorQuery, type FactorQuery } from "@/types/factor";
import { defaultQueryParameters, type QueryCatalog, type QueryProject } from "@/types/query";
import { terminalStates } from "@/types/workflow";

export default function QueryDetailPage() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const [project, setProject] = useState<QueryProject | null>(null);
  const [catalog, setCatalog] = useState<QueryCatalog | null>(null);
  const [parameters, setParameters] = useState<FactorQuery>(defaultQueryParameters());
  const [dslValid, setDslValid] = useState(true);
  const [workflowInstanceId, setWorkflowInstanceId] = useState<number | null>(null);
  const [workflowState, setWorkflowState] = useState("IDLE");
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [logTaskInstanceId, setLogTaskInstanceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [parametersOpen, setParametersOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [error, setError] = useState("");
  const loadRequest = useRef(0);
  const activeWorkflow = workflowInstanceId !== null && !terminalStates.has(workflowState);
  const running = submitting || activeWorkflow;

  useEffect(() => {
    if (!Number.isInteger(projectId) || projectId <= 0) { navigate("/query", { replace: true }); return; }
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
        const nextProject = terminalStates.has(workflow.state) ? await queryApi.getProject(projectId) : null;
        if (disposed) return;
        setError("");
        setWorkflowState(workflow.state);
        setWorkflowError(workflow.error);
        if (nextProject) {
          setStopping(false);
          window.clearInterval(timer);
          setProject(nextProject);
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
      const [nextProject, nextCatalog] = await Promise.all([queryApi.getProject(projectId), queryApi.catalog()]);
      if (requestId !== loadRequest.current) return;
      setProject(nextProject);
      setCatalog(nextCatalog);
      setStopping(false);
      setWorkflowInstanceId(null);
      setWorkflowState("IDLE");
      setWorkflowError(null);
      if (nextProject.current) {
        setParameters(nextProject.current.parameters);
        setWorkflowInstanceId(nextProject.current.workflow_instance_id);
        setWorkflowState(nextProject.current.state);
        setWorkflowError(nextProject.current.error);
      }
    } catch (reason) { if (requestId === loadRequest.current) setError(errorMessage(reason)); }
    finally { if (requestId === loadRequest.current) setLoading(false); }
  }

  async function runQuery() {
    if (!dslValid || running) return;
    setSubmitting(true);
    setStopping(false);
    setError("");
    setWorkflowError(null);
    try {
      const submitted = await queryApi.run(projectId, parameters);
      setWorkflowInstanceId(submitted.workflow_instance_id);
      setWorkflowState("SUBMITTED_SUCCESS");
      const nextProject = await queryApi.getProject(projectId);
      setProject(nextProject);
      setWorkflowState(nextProject.current?.state ?? "SUBMITTED_SUCCESS");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSubmitting(false); }
  }

  async function stopQuery() {
    if (!workflowInstanceId || !activeWorkflow || stopping) return;
    setStopping(true);
    setError("");
    try {
      const response = await workflowsApi.stop(workflowInstanceId);
      setWorkflowState(response.workflow.state);
      setWorkflowError(response.workflow.error);
      if (terminalStates.has(response.workflow.state)) {
        setStopping(false);
        setProject(await queryApi.getProject(projectId));
      }
    } catch (reason) {
      setStopping(false);
      setError(errorMessage(reason));
    }
  }

  function openTaskLog() {
    if (!workflowInstanceId) return;
    setLogTaskInstanceId(null);
    setLogsOpen(true);
  }

  if (loading) return <div className="grid min-h-[calc(100vh-4rem)] place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (!project || !catalog) return <div className="mx-auto w-full max-w-xl py-20"><ErrorPanel message={error} /></div>;

  return <>
    <AnalysisWorkspace backTo="/query" sidebar={<QueryControlsPanel activeWorkflow={activeWorkflow} catalog={catalog} dslValid={dslValid} parameters={parameters} project={project} projectId={projectId} stopping={stopping} submitting={submitting} workflowInstanceId={workflowInstanceId} workflowState={workflowState} onLogs={openTaskLog} onParameters={setParameters} onRun={runQuery} onShowParameters={() => setParametersOpen(true)} onStop={stopQuery} onValidity={setDslValid} />} sidebarLabel="查询参数">
      <QueryResultPanel error={error} running={running} state={workflowState} timeColumn="time" workflowError={workflowError} workflowInstanceId={workflowInstanceId} />
    </AnalysisWorkspace>
    <RequestBodyDialog editable endpoint={`/api/v1/query/projects/${projectId}/queries`} open={parametersOpen} value={parameters} validate={(value) => isFactorQuery(value) ? null : "查询参数结构不完整。"} onApply={setParameters} onClose={() => setParametersOpen(false)} />
    <TaskLogModal open={logsOpen} workflowInstanceId={workflowInstanceId} taskInstanceId={logTaskInstanceId} onOpenChange={setLogsOpen} />
  </>;
}
