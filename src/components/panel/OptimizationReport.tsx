import { useEffect, useMemo, useState } from "react";

import { optimizationAlgorithmLabels, type OptimizationReportData } from "@/assets/lib/optimization";
import EChart from "@/components/chart/EChart";
import { useAppStore } from "@/store";
import type { OptimizationAlgorithm } from "@/types/backtest";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";

const colors = ["#2563eb", "#059669", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#0d9488", "#9333ea", "#e11d48", "#0284c7", "#16a34a", "#ca8a04", "#c026d3", "#475569", "#f97316", "#14b8a6"];

export default function OptimizationReport({ data }: { data: OptimizationReportData }) {
  const theme = useAppStore((state) => state.theme);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<OptimizationAlgorithm>(data.methods[0]?.algorithm ?? "random_search");
  const selectedMethod = data.methods.find((method) => method.algorithm === selectedAlgorithm) ?? data.methods[0];
  const selectedRuns = data.runs.filter((run) => run.algorithm === selectedAlgorithm);
  const selectedPaths = data.paths.filter((point) => point.algorithm === selectedAlgorithm);
  const selectedSelections = data.selections.filter((selection) => selection.algorithm === selectedAlgorithm);
  const bestSharpe = data.methods[0] ?? null;
  const bestReturn = [...data.methods].sort((left, right) => (right.meanReturn ?? Number.NEGATIVE_INFINITY) - (left.meanReturn ?? Number.NEGATIVE_INFINITY))[0] ?? null;
  const comparisonOption = useMemo(() => comparisonChart(data, theme), [data, theme]);
  const repetitionOption = useMemo(() => repetitionChart(selectedAlgorithm, selectedPaths, data.meanPaths, theme), [data.meanPaths, selectedAlgorithm, selectedPaths, theme]);

  useEffect(() => {
    if (!data.methods.some((method) => method.algorithm === selectedAlgorithm)) {
      setSelectedAlgorithm(data.methods[0]?.algorithm ?? "random_search");
    }
  }, [data.methods, selectedAlgorithm]);

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="平均年化 Sharpe 最高" value={bestSharpe ? optimizationAlgorithmLabels[bestSharpe.algorithm] : "—"} detail={formatNumber(bestSharpe?.meanSharpe)} />
      <MetricCard label="平均累计收益最高" value={bestReturn ? optimizationAlgorithmLabels[bestReturn.algorithm] : "—"} detail={formatPercent(bestReturn?.meanReturn)} />
      <MetricCard label="调优算法" value={`${data.methods.length}`} detail="种" />
      <MetricCard label="样本外净值路径" value={`${data.runs.length}`} detail="条" />
    </div>

    <Card className="gap-3 rounded-md py-4">
      <CardHeader className="px-4"><CardTitle className="text-sm font-medium">算法平均样本外净值</CardTitle></CardHeader>
      <CardContent className="px-4"><EChart height={360} option={comparisonOption} /></CardContent>
    </Card>

    <MethodTable data={data} />

    <Tabs value={selectedAlgorithm} onValueChange={(value) => setSelectedAlgorithm(value as OptimizationAlgorithm)}>
      <TabsList className="h-auto w-full gap-1 bg-muted/60 p-1" scrollable>
        {data.methods.map((method) => <TabsTrigger className="h-8 flex-none px-3" key={method.algorithm} value={method.algorithm}>{optimizationAlgorithmLabels[method.algorithm]}</TabsTrigger>)}
      </TabsList>
    </Tabs>

    {selectedMethod && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SmallMetric label="平均年化 Sharpe" value={formatNumber(selectedMethod.meanSharpe)} />
        <SmallMetric label="Sharpe 标准差" value={formatNumber(selectedMethod.sharpeDeviation)} />
        <SmallMetric label="平均累计收益" value={formatPercent(selectedMethod.meanReturn)} />
        <SmallMetric label="平均最大回撤" value={formatPercent(selectedMethod.meanMaxDrawdown)} />
        <SmallMetric label="正收益路径" value={formatPercent(selectedMethod.positiveRate)} />
      </div>
      <Card className="gap-3 rounded-md py-4">
        <CardHeader className="px-4"><CardTitle className="text-sm font-medium">{optimizationAlgorithmLabels[selectedAlgorithm]} · 全部重复净值路径</CardTitle></CardHeader>
        <CardContent className="px-4"><EChart height={360} option={repetitionOption} /></CardContent>
      </Card>
      <RunTable runs={selectedRuns} />
      <SelectionTable rows={selectedSelections} />
    </>}
  </div>;
}

function MetricCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return <Card className="gap-2 rounded-md border-l-2 border-l-primary/70 py-4"><CardContent className="px-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-2 flex items-baseline gap-2"><span className="truncate text-base font-semibold">{value}</span><span className="font-mono text-xs tabular-nums text-muted-foreground">{detail}</span></div></CardContent></Card>;
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border bg-card px-4 py-3 shadow-sm"><div className="text-xs text-muted-foreground">{label}</div><p className="mt-2 font-mono text-lg font-semibold tabular-nums">{value}</p></div>;
}

function MethodTable({ data }: { data: OptimizationReportData }) {
  return <div className="max-h-96 overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur"><TableRow><TableHead>调优算法</TableHead><TableHead className="text-right">重复</TableHead><MetricHead>平均累计收益</MetricHead><MetricHead>平均年化收益</MetricHead><MetricHead>平均年化 Sharpe</MetricHead><MetricHead>Sharpe 标准差</MetricHead><MetricHead>平均年化波动</MetricHead><MetricHead>平均最大回撤</MetricHead><MetricHead>正收益占比</MetricHead></TableRow></TableHeader><TableBody>{data.methods.map((method, index) => <TableRow key={method.algorithm}><TableCell className="font-medium"><span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{optimizationAlgorithmLabels[method.algorithm]}</TableCell><TableCell className="text-right tabular-nums">{method.repetitions}</TableCell><NumberCell value={method.meanReturn} percent /><NumberCell value={method.meanAnnualReturn} percent /><NumberCell value={method.meanSharpe} /><NumberCell value={method.sharpeDeviation} /><NumberCell value={method.meanVolatility} percent /><NumberCell value={method.meanMaxDrawdown} percent /><NumberCell value={method.positiveRate} percent /></TableRow>)}</TableBody></Table></div>;
}

function RunTable({ runs }: { runs: OptimizationReportData["runs"] }) {
  return <div className="max-h-80 overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 z-10 bg-muted/95"><TableRow><TableHead>重复</TableHead><TableHead className="text-right">交易日</TableHead><MetricHead>累计收益</MetricHead><MetricHead>年化收益</MetricHead><MetricHead>年化 Sharpe</MetricHead><MetricHead>年化波动</MetricHead><MetricHead>最大回撤</MetricHead></TableRow></TableHeader><TableBody>{runs.map((run) => <TableRow key={run.repetition}><TableCell>第 {run.repetition} 次</TableCell><TableCell className="text-right tabular-nums">{run.observations}</TableCell><NumberCell value={run.totalReturn} percent /><NumberCell value={run.annualReturn} percent /><NumberCell value={run.sharpe} /><NumberCell value={run.volatility} percent /><NumberCell value={run.maxDrawdown} percent /></TableRow>)}</TableBody></Table></div>;
}

function SelectionTable({ rows }: { rows: OptimizationReportData["selections"] }) {
  return <Card className="gap-3 rounded-md py-4"><CardHeader className="px-4"><CardTitle className="text-sm font-medium">滚动窗口参数选择</CardTitle></CardHeader><CardContent className="px-4"><div className="max-h-[420px] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 z-10 bg-muted/95"><TableRow><TableHead>重复</TableHead><TableHead>窗口</TableHead><TableHead>训练区间</TableHead><TableHead>持有区间</TableHead><MetricHead>训练年化 Sharpe</MetricHead><TableHead className="text-right">评估组合</TableHead><TableHead>初始参数</TableHead><TableHead>最终参数</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => { const initial = parameterText(row.initialParams); const selected = parameterText(row.selectedParams); return <TableRow key={`${row.repetition}-${row.window}`}><TableCell>{row.repetition}</TableCell><TableCell>{row.window}</TableCell><TableCell>{row.trainingStart} → {row.trainingEnd}</TableCell><TableCell>{row.holdingStart} → {row.holdingEnd}</TableCell><NumberCell value={row.trainingSharpe} /><TableCell className="text-right tabular-nums">{row.evaluationCount}</TableCell><TableCell className="max-w-72 truncate font-mono text-xs" title={initial}>{initial}</TableCell><TableCell className="max-w-72 truncate font-mono text-xs" title={selected}>{selected}</TableCell></TableRow>; })}</TableBody></Table></div></CardContent></Card>;
}

function MetricHead({ children }: { children: string }) { return <TableHead className="text-right">{children}</TableHead>; }

function NumberCell({ percent = false, value }: { percent?: boolean; value: number | null | undefined }) { return <TableCell className="text-right font-mono tabular-nums">{percent ? formatPercent(value) : formatNumber(value)}</TableCell>; }
function formatNumber(value: number | null | undefined) { return value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(3); }
function formatPercent(value: number | null | undefined) { return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(2)}%`; }
function parameterText(parameters: Record<string, number>) { return Object.entries(parameters).map(([name, value]) => `${name}=${value}`).join(" · ") || "—"; }

function comparisonChart(data: OptimizationReportData, theme: string) {
  return chartBase(theme, data.methods.map((method, index) => ({
    name: optimizationAlgorithmLabels[method.algorithm],
    type: "line",
    showSymbol: false,
    smooth: false,
    lineStyle: { width: 2 },
    color: colors[index % colors.length],
    data: data.meanPaths.filter((point) => point.algorithm === method.algorithm).map((point) => [point.time, point.mean])
  })));
}

function repetitionChart(algorithm: OptimizationAlgorithm, paths: OptimizationReportData["paths"], means: OptimizationReportData["meanPaths"], theme: string) {
  const repetitions = [...new Set(paths.map((point) => point.repetition))];
  const series = repetitions.map((repetition, index) => ({
    name: `第 ${repetition} 次`,
    type: "line",
    showSymbol: false,
    lineStyle: { width: 1, opacity: 0.28 },
    color: colors[index % colors.length],
    data: paths.filter((point) => point.repetition === repetition).map((point) => [point.time, point.netValue])
  }));
  series.push({
    name: "平均净值",
    type: "line",
    showSymbol: false,
    lineStyle: { width: 3, opacity: 1 },
    color: theme === "dark" ? "#f8fafc" : "#0f172a",
    data: means.filter((point) => point.algorithm === algorithm).map((point) => [point.time, point.mean])
  });
  return chartBase(theme, series);
}

function chartBase(theme: string, series: unknown[]) {
  const text = theme === "dark" ? "#9aa8b7" : "#64748b";
  const grid = theme === "dark" ? "rgba(148,163,184,.12)" : "rgba(15,23,42,.10)";
  return {
    animationDuration: 180,
    grid: { left: 52, right: 26, top: 44, bottom: 42, containLabel: true },
    legend: { type: "scroll", top: 0, left: 0, textStyle: { color: text, fontSize: 10 } },
    tooltip: { trigger: "axis" },
    xAxis: { type: "time", axisLabel: { color: text, fontSize: 9 }, axisLine: { lineStyle: { color: grid } }, splitLine: { show: false } },
    yAxis: { type: "value", scale: true, axisLabel: { color: text, fontSize: 9 }, axisLine: { show: false }, splitLine: { lineStyle: { color: grid } } },
    series
  };
}
