import { CalendarRange, Gauge, Loader2, Play, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { backtestApi, canDeleteBacktestAnalysis } from "@/assets/lib/backtest";
import { OptimizationAnalytics, optimizationAlgorithmLabels, type OptimizationReportData } from "@/assets/lib/optimization";
import { errorMessage } from "@/assets/lib/utils";
import { workflowsApi } from "@/assets/lib/workflows";
import DeleteConfirmationDialog from "@/components/modal/DeleteConfirmationDialog";
import { AnalysisHistoryItem, AnalysisHistoryPanel } from "@/components/panel/AnalysisHistoryPanel";
import OptimizationReport from "@/components/panel/OptimizationReport";
import { AppPagination } from "@/components/pagination/AppPagination";
import SchedulerState from "@/components/status/SchedulerState";
import { optimizationAlgorithms, type BacktestOptimization, type BacktestParameters, type OptimizationAlgorithm, type OptimizationSettings } from "@/types/backtest";
import { terminalStates } from "@/types/workflow";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Checkbox } from "@/ui/checkbox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, LargeDialogContent } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

type ParameterOptimizationDialogProps = {
  baseParameters: BacktestParameters;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: number;
  projectTitle: string;
  version: number | null;
};

const successStates = new Set(["SUCCESS"]);
const historyPageSize = 20;

export default function ParameterOptimizationDialog({ baseParameters, onOpenChange, open, projectId, projectTitle, version }: ParameterOptimizationDialogProps) {
  const numericParameters = useMemo(() => Object.entries(baseParameters.params).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])), [baseParameters.params]);
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [algorithms, setAlgorithms] = useState<OptimizationAlgorithm[]>([]);
  const [startDate, setStartDate] = useState(baseParameters.dataset_query.start_date);
  const [endDate, setEndDate] = useState(baseParameters.dataset_query.end_date);
  const [lookbackPeriod, setLookbackPeriod] = useState("6M");
  const [holdingPeriod, setHoldingPeriod] = useState("2W");
  const [repetitions, setRepetitions] = useState("5");
  const [evaluationBudget, setEvaluationBudget] = useState("20");
  const [seed, setSeed] = useState("20260815");
  const [history, setHistory] = useState<BacktestOptimization[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [report, setReport] = useState<BacktestOptimization | null>(null);
  const [reportData, setReportData] = useState<OptimizationReportData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BacktestOptimization | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [error, setError] = useState("");
  const historyRequest = useRef(0);
  const reportRequest = useRef(0);
  const analytics = useRef<OptimizationAnalytics | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedParameters([]);
    setParameterValues({});
    setAlgorithms([]);
    setStartDate(baseParameters.dataset_query.start_date);
    setEndDate(baseParameters.dataset_query.end_date);
    setLookbackPeriod("6M");
    setHoldingPeriod("2W");
    setRepetitions("5");
    setEvaluationBudget("20");
    setSeed("20260815");
    setReport(null);
    setReportData(null);
    setHistory([]);
    setHistoryTotal(0);
    setLoadingHistory(false);
    historyRequest.current += 1;
    setHistoryPage(1);
    setDeleteTarget(null);
    setDeleting(false);
    setDeleteError("");
    setError("");
  }, [baseParameters, open, projectId, version]);

  useEffect(() => {
    if (!open || version === null) return;
    loadHistory(historyPage);
  }, [historyPage, open, projectId, version]);

  useEffect(() => {
    if (!open || !report || terminalStates.has(report.state)) return undefined;
    let disposed = false;
    let polling = false;
    const refresh = async () => {
      if (polling) return;
      polling = true;
      try {
        const status = await workflowsApi.workspaceStatus(report.workflow_workspace_id);
        if (disposed) return;
        if (terminalStates.has(status.state)) {
          const current = await backtestApi.getOptimization(report.id);
          if (disposed) return;
          setReport(current);
          setHistory((items) => items.map((item) => item.id === current.id ? current : item));
        } else {
          setReport((current) => current?.id === report.id ? { ...current, workflow_instance_id: status.workflow_instance_id, state: status.state, error: status.error, updated_at: status.updated_at } : current);
        }
        setError("");
      } catch (reason) {
        if (!disposed) setError(errorMessage(reason));
      } finally {
        polling = false;
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [open, report?.id, report?.state, report?.workflow_workspace_id]);

  useEffect(() => {
    const requestId = ++reportRequest.current;
    analytics.current?.close();
    analytics.current = null;
    setReportData(null);
    if (!open || !report || !successStates.has(report.state)) {
      setLoadingReport(false);
      return undefined;
    }
    let disposed = false;
    setLoadingReport(true);
    setError("");
    backtestApi.optimizationOutputs(report.id).then(async (outputs) => {
      const buffers = await Promise.all(outputs.map(async (output) => [output.name, await backtestApi.optimizationOutput(report.id, output.name)] as const));
      const nextAnalytics = await OptimizationAnalytics.create(report.id, Object.fromEntries(buffers));
      if (disposed || requestId !== reportRequest.current) { await nextAnalytics.close(); return; }
      analytics.current = nextAnalytics;
      const data = await nextAnalytics.report(report.parameters.annual_trading_days, report.parameters.risk_free_rate);
      if (!disposed && requestId === reportRequest.current) setReportData(data);
    }).catch((reason) => { if (!disposed && requestId === reportRequest.current) setError(errorMessage(reason)); })
      .finally(() => { if (!disposed && requestId === reportRequest.current) setLoadingReport(false); });
    return () => { disposed = true; };
  }, [open, report?.id, report?.state]);

  useEffect(() => () => { analytics.current?.close(); }, []);

  async function loadHistory(page: number) {
    if (version === null) return;
    const requestId = ++historyRequest.current;
    setLoadingHistory(true);
    try {
      const result = await backtestApi.listOptimizations(projectId, version, page, historyPageSize);
      if (requestId !== historyRequest.current) return;
      setHistory(result.items);
      setHistoryTotal(result.total);
      setError("");
    } catch (reason) {
      if (requestId === historyRequest.current) setError(errorMessage(reason));
    } finally {
      if (requestId === historyRequest.current) setLoadingHistory(false);
    }
  }

  async function submit() {
    if (version === null || submitting) return;
    const parsed = buildSettings();
    if (typeof parsed === "string") { setError(parsed); return; }
    setSubmitting(true);
    setError("");
    try {
      const created = await backtestApi.createOptimization(projectId, version, parsed);
      setReport(created);
      setHistoryPage(1);
      setHistory((items) => [created, ...items.filter((item) => item.id !== created.id)].slice(0, historyPageSize));
      setHistoryTotal((total) => total + 1);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteOptimization() {
    if (!deleteTarget || deleting) return;
    const optimizationId = deleteTarget.id;
    setDeleting(true);
    setDeleteError("");
    try {
      await backtestApi.deleteOptimization(optimizationId);
      const remainingTotal = Math.max(0, historyTotal - 1);
      const remainingPages = Math.max(1, Math.ceil(remainingTotal / historyPageSize));
      setHistory((items) => items.filter((item) => item.id !== optimizationId));
      setHistoryTotal(remainingTotal);
      if (report?.id === optimizationId) {
        analytics.current?.close();
        analytics.current = null;
        setReport(null);
        setReportData(null);
      }
      setDeleteTarget(null);
      if (historyPage > remainingPages) setHistoryPage(remainingPages);
    } catch (reason) {
      setDeleteError(errorMessage(reason));
    } finally {
      setDeleting(false);
    }
  }

  function buildSettings(): OptimizationSettings | string {
    if (!selectedParameters.length) return "请至少选择一个需要调优的策略参数";
    if (!algorithms.length) return "请至少选择一种调优算法";
    const parameterSpace: Record<string, number[]> = {};
    for (const name of selectedParameters) {
      const values = parseNumbers(parameterValues[name] ?? "");
      if (typeof values === "string") return `${name}：${values}`;
      parameterSpace[name] = values;
    }
    const combinationCount = Object.values(parameterSpace).reduce((total, values) => total * values.length, 1);
    if (combinationCount > 100_000) return `参数空间包含 ${combinationCount} 个组合，最多允许 100000 个`;
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) return "请选择有效的开始日期和截止日期";
    const normalizedLookback = normalizePeriod(lookbackPeriod);
    const normalizedHolding = normalizePeriod(holdingPeriod);
    if (!normalizedLookback || !normalizedHolding) return "回看周期和持有周期必须使用 D、W、M 或 Y，例如 30D、2W、6M";
    const repeatCount = integerInRange(repetitions, 1, 100);
    const budget = integerInRange(evaluationBudget, 2, 100);
    const randomSeed = integerInRange(seed, 0, 2_147_483_647);
    if (repeatCount === null) return "重复次数必须是 1 到 100 的整数";
    if (budget === null) return "每个窗口评估组合数必须是 2 到 100 的整数";
    if (randomSeed === null) return "随机种子必须是 0 到 2147483647 的整数";
    return { parameter_space: parameterSpace, algorithms, start_date: startDate, end_date: endDate, lookback_period: normalizedLookback, holding_period: normalizedHolding, repetitions: repeatCount, evaluation_budget: budget, seed: randomSeed };
  }

  function toggleParameter(name: string, checked: boolean) {
    setSelectedParameters((current) => checked ? [...current, name] : current.filter((item) => item !== name));
    if (checked && !(name in parameterValues)) setParameterValues((current) => ({ ...current, [name]: "" }));
  }

  function toggleAlgorithm(algorithm: OptimizationAlgorithm, checked: boolean) {
    setAlgorithms((current) => checked ? [...current, algorithm] : current.filter((item) => item !== algorithm));
  }

  const historyPages = Math.max(1, Math.ceil(historyTotal / historyPageSize));
  const reportRunning = report !== null && !terminalStates.has(report.state);

  return <>
  <Dialog open={open} onOpenChange={onOpenChange}>
    <LargeDialogContent className="flex flex-col overflow-hidden">
      <DialogHeader className="shrink-0 border-b pb-3 pr-8">
        <DialogTitle>{projectTitle} · v{version ?? "—"} · 参数调优</DialogTitle>
        <DialogDescription>在滚动训练窗口内选择参数，再用紧随其后的持有窗口形成严格样本外净值路径。</DialogDescription>
      </DialogHeader>
      {report
        ? <div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="space-y-4 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-3"><SchedulerState state={report.state} /><span className="text-sm text-muted-foreground">报告 #{report.id}</span><span className="text-sm text-muted-foreground">Workspace #{report.workflow_workspace_id}</span>{report.workflow_instance_id ? <span className="text-sm text-muted-foreground">Workflow #{report.workflow_instance_id}</span> : null}</div>
            <div className="flex items-center gap-2"><Button size="sm" variant="destructive" disabled={!canDeleteBacktestAnalysis(report.state)} onClick={() => { setDeleteError(""); setDeleteTarget(report); }}><Trash2 />删除报告</Button><Button size="sm" variant="outline" disabled={reportRunning} onClick={() => { setReport(null); setReportData(null); setError(""); }}><RotateCcw />新建调优</Button></div>
          </div>
          <div className="grid gap-3 rounded-md border bg-muted/20 p-4 text-sm md:grid-cols-4"><Info label="区间" value={`${report.parameters.start_date} → ${report.parameters.end_date}`} /><Info label="滚动窗口" value={`${report.parameters.lookback_period} 回看 / ${report.parameters.holding_period} 持有`} /><Info label="重复" value={`${report.parameters.repetitions} 次`} /><Info label="算法" value={`${report.parameters.algorithms.length} 种`} /></div>
          {report.error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{report.error}</div> : null}
          {reportRunning ? <LoadingPanel label="参数调优工作流正在运行..." /> : loadingReport ? <LoadingPanel label="DuckDB 正在读取并汇总全部算法结果..." /> : reportData ? <OptimizationReport data={reportData} /> : null}
          {error ? <ErrorMessage message={error} /> : null}
          </div></div>
        : <div className="grid min-h-0 flex-1 gap-4 pt-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-4 xl:grid-cols-[minmax(20rem,.85fr)_minmax(0,1.15fr)]">
              <div className="space-y-4">
                <Card className="gap-3 rounded-md py-3"><CardHeader className="px-3.5"><CardTitle className="flex items-center justify-between text-sm font-medium"><span>调优参数</span><span className="text-xs font-normal tabular-nums text-muted-foreground">已选 {selectedParameters.length}</span></CardTitle></CardHeader><CardContent className="space-y-2 px-3.5">{numericParameters.length ? numericParameters.map(([name, value]) => { const checked = selectedParameters.includes(name); return <div className="rounded-md border bg-background p-2.5" key={name}><div className="flex items-center gap-2.5"><Checkbox checked={checked} onCheckedChange={(next) => toggleParameter(name, next === true)} id={`optimization-parameter-${name}`} /><Label className="min-w-0 flex-1" htmlFor={`optimization-parameter-${name}`}><span className="truncate font-mono text-xs">{name}</span><span className="ml-auto font-mono text-xs text-muted-foreground">{value}</span></Label></div>{checked ? <Input className="mt-2" id={`optimization-values-${name}`} value={parameterValues[name] ?? ""} onChange={(event) => setParameterValues((current) => ({ ...current, [name]: event.target.value }))} /> : null}</div>; }) : <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">当前版本没有可调优的数值型策略参数</div>}</CardContent></Card>
                <Card className="gap-3 rounded-md py-3"><CardHeader className="px-3.5"><CardTitle className="flex items-center gap-2 text-sm font-medium"><CalendarRange className="size-4" />滚动区间</CardTitle></CardHeader><CardContent className="grid gap-3 px-3.5 sm:grid-cols-2"><Field label="开始日期"><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field><Field label="截止日期"><Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field><Field label="回看周期"><Input value={lookbackPeriod} onChange={(event) => setLookbackPeriod(event.target.value)} /></Field><Field label="持有周期"><Input value={holdingPeriod} onChange={(event) => setHoldingPeriod(event.target.value)} /></Field><Field label="重复次数"><Input inputMode="numeric" value={repetitions} onChange={(event) => setRepetitions(event.target.value)} /></Field><Field label="每窗口评估组合"><Input inputMode="numeric" value={evaluationBudget} onChange={(event) => setEvaluationBudget(event.target.value)} /></Field><Field label="随机种子"><Input inputMode="numeric" value={seed} onChange={(event) => setSeed(event.target.value)} /></Field></CardContent></Card>
              </div>
              <Card className="h-full gap-3 rounded-md py-3"><CardHeader className="px-3.5"><CardTitle className="flex items-center justify-between text-sm font-medium"><span>调优算法</span><span className="text-xs font-normal tabular-nums text-muted-foreground">已选 {algorithms.length} / {optimizationAlgorithms.length}</span></CardTitle></CardHeader><CardContent className="grid flex-1 auto-rows-fr gap-2 px-3.5 sm:grid-cols-2 xl:grid-cols-3">{optimizationAlgorithms.map((algorithm) => <Label className="cursor-pointer rounded-md border bg-background px-2.5 py-2 transition-colors hover:bg-muted/50" htmlFor={`optimization-algorithm-${algorithm}`} key={algorithm}><Checkbox checked={algorithms.includes(algorithm)} id={`optimization-algorithm-${algorithm}`} onCheckedChange={(next) => toggleAlgorithm(algorithm, next === true)} /><span className="text-xs leading-4">{optimizationAlgorithmLabels[algorithm]}</span></Label>)}</CardContent></Card>
            </div>
            </div>
            <div className="mt-3 shrink-0 space-y-3 border-t pt-3">{error ? <ErrorMessage message={error} /> : null}<DialogFooter><Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>取消</Button><Button disabled={submitting || version === null || !numericParameters.length} onClick={submit}>{submitting ? <Loader2 className="animate-spin" /> : <Play />}提交参数调优</Button></DialogFooter></div>
          </div>
          <AnalysisHistoryPanel count={historyTotal} emptyMessage="当前版本还没有参数调优报告" footer={historyPages > 1 ? <AppPagination page={historyPage} pageSize={historyPageSize} pageSizeOptions={[historyPageSize]} totalPages={historyPages} onPageChange={setHistoryPage} onPageSizeChange={() => undefined} /> : undefined} loading={loadingHistory} title="历史报告">
            {history.map((item) => <AnalysisHistoryItem deleteDisabled={!canDeleteBacktestAnalysis(item.state)} deleteLabel={`删除参数调优报告 ${item.id}`} description={`${item.parameters.start_date} → ${item.parameters.end_date} · ${item.parameters.repetitions} 次`} icon={Gauge} key={item.id} onDelete={() => { setDeleteError(""); setDeleteTarget(item); }} onOpen={() => { setReport(item); setError(""); }} state={item.state} title={`报告 #${item.id} · ${item.parameters.algorithms.length} 种算法`} />)}
          </AnalysisHistoryPanel>
        </div>}
    </LargeDialogContent>
  </Dialog>
  <DeleteConfirmationDialog actionLabel="删除报告" description={`将永久删除参数调优报告 #${deleteTarget?.id ?? ""}、关联工作流和全部算法结果文件。该操作不可撤销。`} error={deleteError} open={deleteTarget !== null} submitting={deleting} title={`删除参数调优报告 #${deleteTarget?.id ?? ""}`} onDelete={deleteOptimization} onOpenChange={(nextOpen) => { if (!nextOpen && !deleting) { setDeleteTarget(null); setDeleteError(""); } }} />
  </>;
}

function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-medium">{value}</div></div>; }
function LoadingPanel({ label }: { label: string }) { return <div className="grid min-h-64 place-items-center rounded-md border bg-card"><div className="text-center"><Loader2 className="mx-auto animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">{label}</p></div></div>; }
function ErrorMessage({ message }: { message: string }) { return <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{message}</div>; }
function parseNumbers(value: string): number[] | string { const values = value.split(/[，,\s]+/).filter(Boolean).map(Number); if (values.length < 2) return "至少输入两个候选数值"; if (values.length > 100) return "候选列表最多包含 100 个数值"; if (values.some((item) => !Number.isFinite(item))) return "候选列表只能包含数值"; if (new Set(values).size !== values.length) return "候选列表不能包含重复值"; return values; }
function normalizePeriod(value: string) { const match = /^(?:P)?([1-9]\d*)([DWMY])$/i.exec(value.trim()); return match ? `${Number(match[1])}${match[2].toUpperCase()}` : null; }
function integerInRange(value: string, minimum: number, maximum: number) { const number = Number(value); return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null; }
function validDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }
