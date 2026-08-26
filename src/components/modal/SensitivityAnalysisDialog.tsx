import { useEffect, useMemo, useRef, useState } from "react";
import { Grid2X2, Loader2, RefreshCw, SlidersHorizontal, Table2, Trash2, X } from "lucide-react";

import { backtestApi, canDeleteBacktestAnalysis } from "@/assets/lib/backtest";
import { SensitivityAnalytics, type SensitivityResultRow } from "@/assets/lib/sensitivity";
import { errorMessage } from "@/assets/lib/utils";
import { workflowsApi } from "@/assets/lib/workflows";
import EChart from "@/components/chart/EChart";
import DeleteConfirmationDialog from "@/components/modal/DeleteConfirmationDialog";
import { AnalysisHistoryItem, AnalysisHistoryPanel } from "@/components/panel/AnalysisHistoryPanel";
import SchedulerState from "@/components/status/SchedulerState";
import type { BacktestParameters, BatchResearchListItem, BatchResearchResponse, StrategyParameters } from "@/types/backtest";
import { terminalStates } from "@/types/workflow";
import { Button } from "@/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, LargeDialogContent } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";

const MAX_GRID_POINTS = 100;
const successStates = new Set(["SUCCESS"]);

type Scalar = string | number | boolean | null;
type ParameterKind = "number" | "category";
type ParameterDefinition = {
  baseValue: Scalar;
  kind: ParameterKind;
  label: string;
  options?: Scalar[];
  path: string;
};
type DimensionDraft = { path: string; values: string };
type SensitivityDimension = { kind: ParameterKind; label: string; path: string; values: Scalar[] };
type SensitivityMetric = { format: "number" | "percent"; key: keyof SensitivityResultRow["metrics"]; label: string };
type SensitivityPoint = SensitivityResultRow;
type StrategyGridItem = { parameters: StrategyParameters };

type SensitivityAnalysisDialogProps = {
  baseParameters: BacktestParameters;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: number;
  projectTitle: string;
  version: number | null;
};

function sensitivityMetrics(): SensitivityMetric[] { return [
  { key: "totalReturn", label: "累计收益", format: "percent" },
  { key: "cagr", label: "年化收益", format: "percent" },
  { key: "sharpe", label: "年化 Sharpe", format: "number" },
  { key: "volatility", label: "年化波动", format: "percent" },
  { key: "maxDrawdown", label: "最大回撤", format: "percent" },
  { key: "winRate", label: "日胜率", format: "percent" },
  { key: "calmar", label: "Calmar 比率", format: "number" }
]; }

export default function SensitivityAnalysisDialog({ baseParameters, onOpenChange, open, projectId, projectTitle, version }: SensitivityAnalysisDialogProps) {
  const definitions = useMemo(() => parameterDefinitions(baseParameters.params), [baseParameters.params]);
  const metrics = useMemo(() => sensitivityMetrics(), []);
  const [drafts, setDrafts] = useState<DimensionDraft[]>([]);
  const [description, setDescription] = useState("");
  const [batch, setBatch] = useState<BatchResearchResponse | null>(null);
  const [history, setHistory] = useState<BatchResearchListItem[]>([]);
  const [results, setResults] = useState<SensitivityPoint[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingHistoryResearchId, setLoadingHistoryResearchId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BatchResearchListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [error, setError] = useState("");
  const resultRequest = useRef(0);
  const analytics = useRef<SensitivityAnalytics | null>(null);

  const grid = useMemo(() => buildGrid(baseParameters.params, drafts, definitions), [baseParameters.params, definitions, drafts]);
  const batchItems = useMemo(() => grid.items.map((item) => ({ parameters: { ...baseParameters, params: item.parameters } })), [baseParameters, grid.items]);

  useEffect(() => {
    if (!open) return;
    const first = definitions[0];
    setDrafts(first ? [{ path: first.path, values: defaultValues(first) }] : []);
    setDescription("");
    setBatch(null);
    setResults([]);
    setHistory([]);
    setError("");
    setSubmitting(false);
    setLoadingResults(false);
    setLoadingHistoryResearchId(null);
    setDeleteTarget(null);
    setDeleting(false);
    setDeleteError("");
  }, [definitions, open, projectId, version]);

  useEffect(() => {
    if (!open || version === null) return undefined;
    let disposed = false;
    backtestApi.listBatchResearch(projectId, version, "sensitivity", 1, 100).then((page) => {
      if (!disposed) setHistory(page.items);
    }).catch((reason) => { if (!disposed) setError(errorMessage(reason)); });
    return () => { disposed = true; };
  }, [open, projectId, version]);

  useEffect(() => {
    if (!open || !batch || terminalStates.has(batch.state)) return undefined;
    let disposed = false;
    let polling = false;
    const refresh = async () => {
      if (polling) return;
      polling = true;
      try {
        const status = await workflowsApi.workspaceStatus(batch.workflow_workspace_id);
        if (disposed) return;
        if (terminalStates.has(status.state)) {
          const current = await backtestApi.getBatchResearch(batch.id);
          if (!disposed) {
            setBatch(current);
            setHistory((items) => items.map((item) => item.id === current.id ? current : item));
          }
        } else {
          setBatch((current) => current?.id === batch.id ? { ...current, workflow_instance_id: status.workflow_instance_id, state: status.state, error: status.error, updated_at: status.updated_at } : current);
        }
        if (!disposed) setError("");
      } catch (reason) {
        if (!disposed) setError(errorMessage(reason));
      } finally {
        polling = false;
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [batch?.id, batch?.state, batch?.workflow_workspace_id, open]);

  useEffect(() => {
    const requestId = ++resultRequest.current;
    analytics.current?.close();
    analytics.current = null;
    setResults([]);
    if (!open || !batch || !successStates.has(batch.state)) {
      setLoadingResults(false);
      return undefined;
    }
    let disposed = false;
    setLoadingResults(true);
    setError("");
    backtestApi.batchResearchOutput(batch.id, "results").then(async (buffer) => {
      const nextAnalytics = await SensitivityAnalytics.create(batch.id, buffer);
      if (disposed || requestId !== resultRequest.current) { await nextAnalytics.close(); return; }
      analytics.current = nextAnalytics;
      const rows = await nextAnalytics.results();
      if (!disposed && requestId === resultRequest.current) setResults(rows);
    }).catch((reason) => {
      if (!disposed && requestId === resultRequest.current) setError(errorMessage(reason));
    }).finally(() => {
      if (!disposed && requestId === resultRequest.current) setLoadingResults(false);
    });
    return () => { disposed = true; };
  }, [batch?.id, batch?.state, open]);

  useEffect(() => () => { analytics.current?.close(); }, []);

  function resetForClose(nextOpen: boolean) {
    if (!nextOpen) {
      setBatch(null);
      setResults([]);
      setError("");
    }
    onOpenChange(nextOpen);
  }

  function updateDimension(index: number, next: Partial<DimensionDraft>) {
    setDrafts((current) => current.map((draft, draftIndex) => draftIndex === index ? { ...draft, ...next } : draft));
  }

  function selectPath(index: number, path: string) {
    const definition = definitions.find((item) => item.path === path);
    if (!definition) return;
    updateDimension(index, { path, values: defaultValues(definition) });
  }

  function addDimension() {
    if (drafts.length >= 2) return;
    const definition = definitions.find((item) => !drafts.some((draft) => draft.path === item.path));
    if (definition) setDrafts((current) => [...current, { path: definition.path, values: defaultValues(definition) }]);
  }

  function removeDimension(index: number) {
    setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
  }

  async function submit() {
    if (version === null || submitting || grid.error || !grid.items.length) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await backtestApi.createBatchResearch({ analysis_type: "sensitivity", project_id: projectId, version, description: description.trim(), items: batchItems });
      setBatch(response);
      setHistory((items) => [response, ...items.filter((item) => item.id !== response.id)]);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function openHistory(researchId: number) {
    if (loadingHistoryResearchId !== null) return;
    setLoadingHistoryResearchId(researchId);
    setError("");
    try {
      setBatch(await backtestApi.getBatchResearch(researchId));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoadingHistoryResearchId(null);
    }
  }

  async function deleteResearch() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await backtestApi.deleteBatchResearch(deleteTarget.id);
      setHistory((items) => items.filter((item) => item.id !== deleteTarget.id));
      if (batch?.id === deleteTarget.id) {
        analytics.current?.close();
        analytics.current = null;
        setBatch(null);
        setResults([]);
      }
      setDeleteTarget(null);
    } catch (reason) {
      setDeleteError(errorMessage(reason));
    } finally {
      setDeleting(false);
    }
  }

  const running = batch !== null && !terminalStates.has(batch.state);

  return <>
  <Dialog open={open} onOpenChange={resetForClose}>
    <LargeDialogContent className="flex flex-col overflow-hidden">
      <DialogHeader className="shrink-0 border-b pb-3 pr-8">
        <DialogTitle>{projectTitle} · v{version ?? "—"} · 参数敏感性分析</DialogTitle>
        <DialogDescription>{batch ? `研究 #${batch.id} 使用一个工作流复用回测数据，依次计算 ${batch.requested_count} 个参数组合。` : "选择一个或两个参数，输入取值生成参数网格；全部组合在同一个 Runtime 工作流中完成。"}</DialogDescription>
      </DialogHeader>
      {!batch && <div className="grid min-h-0 flex-1 gap-4 pt-1 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border bg-card">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><div><div className="text-sm font-medium">分析配置</div><div className="mt-1 text-xs text-muted-foreground">最多 2 个参数、{MAX_GRID_POINTS} 个组合；仅展示 params 中的简单值。</div></div><div className="rounded-md bg-muted px-3 py-1.5 text-sm"><span className="text-muted-foreground">组合数 </span><span className="font-semibold tabular-nums">{grid.items.length}</span></div></div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <label className="block space-y-1.5"><span className="text-sm font-medium">备注</span><Input maxLength={512} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-medium">变化参数</div><div className="mt-1 text-xs text-muted-foreground">每个参数至少填写两个不同取值。</div></div><Button size="sm" variant="outline" disabled={drafts.length >= 2 || definitions.length <= drafts.length} onClick={addDimension}><SlidersHorizontal />添加参数</Button></div>
            {drafts.length ? <div className={drafts.length > 1 ? "grid gap-3 xl:grid-cols-2" : "grid gap-3"}>{drafts.map((draft, index) => <DimensionEditor key={`${index}-${draft.path}`} definition={definitions.find((item) => item.path === draft.path)} definitions={definitions.filter((item) => item.path === draft.path || !drafts.some((other, otherIndex) => otherIndex !== index && other.path === item.path))} draft={draft} index={index} onChange={updateDimension} onRemove={drafts.length > 1 ? removeDimension : undefined} onPathChange={selectPath} />)}</div> : <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前版本没有可调参数。</div>}
            {grid.error ? <div className="text-xs text-destructive">{grid.error}</div> : <div className="text-xs text-muted-foreground">完整区间数据只查询一次，全部组合写入同一个结果文件。</div>}
            {version === null ? <div className="text-sm text-destructive">请先选择一个已保存的版本。</div> : null}
            {error ? <div className="rounded-md border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
          </div>
          <DialogFooter className="shrink-0 border-t px-4 py-3"><Button variant="outline" onClick={() => resetForClose(false)} disabled={submitting}>取消</Button><Button onClick={() => { submit().catch(() => undefined); }} disabled={submitting || version === null || Boolean(grid.error) || grid.items.length === 0}>{submitting ? <Loader2 className="animate-spin" /> : <SlidersHorizontal />}提交敏感性分析</Button></DialogFooter>
        </section>
        <AnalysisHistoryPanel count={history.length} emptyMessage="当前版本还没有参数敏感性分析" title="历史分析">
          {history.map((item) => <AnalysisHistoryItem deleteDisabled={!canDeleteBacktestAnalysis(item.state)} deleteLabel={`删除参数敏感性分析 ${item.id}`} description={`${item.description ? `${item.description} · ` : ""}${item.requested_count} 个组合`} key={item.id} loading={loadingHistoryResearchId === item.id} onDelete={() => { setDeleteError(""); setDeleteTarget(item); }} onOpen={() => openHistory(item.id)} state={item.state} title={`研究 #${item.id}`} />)}
        </AnalysisHistoryPanel>
      </div>}
      {batch && <div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="space-y-5 pb-2">
          {batch.description ? <div className="rounded-md border bg-muted/15 px-4 py-3 text-sm">{batch.description}</div> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3"><div className="flex flex-wrap items-center gap-3"><SchedulerState state={batch.state} /><span className="text-sm text-muted-foreground">Workspace #{batch.workflow_workspace_id}</span>{batch.workflow_instance_id ? <span className="text-sm text-muted-foreground">Workflow #{batch.workflow_instance_id}</span> : null}<span className="text-sm text-muted-foreground">成功 {batch.completed_count} / 失败 {batch.failed_count} / 共 {batch.requested_count}</span></div><div className="flex items-center gap-2"><Button size="sm" variant="destructive" disabled={!canDeleteBacktestAnalysis(batch.state)} onClick={() => { setDeleteError(""); setDeleteTarget(batch); }}><Trash2 />删除分析</Button><Button size="sm" variant="outline" disabled={running} onClick={() => { setBatch(null); setResults([]); setError(""); }}><RefreshCw />新建分析</Button></div></div>
          {batch.error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{batch.error}</div> : null}
          {running ? <LoadingPanel label="参数敏感性分析工作流正在运行..." /> : loadingResults ? <LoadingPanel label="DuckDB 正在读取参数敏感性分析结果..." /> : results.length ? <SensitivityReport metrics={metrics} results={results} /> : null}
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          </div></div>}
    </LargeDialogContent>
  </Dialog>
  <DeleteConfirmationDialog actionLabel="删除分析" description={`将永久删除参数敏感性分析 #${deleteTarget?.id ?? ""}、关联工作流和结果文件。该操作不可撤销。`} error={deleteError} open={deleteTarget !== null} submitting={deleting} title={`删除参数敏感性分析 #${deleteTarget?.id ?? ""}`} onDelete={deleteResearch} onOpenChange={(nextOpen) => { if (!nextOpen && !deleting) { setDeleteTarget(null); setDeleteError(""); } }} />
  </>;
}

function DimensionEditor({ definition, definitions, draft, index, onChange, onPathChange, onRemove }: { definition?: ParameterDefinition; definitions: ParameterDefinition[]; draft: DimensionDraft; index: number; onChange: (index: number, next: Partial<DimensionDraft>) => void; onPathChange: (index: number, path: string) => void; onRemove?: (index: number) => void }) {
  const available = definitions;
  function toggleOption(value: Scalar) {
    const token = formatInputValue(value);
    const tokens = draft.values.split(/[，,\n]+/).map((item) => item.trim()).filter(Boolean);
    const next = tokens.includes(token) ? tokens.filter((item) => item !== token) : [...tokens, token];
    onChange(index, { values: next.join(", ") });
  }
  return <div className="relative grid gap-3 rounded-md border bg-muted/15 p-3 sm:grid-cols-[minmax(8rem,.8fr)_minmax(11rem,1.2fr)]"><div className="min-w-0 space-y-1.5"><div className="text-xs font-medium text-muted-foreground">参数 {index + 1}</div><Select value={draft.path} onValueChange={(value) => onPathChange(index, value)}><SelectTrigger className="w-full" title={definition?.label}><SelectValue /></SelectTrigger><SelectContent>{available.map((item) => <SelectItem key={item.path} value={item.path}>{item.label}</SelectItem>)}</SelectContent></Select></div><label className="block min-w-0 space-y-1.5"><span className="text-xs font-medium text-muted-foreground">取值{definition?.kind === "number" ? "（数值）" : "（类别）"}</span><div className="flex gap-1"><Input className="min-w-0" value={draft.values} onChange={(event) => onChange(index, { values: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />{onRemove ? <Button aria-label="移除参数" className="shrink-0" size="icon" variant="ghost" onClick={() => onRemove(index)}><X /></Button> : null}</div><span className="block truncate text-xs text-muted-foreground">{definition?.options?.length ? `可选值：${definition.options.map(formatSensitivityValue).join("、")}` : definition ? `当前值：${formatSensitivityValue(definition.baseValue)}` : ""}</span>{definition?.options?.length ? <div className="flex flex-wrap gap-1">{definition.options.map((value) => <Button key={formatInputValue(value)} size="sm" type="button" variant="ghost" onClick={() => toggleOption(value)}>{formatSensitivityValue(value)}</Button>)}</div> : null}</label></div>;
}

function SensitivityReport({ metrics, results }: { metrics: SensitivityMetric[]; results: SensitivityPoint[] }) {
  const dimensions = useMemo(() => inferDimensions(results), [results]);
  const [metricKey, setMetricKey] = useState(metrics[0]?.key ?? "");
  const [mode, setMode] = useState<"heatmap" | "fix-first" | "fix-second">("heatmap");
  const [fixedValue, setFixedValue] = useState("");
  const second = dimensions[1];
  const first = dimensions[0];
  const selectedMetric = metrics.find((item) => item.key === metricKey) ?? metrics[0];
  const fixedDimension = mode === "fix-first" ? first : mode === "fix-second" ? second : undefined;
  const lineDimension = mode === "fix-first" ? second : first;
  const isHeatmap = Boolean(second) && mode === "heatmap";
  const visibleResults = useMemo(() => {
    if (!fixedDimension || isHeatmap) return results;
    return results.filter((item) => serializeValue(getStrategyParameter(item.params, fixedDimension.path)) === fixedValue);
  }, [fixedDimension, fixedValue, isHeatmap, results]);
  useEffect(() => {
    if (!metrics.some((item) => item.key === metricKey)) setMetricKey(metrics[0]?.key ?? "");
  }, [metricKey, metrics]);
  useEffect(() => {
    if (!fixedDimension) setFixedValue("");
    else if (!fixedDimension.values.some((value) => serializeValue(value) === fixedValue)) setFixedValue(serializeValue(fixedDimension.values[0]));
  }, [fixedDimension, fixedValue]);
  if (!selectedMetric || !first) return <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">没有可展示的敏感性指标。</div>;
  const chart = isHeatmap && second ? heatmapOption(visibleResults, first, second, selectedMetric) : lineOption(visibleResults, lineDimension ?? first, selectedMetric);
  return <div className="space-y-5"><div className="grid grid-cols-1 gap-3 border-y py-3 sm:grid-cols-3"><div><div className="text-xs text-muted-foreground">分析维度</div><div className="mt-1 font-medium">{dimensions.length} 个参数</div></div><div><div className="text-xs text-muted-foreground">有效组合</div><div className="mt-1 font-medium tabular-nums">{results.filter((item) => item.status === "SUCCESS").length} / {results.length}</div></div><div><div className="text-xs text-muted-foreground">当前指标</div><div className="mt-1 font-medium">{selectedMetric.label}</div></div></div>
    <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4"><div className="w-56 space-y-1.5"><div className="text-xs font-medium text-muted-foreground">结果指标</div><Select value={selectedMetric.key} onValueChange={(value) => setMetricKey(value as SensitivityMetric["key"])}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{metrics.map((metric) => <SelectItem key={metric.key} value={metric.key}>{metric.label}</SelectItem>)}</SelectContent></Select></div>{second ? <div className="flex flex-wrap items-end gap-3"><Tabs value={mode} onValueChange={(value) => { const next = value as typeof mode; setMode(next); const dimension = next === "fix-first" ? first : next === "fix-second" ? second : undefined; setFixedValue(dimension ? serializeValue(dimension.values[0]) : ""); }}><TabsList><TabsTrigger value="heatmap"><Grid2X2 />二维热力图</TabsTrigger><TabsTrigger value="fix-first">固定 {first.label}</TabsTrigger><TabsTrigger value="fix-second">固定 {second.label}</TabsTrigger></TabsList></Tabs>{fixedDimension && !isHeatmap ? <div className="w-48 space-y-1.5"><div className="text-xs font-medium text-muted-foreground">{fixedDimension.label}</div><Select value={fixedValue} onValueChange={setFixedValue}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{fixedDimension.values.map((value) => <SelectItem key={serializeValue(value)} value={serializeValue(value)}>{formatSensitivityValue(value)}</SelectItem>)}</SelectContent></Select></div> : null}</div> : null}</div>
    <div className="rounded-md border bg-card p-3"><div className="mb-2 text-sm font-medium">{isHeatmap ? `${first.label} × ${second?.label} · ${selectedMetric.label}` : `${lineDimension?.label ?? first.label} 敏感性 · ${selectedMetric.label}`}</div><EChart height={360} option={chart} /></div><SensitivityTable dimensions={dimensions} metric={selectedMetric} results={visibleResults} />{results.some((item) => item.error) ? <SensitivityErrors dimensions={dimensions} results={results} /> : null}</div>;
}

function SensitivityTable({ dimensions, metric, results }: { dimensions: SensitivityDimension[]; metric: SensitivityMetric; results: SensitivityPoint[] }) {
  return <div className="rounded-md border bg-card"><div className="flex items-center gap-2 border-b px-4 py-3"><Table2 className="size-4 text-primary" /><span className="text-sm font-medium">参数组合明细</span><span className="text-xs text-muted-foreground">{results.length} 条</span></div><Table><TableHeader><TableRow><TableHead>组合</TableHead><TableHead className="text-right">{metric.label}</TableHead><TableHead>状态</TableHead></TableRow></TableHeader><TableBody>{results.map((item) => <TableRow key={item.caseIndex}><TableCell><div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{dimensions.map((dimension) => <span key={dimension.path}><span className="text-muted-foreground">{dimension.label}：</span>{formatSensitivityValue(getStrategyParameter(item.params, dimension.path))}</span>)}</div></TableCell><TableCell className="text-right font-mono tabular-nums">{formatMetricValue(item.metrics[metric.key], metric.format)}</TableCell><TableCell><SchedulerState state={item.status} /></TableCell></TableRow>)}</TableBody></Table></div>;
}

function SensitivityErrors({ dimensions, results }: { dimensions: SensitivityDimension[]; results: SensitivityPoint[] }) {
  return <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{results.filter((item) => item.error).map((item) => <div key={item.caseIndex}>{sensitivityItemLabel(item, dimensions)}：{item.error}</div>)}</div>;
}

function parameterDefinitions(parameters: StrategyParameters) {
  const definitions: ParameterDefinition[] = [];
  Object.entries(parameters).forEach(([path, value]) => {
    if (!isScalar(value)) return;
    const options = predefinedOptions(value);
    definitions.push({ baseValue: value, kind: typeof value === "number" ? "number" : "category", label: parameterLabel(path), options, path });
  });
  return definitions.sort((left, right) => left.path.localeCompare(right.path));
}

function predefinedOptions(value: Scalar) {
  if (typeof value === "boolean") return [false, true] as Scalar[];
  return undefined;
}

function buildGrid(base: StrategyParameters, drafts: DimensionDraft[], definitions: ParameterDefinition[]) {
  if (!drafts.length) return { error: "至少选择一个参数", items: [] as StrategyGridItem[] };
  const dimensions: { definition: ParameterDefinition; values: Scalar[] }[] = [];
  for (const draft of drafts) {
    const definition = definitions.find((item) => item.path === draft.path);
    if (!definition) return { error: "参数不存在，请重新选择", items: [] as StrategyGridItem[] };
    const values = parseValues(draft.values, definition);
    if (values.length < 2) return { error: `${definition.label} 至少需要两个不同取值`, items: [] as StrategyGridItem[] };
    dimensions.push({ definition, values });
  }
  const count = dimensions.reduce((total, dimension) => total * dimension.values.length, 1);
  if (count > MAX_GRID_POINTS) return { error: `参数网格包含 ${count} 个组合，最多允许 ${MAX_GRID_POINTS} 个`, items: [] as StrategyGridItem[] };
  const items: StrategyGridItem[] = [];
  for (const values of cartesian(dimensions.map((dimension) => dimension.values))) {
    const parameters = structuredClone(base);
    values.forEach((value, index) => { parameters[dimensions[index].definition.path] = value; });
    items.push({ parameters });
  }
  return { error: "", items };
}

function cartesian<T>(groups: T[][]) {
  return groups.reduce<T[][]>((result, group) => result.flatMap((prefix) => group.map((value) => [...prefix, value])), [[]]);
}

function parseValues(text: string, definition: ParameterDefinition) {
  const tokens = text.split(/[，,\n]+/).map((value) => value.trim()).filter(Boolean);
  const values: Scalar[] = [];
  for (const token of tokens) {
    let value: Scalar;
    if (definition.kind === "number") {
      const number = Number(token);
      if (!Number.isFinite(number)) return [];
      value = number;
    } else if (typeof definition.baseValue === "boolean") {
      if (token.toLowerCase() !== "true" && token.toLowerCase() !== "false") return [];
      value = token.toLowerCase() === "true";
    } else if (token.toLowerCase() === "null") {
      value = null;
    } else {
      value = token;
    }
    if (!values.some((current) => serializeValue(current) === serializeValue(value))) values.push(value);
  }
  return values;
}

function defaultValues(definition: ParameterDefinition) {
  if (definition.options?.length) return definition.options.map(formatInputValue).join(", ");
  return formatInputValue(definition.baseValue);
}

function inferDimensions(items: SensitivityResultRow[]) {
  if (!items.length) return [] as SensitivityDimension[];
  const flattened = items.map((item) => flattenScalars(item.params));
  const paths = new Set(flattened.flatMap((value) => [...value.keys()]));
  return [...paths].map((path) => {
    const values = uniqueValues(flattened.map((value) => value.get(path) ?? null));
    return { kind: values.every((value) => typeof value === "number") ? "number" as const : "category" as const, label: parameterLabel(path), path, values };
  }).filter((dimension) => dimension.values.length > 1).sort((left, right) => left.path.localeCompare(right.path)).slice(0, 2);
}

function flattenScalars(parameters: Record<string, unknown>) {
  const values = new Map<string, Scalar>();
  Object.entries(parameters).forEach(([path, value]) => {
    if (isScalar(value)) values.set(path, value);
  });
  return values;
}

function sensitivityItemLabel(item: SensitivityResultRow, dimensions: SensitivityDimension[]) {
  return dimensions.map((dimension) => `${dimension.label}=${formatSensitivityValue(getStrategyParameter(item.params, dimension.path))}`).join("，");
}

function uniqueValues(values: Scalar[]) {
  const result: Scalar[] = [];
  values.forEach((value) => { if (!result.some((current) => serializeValue(current) === serializeValue(value))) result.push(value); });
  return result.sort((left, right) => typeof left === "number" && typeof right === "number" ? left - right : formatSensitivityValue(left).localeCompare(formatSensitivityValue(right)));
}

function lineOption(results: SensitivityPoint[], dimension: SensitivityDimension, metric: SensitivityMetric) {
  const points = results.map((item) => ({ parameter: getStrategyParameter(item.params, dimension.path), label: formatSensitivityValue(getStrategyParameter(item.params, dimension.path)), value: item.metrics[metric.key] })).filter((item): item is { label: string; parameter: Scalar; value: number } => item.value !== null && item.value !== undefined && Number.isFinite(item.value)).sort((left, right) => compareScalars(left.parameter, right.parameter));
  return { animationDuration: 180, grid: { left: 56, right: 24, top: 24, bottom: 48, containLabel: true }, tooltip: { trigger: "axis" }, xAxis: { type: "category", data: points.map((item) => item.label), name: dimension.label, nameLocation: "middle", nameGap: 30 }, yAxis: { type: "value", name: metric.label, nameLocation: "middle", nameGap: 42, axisLabel: { formatter: (value: number) => formatMetricValue(value, metric.format) } }, series: [{ type: "line", data: points.map((item) => item.value), smooth: false, symbol: "circle", symbolSize: 7, lineStyle: { width: 2 }, itemStyle: { color: "#2563eb" } }] };
}

function heatmapOption(results: SensitivityPoint[], xDimension: SensitivityDimension, yDimension: SensitivityDimension, metric: SensitivityMetric) {
  const xLabels = xDimension.values.map(formatSensitivityValue);
  const yLabels = yDimension.values.map(formatSensitivityValue);
  const xIndexes = new Map(xDimension.values.map((value, index) => [serializeValue(value), index]));
  const yIndexes = new Map(yDimension.values.map((value, index) => [serializeValue(value), index]));
  const cells = results.flatMap((item) => {
    const value = item.metrics[metric.key];
    if (value === null || value === undefined || !Number.isFinite(value)) return [];
    const xIndex = xIndexes.get(serializeValue(getStrategyParameter(item.params, xDimension.path)));
    const yIndex = yIndexes.get(serializeValue(getStrategyParameter(item.params, yDimension.path)));
    return xIndex === undefined || yIndex === undefined ? [] : [[xIndex, yIndex, value]];
  });
  const values = cells.map((cell) => cell[2]);
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 1;
  return { animationDuration: 180, grid: { left: 72, right: 72, top: 24, bottom: 64, containLabel: true }, tooltip: { position: "top", formatter: (params: { value: [number, number, number] }) => `${xDimension.label}：${xLabels[params.value[0]]}<br/>${yDimension.label}：${yLabels[params.value[1]]}<br/>${metric.label}：${formatMetricValue(params.value[2], metric.format)}` }, xAxis: { type: "category", data: xLabels, name: xDimension.label, nameLocation: "middle", nameGap: 34 }, yAxis: { type: "category", data: yLabels, name: yDimension.label, nameLocation: "middle", nameGap: 54 }, visualMap: { min: minimum, max: maximum === minimum ? minimum + 1 : maximum, calculable: false, orient: "vertical", right: 0, top: "center", inRange: { color: ["#dbeafe", "#2563eb"] } }, series: [{ type: "heatmap", data: cells, label: { show: cells.length <= 30, color: "#fff", textBorderColor: "rgba(0,0,0,.45)", textBorderWidth: 2, formatter: (params: { value: [number, number, number] }) => formatMetricValue(params.value[2], metric.format) }, itemStyle: { borderColor: "rgba(255,255,255,.75)", borderWidth: 1 } }] };
}

function getStrategyParameter(value: unknown, key: string): Scalar {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parameter = (value as Record<string, unknown>)[key];
  return isScalar(parameter) ? parameter : null;
}

function isScalar(value: unknown): value is Scalar { return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"; }
function compareScalars(left: Scalar, right: Scalar) { return typeof left === "number" && typeof right === "number" ? left - right : formatSensitivityValue(left).localeCompare(formatSensitivityValue(right)); }
function serializeValue(value: unknown) { return JSON.stringify(value) ?? String(value); }
function formatInputValue(value: Scalar) { return value === null ? "null" : String(value); }
function formatSensitivityValue(value: unknown) { if (value === null || value === undefined) return "空值"; if (typeof value === "boolean") return value ? "是" : "否"; if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString("zh-CN") : value.toLocaleString("zh-CN", { maximumFractionDigits: 8 }); return String(value); }
function formatMetricValue(value: number | null | undefined, format: SensitivityMetric["format"]) { if (value === null || value === undefined || !Number.isFinite(value)) return "—"; return format === "percent" ? `${(value * 100).toFixed(2)}%` : value.toFixed(3); }
function parameterLabel(path: string) { return path; }
function LoadingPanel({ label }: { label: string }) { return <div className="grid min-h-48 place-items-center rounded-md border bg-card"><div className="text-center"><Loader2 className="mx-auto animate-spin text-primary" /><div className="mt-3 text-sm text-muted-foreground">{label}</div></div></div>; }
