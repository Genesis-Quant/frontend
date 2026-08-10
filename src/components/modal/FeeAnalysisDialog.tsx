import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";

import { backtestApi } from "@/assets/lib/backtest";
import { errorMessage } from "@/assets/lib/utils";
import EChart from "@/components/chart/EChart";
import SchedulerState from "@/components/status/SchedulerState";
import type { BatchResearchItem, BatchResearchListItem, BatchResearchResponse } from "@/types/backtest";
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

type FeeResult = {
  error: string | null;
  item: BatchResearchItem;
  metrics: Record<string, number | null> | null;
};

const resultReadyBatchStates = new Set(["SUCCESS", "FAILURE", "PARTIAL_SUCCESS", "RESULT_PENDING"]);
const defaultRateText = "0, 0.01, 0.03, 0.05, 0.1";

export default function FeeAnalysisDialog({ onOpenChange, open, projectId, projectTitle, version }: FeeAnalysisDialogProps) {
  const [rateText, setRateText] = useState(defaultRateText);
  const [batch, setBatch] = useState<BatchResearchResponse | null>(null);
  const [history, setHistory] = useState<BatchResearchListItem[]>([]);
  const [results, setResults] = useState<FeeResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingHistoryResearchId, setLoadingHistoryResearchId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRateText(defaultRateText);
    setBatch(null);
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
    backtestApi.listBatchResearch(projectId, version, "fee_analysis", 1, 100).then((page) => {
      if (!disposed) setHistory(page.items);
    }).catch(() => undefined);
    return () => { disposed = true; };
  }, [open, projectId, version]);

  useEffect(() => {
    if (!open || !batch || resultReadyBatchStates.has(batch.state)) return undefined;
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
    if (!open || !batch || !resultReadyBatchStates.has(batch.state)) return undefined;
    const pending = batch.items.some((item) => successful(item) && item.metrics === null && item.result_error === null);
    if (!pending) {
      setResults(feeResults(batch.items));
      setLoadingResults(false);
      return undefined;
    }
    let disposed = false;
    setLoadingResults(true);
    setError("");
    backtestApi.calculateBatchResearch(batch.id)
      .then((next) => { if (!disposed) { setBatch(next); setResults(feeResults(next.items)); } })
      .catch((reason) => { if (!disposed) setError(errorMessage(reason)); })
      .finally(() => { if (!disposed) setLoadingResults(false); });
    return () => { disposed = true; };
  }, [batch, open]);

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
      setBatch(await backtestApi.createFeeAnalysis(projectId, version, rates.map((rate) => rate / 100)));
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

  async function retryResults() {
    if (!batch || loadingResults) return;
    setLoadingResults(true);
    setError("");
    try {
      const next = await backtestApi.calculateBatchResearch(batch.id);
      setBatch(next);
      setResults(feeResults(next.items));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoadingResults(false);
    }
  }

  const reportRows = results.filter((item) => item.metrics !== null);
  const retryableResults = batch?.items.some((item) => successful(item) && item.metrics === null) ?? false;
  const performanceOption = useMemo(() => feeChartOption(reportRows, "performance"), [reportRows]);
  const riskOption = useMemo(() => feeChartOption(reportRows, "risk"), [reportRows]);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <LargeDialogContent className="flex flex-col overflow-hidden">
      <DialogHeader>
        <DialogTitle>{projectTitle} · v{version ?? "—"} · 手续费分析</DialogTitle>
        <DialogDescription>{batch ? `批量研究 #${batch.id}，每个费率对应一个独立回测工作流。` : "选择一系列手续费率，基于当前保存版本批量提交回测。费率按百分比填写。"}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {!batch
          ? <div className="mx-auto max-w-xl space-y-5 py-4">
          <div className="rounded-md border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">批量研究会保留原版本的全部回测参数，只替换 <code className="rounded bg-muted px-1 font-mono text-xs">config.commission</code>。任务完成后可以比较收益、风险和手续费随费率的变化。</div>
          <label className="block space-y-2"><span className="text-sm font-medium">手续费率（%）</span><Input value={rateText} onChange={(event) => setRateText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /><span className="text-xs text-muted-foreground">用逗号分隔多个费率。</span></label>
          {history.length ? <div className="space-y-2 rounded-md border bg-card p-4"><div className="text-sm font-medium">已有手续费分析</div>{history.map((item) => <div className="flex items-center gap-3 text-sm" key={item.id}><span className="min-w-0 flex-1 truncate">研究 #{item.id} · {item.requested_count} 个费率</span><SchedulerState state={item.state} /><Button size="sm" variant="ghost" disabled={loadingHistoryResearchId !== null} onClick={() => openHistory(item.id)}>{loadingHistoryResearchId === item.id ? <Loader2 className="animate-spin" /> : "查看"}</Button></div>)}</div> : null}
          {version === null ? <div className="text-sm text-destructive">请先选择一个已保存的回测版本。</div> : null}
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button><Button onClick={submit} disabled={submitting || version === null}>{submitting ? <Loader2 className="animate-spin" /> : <BarChart3 />}提交批量分析</Button></DialogFooter>
          </div>
          : <div className="space-y-5 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3"><div className="flex items-center gap-3"><SchedulerState state={batch.state} /><span className="text-sm text-muted-foreground">已完成 {batch.completed_count}/{batch.requested_count}，失败 {batch.failed_count}</span></div><div className="flex gap-2">{retryableResults ? <Button disabled={loadingResults} size="sm" variant="outline" onClick={retryResults}>{loadingResults ? <Loader2 className="animate-spin" /> : <RefreshCw />}重试生成结果</Button> : null}<Button size="sm" variant="outline" onClick={() => { setBatch(null); setResults([]); setError(""); }}><RefreshCw />重新提交</Button></div></div>
          {batch.error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{batch.error}</div> : null}
          {loadingResults ? <div className="grid min-h-48 place-items-center rounded-md border bg-card"><div className="text-center"><Loader2 className="mx-auto animate-spin text-primary" /><div className="mt-3 text-sm text-muted-foreground">正在生成手续费分析结果...</div></div></div> : reportRows.length ? <><div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><div className="rounded-md border bg-card p-3"><div className="mb-2 text-sm font-medium">收益与波动随手续费变化</div><EChart height={300} option={performanceOption} /></div><div className="rounded-md border bg-card p-3"><div className="mb-2 text-sm font-medium">风险调整收益随手续费变化</div><EChart height={300} option={riskOption} /></div></div><FeeResultTable results={results} /></> : <FeeProgressTable items={batch.items} />}
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          </div>}
      </div>
    </LargeDialogContent>
  </Dialog>;
}

function feeResults(items: BatchResearchItem[]): FeeResult[] {
  return items.map((item) => ({ error: item.result_error ?? item.error, item, metrics: item.metrics }));
}

function successful(item: BatchResearchItem) {
  return item.state === "SUCCESS" || item.state === "FORCED_SUCCESS";
}

function FeeProgressTable({ items }: { items: BatchResearchItem[] }) {
  return <div className="overflow-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>手续费率</TableHead><TableHead>工作流</TableHead><TableHead>状态</TableHead><TableHead>错误</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell>{feeLabel(item)}</TableCell><TableCell className="font-mono">{item.workflow_instance_id ?? "—"}</TableCell><TableCell><SchedulerState state={item.state} /></TableCell><TableCell className="max-w-96 truncate text-destructive">{item.result_error ?? item.error ?? "—"}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function FeeResultTable({ results }: { results: FeeResult[] }) {
  return <div className="overflow-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>手续费率</TableHead><TableHead>状态</TableHead><TableHead className="text-right">累计收益</TableHead><TableHead className="text-right">年化收益</TableHead><TableHead className="text-right">夏普比率</TableHead><TableHead className="text-right">年化波动</TableHead><TableHead className="text-right">最大回撤</TableHead><TableHead className="text-right">胜率</TableHead><TableHead className="text-right">累计手续费</TableHead><TableHead>错误</TableHead></TableRow></TableHeader><TableBody>{results.map((result) => <TableRow key={result.item.id}><TableCell className="font-medium">{feeLabel(result.item)}</TableCell><TableCell>{result.metrics ? <SchedulerState state="SUCCESS" /> : <SchedulerState state={result.item.state} />}</TableCell><MetricCell value={result.metrics?.totalReturn} percent /><MetricCell value={result.metrics?.cagr} percent /><MetricCell value={result.metrics?.sharpe} /><MetricCell value={result.metrics?.volatility} percent /><MetricCell value={result.metrics?.maxDrawdown} percent /><MetricCell value={result.metrics?.winRate} percent /><MetricCell value={result.metrics?.totalFee} currency /><TableCell className="max-w-96 truncate text-destructive">{result.error ?? "—"}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function MetricCell({ currency = false, percent = false, value }: { currency?: boolean; percent?: boolean; value: number | null | undefined }) {
  return <TableCell className="text-right font-mono tabular-nums">{formatMetric(value, percent, currency)}</TableCell>;
}

function feeLabel(item: BatchResearchItem) {
  const config = item.parameters.config;
  const commission = config && typeof config === "object" && !Array.isArray(config) ? Number((config as Record<string, unknown>).commission) : Number.NaN;
  return Number.isFinite(commission) ? `${(commission * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%` : "—";
}

function parseRateText(value: string) {
  const rates = value.split(/[，,\s]+/).filter(Boolean).map(Number);
  if (!rates.length || rates.some((rate) => !Number.isFinite(rate) || rate < 0 || rate > 100)) return [];
  return [...new Set(rates)].sort((left, right) => left - right);
}

function formatMetric(value: number | null | undefined, percent = false, currency = false) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (percent) return `${(value * 100).toFixed(2)}%`;
  if (currency) return `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
  return value.toFixed(3);
}

function feeChartOption(results: FeeResult[], kind: "performance" | "risk") {
  const labels = results.map((result) => feeLabel(result.item));
  const value = (name: string) => results.map((result) => result.metrics?.[name] ?? null);
  const series = kind === "performance"
    ? [
    { name: "累计收益", data: value("totalReturn").map(percentValue) },
    { name: "年化收益", data: value("cagr").map(percentValue) },
    { name: "年化波动", data: value("volatility").map(percentValue) },
    { name: "最大回撤", data: value("maxDrawdown").map(percentValue) }
      ]
    : [
    { name: "夏普比率", data: value("sharpe") },
    { name: "索提诺比率", data: value("sortino") },
    { name: "卡尔玛比率", data: value("calmar") }
      ];
  return { animationDuration: 180, grid: { left: 48, right: 20, top: 40, bottom: 34, containLabel: true }, legend: { top: 0, left: 0 }, tooltip: { trigger: "axis" }, xAxis: { type: "category", data: labels, axisLabel: { interval: 0 } }, yAxis: { type: "value", axisLabel: { formatter: (axisValue: number) => kind === "performance" ? `${axisValue}%` : axisValue.toFixed(2) } }, series: series.map((item) => ({ ...item, type: "line", showSymbol: true, connectNulls: false })) };
}

function percentValue(value: number | null) { return value === null ? null : value * 100; }
