import { useEffect, useMemo, useState } from "react";
import { Grid2X2, Loader2, RefreshCw, SlidersHorizontal, Table2, X } from "lucide-react";

import { backtestApi } from "@/assets/lib/backtest";
import { BacktestAnalytics } from "@/assets/lib/backtestAnalysis";
import { errorMessage } from "@/assets/lib/utils";
import { quantStatsReport, type QuantStatsReport } from "@/assets/lib/quantstats";
import SchedulerStateBadge from "@/components/badge/SchedulerStateBadge";
import EChart from "@/components/chart/EChart";
import type { BacktestParameters, BatchResearchItem, BatchResearchListItem, BatchResearchResponse, StrategyParameters } from "@/types/backtest";
import { Button } from "@/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, LargeDialogContent } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";

const MAX_GRID_POINTS = 100;
const terminalBatchStates = new Set(["SUCCESS", "FAILURE", "PARTIAL_SUCCESS"]);

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
type SensitivityMetric = { format: "number" | "percent"; key: string; label: string };
type SensitivityPoint = { error: string | null; item: BatchResearchItem; metrics: Record<string, number | null> };
type StrategyGridItem = { parameters: StrategyParameters };

type SensitivityAnalysisDialogProps = {
  baseParameters: BacktestParameters;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: number;
  projectTitle: string;
  version: number | null;
};

const SENSITIVITY_METRICS: SensitivityMetric[] = [
  { key: "totalReturn", label: "累计收益", format: "percent" },
  { key: "cagr", label: "年化收益", format: "percent" },
  { key: "sharpe", label: "夏普比率", format: "number" },
  { key: "volatility", label: "年化波动", format: "percent" },
  { key: "maxDrawdown", label: "最大回撤", format: "percent" },
  { key: "winRate", label: "胜率", format: "percent" },
  { key: "calmar", label: "卡玛比率", format: "number" }
];

export default function SensitivityAnalysisDialog({ baseParameters, onOpenChange, open, projectId, projectTitle, version }: SensitivityAnalysisDialogProps) {
  const definitions = useMemo(() => parameterDefinitions(baseParameters.params), [baseParameters.params]);
  const metrics = SENSITIVITY_METRICS;
  const [drafts, setDrafts] = useState<DimensionDraft[]>([]);
  const [description, setDescription] = useState("");
  const [batch, setBatch] = useState<BatchResearchResponse | null>(null);
  const [history, setHistory] = useState<BatchResearchListItem[]>([]);
  const [results, setResults] = useState<SensitivityPoint[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingHistoryResearchId, setLoadingHistoryResearchId] = useState<number | null>(null);
  const [error, setError] = useState("");

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
  }, [definitions, open, projectId, version]);

  useEffect(() => {
    if (!open || version === null) return undefined;
    let disposed = false;
    backtestApi.listBatchResearch(projectId, version, "sensitivity", 1, 100).then((page) => {
      if (!disposed) setHistory(page.items);
    }).catch(() => undefined);
    return () => { disposed = true; };
  }, [open, projectId, version]);

  useEffect(() => {
    if (!open || !batch || terminalBatchStates.has(batch.state)) return undefined;
    let disposed = false;
    let polling = false;
    const timer = window.setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const next = await backtestApi.getBatchResearch(batch.id);
        if (!disposed) setBatch(next);
      } catch (reason) {
        if (!disposed) setError(errorMessage(reason));
      } finally {
        polling = false;
      }
    }, 2500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [batch, open]);

  useEffect(() => {
    if (!open || !batch || !terminalBatchStates.has(batch.state)) return undefined;
    let disposed = false;
    setLoadingResults(true);
    loadSensitivityResults(batch.items).then((next) => {
      if (!disposed) setResults(next);
    }).catch((reason) => {
      if (!disposed) setError(errorMessage(reason));
    }).finally(() => {
      if (!disposed) setLoadingResults(false);
    });
    return () => { disposed = true; };
  }, [batch, open]);

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

  return <Dialog open={open} onOpenChange={resetForClose}>
    <LargeDialogContent className="flex flex-col overflow-hidden">
      <DialogHeader>
        <DialogTitle>{projectTitle} · v{version ?? "—"} · 参数敏感性分析</DialogTitle>
        <DialogDescription>{batch ? `批量研究 #${batch.id}，每个参数组合对应一个独立回测工作流。` : "选择一个或两个参数，输入取值后生成参数网格并批量执行。"}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {!batch && <div className="mx-auto max-w-3xl space-y-5 py-2">
          <div className="rounded-md border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">可调参数来自当前版本的 params 字典，只展示其中的简单值。单参数生成敏感性折线图，双参数生成参数组合热力图，也可以固定其中一个参数查看另一个参数的折线变化。最多提交 {MAX_GRID_POINTS} 个组合。</div>
          <div className="space-y-3 rounded-md border bg-card p-4">
            <label className="block space-y-1.5"><span className="text-sm font-medium">备注</span><Input maxLength={512} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-medium">变化参数</div><div className="mt-1 text-xs text-muted-foreground">每个参数至少填写两个不同取值。</div></div><Button size="sm" variant="outline" disabled={drafts.length >= 2 || definitions.length <= drafts.length} onClick={addDimension}><SlidersHorizontal />添加参数</Button></div>
            {drafts.length ? drafts.map((draft, index) => <DimensionEditor key={`${index}-${draft.path}`} definition={definitions.find((item) => item.path === draft.path)} definitions={definitions.filter((item) => item.path === draft.path || !drafts.some((other, otherIndex) => otherIndex !== index && other.path === item.path))} draft={draft} index={index} onChange={updateDimension} onRemove={drafts.length > 1 ? removeDimension : undefined} onPathChange={selectPath} />) : <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前版本没有可调参数。</div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/15 px-4 py-3 text-sm"><div><span className="text-muted-foreground">参数组合：</span><span className="font-semibold tabular-nums">{grid.items.length}</span>{grid.error ? <div className="mt-1 text-xs text-destructive">{grid.error}</div> : null}</div><div className="text-xs text-muted-foreground">结果指标将在任务完成后从 Parquet 结果计算。</div></div>
          {history.length ? <div className="space-y-2 rounded-md border bg-card p-4"><div className="text-sm font-medium">已有敏感性分析</div>{history.map((item) => <div className="flex items-center gap-3 text-sm" key={item.id}><span className="min-w-0 flex-1 truncate">研究 #{item.id}{item.description ? ` · ${item.description}` : ""} · {item.requested_count} 个组合</span><SchedulerStateBadge state={item.state} /><Button size="sm" variant="ghost" disabled={loadingHistoryResearchId !== null} onClick={() => openHistory(item.id)}>{loadingHistoryResearchId === item.id ? <Loader2 className="animate-spin" /> : "查看"}</Button></div>)}</div> : null}
          {version === null ? <div className="text-sm text-destructive">请先选择一个已保存的版本。</div> : null}
          {error ? <div className="rounded-md border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
          <DialogFooter><Button variant="outline" onClick={() => resetForClose(false)} disabled={submitting}>取消</Button><Button onClick={() => { submit().catch(() => undefined); }} disabled={submitting || version === null || Boolean(grid.error) || grid.items.length === 0}>{submitting ? <Loader2 className="animate-spin" /> : <SlidersHorizontal />}提交敏感性分析</Button></DialogFooter>
          </div>}
        {batch && <div className="space-y-5 pb-2">
          {batch.description ? <div className="rounded-md border bg-muted/15 px-4 py-3 text-sm">{batch.description}</div> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3"><div className="flex items-center gap-3"><SchedulerStateBadge state={batch.state} /><span className="text-sm text-muted-foreground">已完成 {batch.completed_count}/{batch.requested_count}，失败 {batch.failed_count}</span></div><Button size="sm" variant="outline" onClick={() => { setBatch(null); setResults([]); setError(""); }}><RefreshCw />重新配置</Button></div>
          {batch.error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{batch.error}</div> : null}
          {loadingResults ? <div className="grid min-h-48 place-items-center rounded-md border bg-card"><div className="text-center"><Loader2 className="mx-auto animate-spin text-primary" /><div className="mt-3 text-sm text-muted-foreground">正在读取各参数组合的结果...</div></div></div> : results.some((item) => item.metrics && Object.keys(item.metrics).length) ? <SensitivityReport metrics={metrics} results={results} /> : <SensitivityProgressTable items={batch.items} />}
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          </div>}
      </div>
    </LargeDialogContent>
  </Dialog>;
}

function DimensionEditor({ definition, definitions, draft, index, onChange, onPathChange, onRemove }: { definition?: ParameterDefinition; definitions: ParameterDefinition[]; draft: DimensionDraft; index: number; onChange: (index: number, next: Partial<DimensionDraft>) => void; onPathChange: (index: number, path: string) => void; onRemove?: (index: number) => void }) {
  const available = definitions;
  function toggleOption(value: Scalar) {
    const token = formatInputValue(value);
    const tokens = draft.values.split(/[，,\n]+/).map((item) => item.trim()).filter(Boolean);
    const next = tokens.includes(token) ? tokens.filter((item) => item !== token) : [...tokens, token];
    onChange(index, { values: next.join(", ") });
  }
  return <div className="space-y-3 rounded-md border bg-muted/15 p-3"><div className="flex items-start gap-3"><div className="min-w-0 flex-1 space-y-1.5"><div className="text-xs font-medium text-muted-foreground">参数 {index + 1}</div><Select value={draft.path} onValueChange={(value) => onPathChange(index, value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{available.map((item) => <SelectItem key={item.path} value={item.path}>{item.label}</SelectItem>)}</SelectContent></Select></div>{onRemove ? <Button aria-label="移除参数" className="mt-5 shrink-0" size="icon" variant="ghost" onClick={() => onRemove(index)}><X /></Button> : null}</div><label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">取值{definition?.kind === "number" ? "（数值）" : "（类别）"}</span><Input value={draft.values} onChange={(event) => onChange(index, { values: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /><span className="text-xs text-muted-foreground">用逗号分隔。{definition?.options?.length ? `可选值：${definition.options.map(formatSensitivityValue).join("、")}` : definition ? `当前值：${formatSensitivityValue(definition.baseValue)}` : ""}</span>{definition?.options?.length ? <div className="flex flex-wrap gap-1">{definition.options.map((value) => <Button key={formatInputValue(value)} size="sm" type="button" variant="ghost" onClick={() => toggleOption(value)}>{formatSensitivityValue(value)}</Button>)}</div> : null}</label></div>;
}

function SensitivityReport({ metrics, results }: { metrics: SensitivityMetric[]; results: SensitivityPoint[] }) {
  const dimensions = useMemo(() => inferDimensions(results.map((item) => item.item)), [results]);
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
    return results.filter((item) => serializeValue(getStrategyParameter(item.item.parameters.params, fixedDimension.path)) === fixedValue);
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
  return <div className="space-y-5"><div className="grid grid-cols-1 gap-3 border-y py-3 sm:grid-cols-3"><div><div className="text-xs text-muted-foreground">分析维度</div><div className="mt-1 font-medium">{dimensions.length} 个参数</div></div><div><div className="text-xs text-muted-foreground">有效组合</div><div className="mt-1 font-medium tabular-nums">{results.filter((item) => Object.keys(item.metrics).length).length} / {results.length}</div></div><div><div className="text-xs text-muted-foreground">当前指标</div><div className="mt-1 font-medium">{selectedMetric.label}</div></div></div>
    <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4"><div className="w-56 space-y-1.5"><div className="text-xs font-medium text-muted-foreground">结果指标</div><Select value={selectedMetric.key} onValueChange={setMetricKey}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{metrics.map((metric) => <SelectItem key={metric.key} value={metric.key}>{metric.label}</SelectItem>)}</SelectContent></Select></div>{second ? <div className="flex flex-wrap items-end gap-3"><Tabs value={mode} onValueChange={(value) => { const next = value as typeof mode; setMode(next); const dimension = next === "fix-first" ? first : next === "fix-second" ? second : undefined; setFixedValue(dimension ? serializeValue(dimension.values[0]) : ""); }}><TabsList><TabsTrigger value="heatmap"><Grid2X2 />二维热力图</TabsTrigger><TabsTrigger value="fix-first">固定 {first.label}</TabsTrigger><TabsTrigger value="fix-second">固定 {second.label}</TabsTrigger></TabsList></Tabs>{fixedDimension && !isHeatmap ? <div className="w-48 space-y-1.5"><div className="text-xs font-medium text-muted-foreground">{fixedDimension.label}</div><Select value={fixedValue} onValueChange={setFixedValue}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{fixedDimension.values.map((value) => <SelectItem key={serializeValue(value)} value={serializeValue(value)}>{formatSensitivityValue(value)}</SelectItem>)}</SelectContent></Select></div> : null}</div> : null}</div>
    <div className="rounded-md border bg-card p-3"><div className="mb-2 text-sm font-medium">{isHeatmap ? `${first.label} × ${second?.label} · ${selectedMetric.label}` : `${lineDimension?.label ?? first.label} 敏感性 · ${selectedMetric.label}`}</div><EChart height={360} option={chart} /></div><SensitivityTable dimensions={dimensions} metric={selectedMetric} results={visibleResults} />{results.some((item) => item.error) ? <SensitivityErrors dimensions={dimensions} results={results} /> : null}</div>;
}

function SensitivityTable({ dimensions, metric, results }: { dimensions: SensitivityDimension[]; metric: SensitivityMetric; results: SensitivityPoint[] }) {
  return <div className="rounded-md border bg-card"><div className="flex items-center gap-2 border-b px-4 py-3"><Table2 className="size-4 text-primary" /><span className="text-sm font-medium">参数组合明细</span><span className="text-xs text-muted-foreground">{results.length} 条</span></div><Table><TableHeader><TableRow><TableHead>组合</TableHead><TableHead className="text-right">{metric.label}</TableHead><TableHead>状态</TableHead></TableRow></TableHeader><TableBody>{results.map((item) => <TableRow key={item.item.id}><TableCell><div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{dimensions.map((dimension) => <span key={dimension.path}><span className="text-muted-foreground">{dimension.label}：</span>{formatSensitivityValue(getStrategyParameter(item.item.parameters.params, dimension.path))}</span>)}</div></TableCell><TableCell className="text-right font-mono tabular-nums">{formatMetricValue(item.metrics[metric.key], metric.format)}</TableCell><TableCell>{item.error ? <span className="text-xs text-destructive">失败</span> : <SchedulerStateBadge state={item.item.state} />}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function SensitivityErrors({ dimensions, results }: { dimensions: SensitivityDimension[]; results: SensitivityPoint[] }) {
  return <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{results.filter((item) => item.error).map((item) => <div key={item.item.id}>{sensitivityItemLabel(item.item, dimensions)}：{item.error}</div>)}</div>;
}

function SensitivityProgressTable({ items }: { items: BatchResearchItem[] }) {
  const dimensions = inferDimensions(items);
  return <div className="overflow-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>参数组合</TableHead><TableHead>工作流</TableHead><TableHead>状态</TableHead><TableHead>错误</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell className="max-w-96 truncate">{sensitivityItemLabel(item, dimensions)}</TableCell><TableCell className="font-mono">{item.workflow_instance_id ?? "—"}</TableCell><TableCell><SchedulerStateBadge state={item.state} /></TableCell><TableCell className="max-w-96 truncate text-destructive">{item.error ?? "—"}</TableCell></TableRow>)}</TableBody></Table></div>;
}

async function loadSensitivityResults(items: BatchResearchItem[]) {
  const results = new Array<SensitivityPoint>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await loadSensitivityResult(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
  return results;
}

async function loadSensitivityResult(item: BatchResearchItem): Promise<SensitivityPoint> {
  if (item.state !== "SUCCESS" && item.state !== "FORCED_SUCCESS") return { error: item.error, item, metrics: {} };
  if (item.workflow_instance_id === null) return { error: "工作流实例尚未生成", item, metrics: {} };
  try {
    const buffer = await backtestApi.output(item.workflow_instance_id, "daily_portfolios");
    const analytics = await BacktestAnalytics.create(item.workflow_instance_id, buffer);
    try {
      const portfolio = await analytics.portfolios();
      const parameters = item.parameters as unknown as BacktestParameters;
      const report = portfolio.length ? quantStatsReport(portfolio.map((row) => ({ time: row.time, value: row.dailyReturn ?? 0 })), parameters.annual_trading_days, parameters.risk_free_rate, true) : null;
      return { error: report ? null : "结果为空", item, metrics: report ? backtestMetricValues(report) : {} };
    } finally {
      await analytics.close();
    }
  } catch (reason) {
    return { error: errorMessage(reason), item, metrics: {} };
  }
}

function backtestMetricValues(report: QuantStatsReport) {
  return { totalReturn: report.totalReturn, cagr: report.cagr, sharpe: report.sharpe, volatility: report.volatility, maxDrawdown: report.maxDrawdown, winRate: report.winRate, calmar: report.calmar };
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

function inferDimensions(items: BatchResearchItem[]) {
  if (!items.length) return [] as SensitivityDimension[];
  const flattened = items.map((item) => flattenScalars((item.parameters.params ?? {}) as Record<string, unknown>));
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

function sensitivityItemLabel(item: BatchResearchItem, dimensions: SensitivityDimension[]) {
  return dimensions.map((dimension) => `${dimension.label}=${formatSensitivityValue(getStrategyParameter(item.parameters.params, dimension.path))}`).join("，");
}

function uniqueValues(values: Scalar[]) {
  const result: Scalar[] = [];
  values.forEach((value) => { if (!result.some((current) => serializeValue(current) === serializeValue(value))) result.push(value); });
  return result.sort((left, right) => typeof left === "number" && typeof right === "number" ? left - right : formatSensitivityValue(left).localeCompare(formatSensitivityValue(right)));
}

function lineOption(results: SensitivityPoint[], dimension: SensitivityDimension, metric: SensitivityMetric) {
  const points = results.map((item) => ({ parameter: getStrategyParameter(item.item.parameters.params, dimension.path), label: formatSensitivityValue(getStrategyParameter(item.item.parameters.params, dimension.path)), value: item.metrics[metric.key] })).filter((item): item is { label: string; parameter: Scalar; value: number } => item.value !== null && item.value !== undefined && Number.isFinite(item.value)).sort((left, right) => compareScalars(left.parameter, right.parameter));
  return { animationDuration: 180, grid: { left: 56, right: 24, top: 24, bottom: 48, containLabel: true }, tooltip: { trigger: "axis" }, xAxis: { type: "category", data: points.map((item) => item.label), name: dimension.label, nameLocation: "middle", nameGap: 30 }, yAxis: { type: "value", name: metric.label, nameLocation: "middle", nameGap: 42, axisLabel: { formatter: (value: number) => formatMetricValue(value, metric.format) } }, series: [{ type: "line", data: points.map((item) => item.value), smooth: false, symbol: "circle", symbolSize: 7, lineStyle: { width: 2 }, itemStyle: { color: "#2563eb" } }] };
}

function heatmapOption(results: SensitivityPoint[], xDimension: SensitivityDimension, yDimension: SensitivityDimension, metric: SensitivityMetric) {
  const xLabels = xDimension.values.map(formatSensitivityValue);
  const yLabels = yDimension.values.map(formatSensitivityValue);
  const cells = results.flatMap((item) => {
    const value = item.metrics[metric.key];
    if (value === null || value === undefined || !Number.isFinite(value)) return [];
    return [[xLabels.indexOf(formatSensitivityValue(getStrategyParameter(item.item.parameters.params, xDimension.path))), yLabels.indexOf(formatSensitivityValue(getStrategyParameter(item.item.parameters.params, yDimension.path))), value]];
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
