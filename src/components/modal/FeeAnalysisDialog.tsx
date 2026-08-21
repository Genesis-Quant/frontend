import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";

import { backtestApi } from "@/assets/lib/backtest";
import { SensitivityAnalytics, type SensitivityResultRow } from "@/assets/lib/sensitivity";
import { errorMessage } from "@/assets/lib/utils";
import { workflowsApi } from "@/assets/lib/workflows";
import EChart from "@/components/chart/EChart";
import SchedulerState from "@/components/status/SchedulerState";
import type { BatchResearchListItem, BatchResearchResponse } from "@/types/backtest";
import { terminalStates } from "@/types/workflow";
import { Button } from "@/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, LargeDialogContent } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";

type FeeAnalysisDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: number;
  projectTitle: string;
  version: number | null;
};

const successStates = new Set(["SUCCESS"]);
const defaultRateText = "0, 0.01, 0.03, 0.05, 0.1";

export default function FeeAnalysisDialog({ onOpenChange, open, projectId, projectTitle, version }: FeeAnalysisDialogProps) {
  const [rateText, setRateText] = useState(defaultRateText);
  const [research, setResearch] = useState<BatchResearchResponse | null>(null);
  const [history, setHistory] = useState<BatchResearchListItem[]>([]);
  const [results, setResults] = useState<SensitivityResultRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingHistoryResearchId, setLoadingHistoryResearchId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const resultRequest = useRef(0);
  const analytics = useRef<SensitivityAnalytics | null>(null);

  useEffect(() => {
    if (!open) return;
    setRateText(defaultRateText);
    setResearch(null);
    setResults([]);
    setHistory([]);
    setSubmitting(false);
    setLoadingResults(false);
    setLoadingHistoryResearchId(null);
    setError("");
  }, [open, projectId, version]);

  useEffect(() => {
    if (!open || version === null) return undefined;
    let disposed = false;
    backtestApi.listBatchResearch(projectId, version, "fee_analysis", 1, 100)
      .then((page) => { if (!disposed) setHistory(page.items); })
      .catch((reason) => { if (!disposed) setError(errorMessage(reason)); });
    return () => { disposed = true; };
  }, [open, projectId, version]);

  useEffect(() => {
    if (!open || !research || terminalStates.has(research.state)) return undefined;
    let disposed = false;
    let polling = false;
    const refresh = async () => {
      if (polling) return;
      polling = true;
      try {
        const status = await workflowsApi.workspaceStatus(research.workflow_workspace_id);
        if (disposed) return;
        if (terminalStates.has(status.state)) {
          const current = await backtestApi.getBatchResearch(research.id);
          if (!disposed) {
            setResearch(current);
            setHistory((items) => items.map((item) => item.id === current.id ? current : item));
          }
        } else {
          setResearch((current) => current?.id === research.id ? { ...current, workflow_instance_id: status.workflow_instance_id, state: status.state, error: status.error, updated_at: status.updated_at } : current);
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
  }, [open, research?.id, research?.state, research?.workflow_workspace_id]);

  useEffect(() => {
    const requestId = ++resultRequest.current;
    analytics.current?.close();
    analytics.current = null;
    setResults([]);
    if (!open || !research || !successStates.has(research.state)) {
      setLoadingResults(false);
      return undefined;
    }
    let disposed = false;
    setLoadingResults(true);
    setError("");
    backtestApi.batchResearchOutput(research.id, "results").then(async (buffer) => {
      const nextAnalytics = await SensitivityAnalytics.create(research.id, buffer);
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
  }, [open, research?.id, research?.state]);

  useEffect(() => () => { analytics.current?.close(); }, []);

  async function submit() {
    if (version === null || submitting) return;
    const rates = parseRateText(rateText);
    if (!rates.length) {
      setError("请输入至少一个 0 到 100 之间的手续费率，多个值用逗号分隔");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const created = await backtestApi.createFeeAnalysis(projectId, version, rates.map((rate) => rate / 100));
      setResearch(created);
      setHistory((items) => [created, ...items.filter((item) => item.id !== created.id)]);
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
      setResearch(await backtestApi.getBatchResearch(researchId));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoadingHistoryResearchId(null);
    }
  }

  const successfulResults = results.filter((row) => row.status === "SUCCESS");
  const performanceOption = useMemo(() => feeChartOption(successfulResults, "performance"), [successfulResults]);
  const riskOption = useMemo(() => feeChartOption(successfulResults, "risk"), [successfulResults]);
  const running = research !== null && !terminalStates.has(research.state);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <LargeDialogContent className="flex flex-col overflow-hidden">
      <DialogHeader>
        <DialogTitle>{projectTitle} · v{version ?? "—"} · 手续费分析</DialogTitle>
        <DialogDescription>{research ? `研究 #${research.id} 使用一个工作流复用回测数据，依次计算 ${research.requested_count} 个手续费率。` : "选择一系列手续费率，在同一个 Runtime 工作流中复用查询数据和消息表完成全部回测。费率按百分比填写。"}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {!research
          ? <div className="mx-auto max-w-xl space-y-5 py-4">
          <div className="rounded-md border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">分析保留当前版本的全部策略参数，只依次替换 <code className="rounded bg-muted px-1 font-mono text-xs">config.commission</code>。完整区间数据只查询一次，各费率结果写入同一个 Parquet。</div>
          <label className="block space-y-2"><span className="text-sm font-medium">手续费率（%）</span><Input value={rateText} onChange={(event) => setRateText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /><span className="text-xs text-muted-foreground">用逗号分隔多个费率。</span></label>
          {history.length ? <div className="space-y-2 rounded-md border bg-card p-4"><div className="text-sm font-medium">已有手续费分析</div>{history.map((item) => <div className="flex items-center gap-3 text-sm" key={item.id}><span className="min-w-0 flex-1 truncate">研究 #{item.id} · {item.requested_count} 个费率</span><SchedulerState state={item.state} /><Button size="sm" variant="ghost" disabled={loadingHistoryResearchId !== null} onClick={() => openHistory(item.id)}>{loadingHistoryResearchId === item.id ? <Loader2 className="animate-spin" /> : "查看"}</Button></div>)}</div> : null}
          {version === null ? <div className="text-sm text-destructive">请先选择一个已保存的回测版本。</div> : null}
          {error ? <ErrorMessage message={error} /> : null}
          <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button><Button onClick={submit} disabled={submitting || version === null}>{submitting ? <Loader2 className="animate-spin" /> : <BarChart3 />}开始分析</Button></DialogFooter>
          </div>
          : <div className="space-y-5 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3"><div className="flex flex-wrap items-center gap-3"><SchedulerState state={research.state} /><span className="text-sm text-muted-foreground">Workspace #{research.workflow_workspace_id}</span>{research.workflow_instance_id ? <span className="text-sm text-muted-foreground">Workflow #{research.workflow_instance_id}</span> : null}<span className="text-sm text-muted-foreground">成功 {research.completed_count} / 失败 {research.failed_count} / 共 {research.requested_count}</span></div><Button size="sm" variant="outline" disabled={running} onClick={() => { setResearch(null); setResults([]); setError(""); }}><RefreshCw />新建分析</Button></div>
          {research.error ? <ErrorMessage message={research.error} /> : null}
          {running ? <LoadingPanel label="手续费分析工作流正在运行..." /> : loadingResults ? <LoadingPanel label="DuckDB 正在读取手续费分析结果..." /> : results.length ? <><div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><div className="rounded-md border bg-card p-3"><div className="mb-2 text-sm font-medium">收益与波动随手续费变化</div><EChart height={300} option={performanceOption} /></div><div className="rounded-md border bg-card p-3"><div className="mb-2 text-sm font-medium">风险调整收益随手续费变化</div><EChart height={300} option={riskOption} /></div></div><FeeResultTable results={results} /></> : null}
          {error ? <ErrorMessage message={error} /> : null}
          </div>}
      </div>
    </LargeDialogContent>
  </Dialog>;
}

function FeeResultTable({ results }: { results: SensitivityResultRow[] }) {
  return <div className="overflow-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>手续费率</TableHead><TableHead>状态</TableHead><TableHead className="text-right">累计收益</TableHead><TableHead className="text-right">年化收益</TableHead><TableHead className="text-right">夏普比率</TableHead><TableHead className="text-right">年化波动</TableHead><TableHead className="text-right">最大回撤</TableHead><TableHead className="text-right">胜率</TableHead><TableHead className="text-right">累计手续费</TableHead><TableHead>错误</TableHead></TableRow></TableHeader><TableBody>{results.map((row) => <TableRow key={row.caseIndex}><TableCell className="font-medium">{feeLabel(row.commission)}</TableCell><TableCell><SchedulerState state={row.status} /></TableCell><MetricCell value={row.metrics.totalReturn} percent /><MetricCell value={row.metrics.cagr} percent /><MetricCell value={row.metrics.sharpe} /><MetricCell value={row.metrics.volatility} percent /><MetricCell value={row.metrics.maxDrawdown} percent /><MetricCell value={row.metrics.winRate} percent /><MetricCell value={row.metrics.totalFee} currency /><TableCell className="max-w-96 truncate text-destructive">{row.error ?? "—"}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function MetricCell({ currency = false, percent = false, value }: { currency?: boolean; percent?: boolean; value: number | null | undefined }) { return <TableCell className="text-right font-mono tabular-nums">{formatMetric(value, percent, currency)}</TableCell>; }
function parseRateText(value: string) { const rates = value.split(/[，,\s]+/).filter(Boolean).map(Number); if (!rates.length || rates.some((rate) => !Number.isFinite(rate) || rate < 0 || rate > 100)) return []; return [...new Set(rates)].sort((left, right) => left - right); }
function feeLabel(commission: number) { return `${(commission * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`; }
function formatMetric(value: number | null | undefined, percent = false, currency = false) { if (value === null || value === undefined || !Number.isFinite(value)) return "—"; if (percent) return `${(value * 100).toFixed(2)}%`; if (currency) return `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`; return value.toFixed(3); }
function percentValue(value: number | null) { return value === null ? null : value * 100; }
function ErrorMessage({ message }: { message: string }) { return <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{message}</div>; }
function LoadingPanel({ label }: { label: string }) { return <div className="grid min-h-48 place-items-center rounded-md border bg-card"><div className="text-center"><Loader2 className="mx-auto animate-spin text-primary" /><div className="mt-3 text-sm text-muted-foreground">{label}</div></div></div>; }

function feeChartOption(results: SensitivityResultRow[], kind: "performance" | "risk") {
  const labels = results.map((row) => feeLabel(row.commission));
  const value = (name: keyof SensitivityResultRow["metrics"]) => results.map((row) => row.metrics[name]);
  const series = kind === "performance"
    ? [{ name: "累计收益", data: value("totalReturn").map(percentValue) }, { name: "年化收益", data: value("cagr").map(percentValue) }, { name: "年化波动", data: value("volatility").map(percentValue) }, { name: "最大回撤", data: value("maxDrawdown").map(percentValue) }]
    : [{ name: "夏普比率", data: value("sharpe") }, { name: "索提诺比率", data: value("sortino") }, { name: "卡尔玛比率", data: value("calmar") }];
  return { animationDuration: 180, grid: { left: 48, right: 20, top: 40, bottom: 34, containLabel: true }, legend: { top: 0, left: 0 }, tooltip: { trigger: "axis" }, xAxis: { type: "category", data: labels, axisLabel: { interval: 0 } }, yAxis: { type: "value", axisLabel: { formatter: (axisValue: number) => kind === "performance" ? `${axisValue}%` : axisValue.toFixed(2) } }, series: series.map((item) => ({ ...item, type: "line", showSymbol: true, connectNulls: false })) };
}
