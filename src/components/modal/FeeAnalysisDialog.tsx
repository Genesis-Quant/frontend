import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";

import { backtestApi } from "@/assets/lib/backtest";
import { BacktestAnalytics } from "@/assets/lib/backtestAnalysis";
import { errorMessage } from "@/assets/lib/utils";
import EChart from "@/components/chart/EChart";
import SchedulerStateBadge from "@/components/badge/SchedulerStateBadge";
import type { BacktestParameters, BatchResearchItem, BatchResearchListItem, BatchResearchResponse } from "@/types/backtest";
import { quantStatsReport, type QuantStatsReport } from "@/assets/lib/quantstats";
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
  report: QuantStatsReport | null;
  totalFee: number | null;
};

const terminalBatchStates = new Set(["SUCCESS", "FAILURE", "PARTIAL_SUCCESS"]);
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
    setError("");
    loadFeeResults(batch.items)
      .then((next) => { if (!disposed) setResults(next); })
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

  const reportRows = results.filter((item) => item.report !== null);
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
          {history.length ? <div className="space-y-2 rounded-md border bg-card p-4"><div className="text-sm font-medium">已有手续费分析</div>{history.map((item) => <div className="flex items-center gap-3 text-sm" key={item.id}><span className="min-w-0 flex-1 truncate">研究 #{item.id} · {item.requested_count} 个费率</span><SchedulerStateBadge state={item.state} /><Button size="sm" variant="ghost" disabled={loadingHistoryResearchId !== null} onClick={() => openHistory(item.id)}>{loadingHistoryResearchId === item.id ? <Loader2 className="animate-spin" /> : "查看"}</Button></div>)}</div> : null}
          {version === null ? <div className="text-sm text-destructive">请先选择一个已保存的回测版本。</div> : null}
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button><Button onClick={submit} disabled={submitting || version === null}>{submitting ? <Loader2 className="animate-spin" /> : <BarChart3 />}提交批量分析</Button></DialogFooter>
          </div>
          : <div className="space-y-5 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3"><div className="flex items-center gap-3"><SchedulerStateBadge state={batch.state} /><span className="text-sm text-muted-foreground">已完成 {batch.completed_count}/{batch.requested_count}，失败 {batch.failed_count}</span></div><Button size="sm" variant="outline" onClick={() => { setBatch(null); setResults([]); setError(""); }}><RefreshCw />重新提交</Button></div>
          {batch.error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{batch.error}</div> : null}
          {loadingResults ? <div className="grid min-h-48 place-items-center rounded-md border bg-card"><div className="text-center"><Loader2 className="mx-auto animate-spin text-primary" /><div className="mt-3 text-sm text-muted-foreground">正在读取各费率的回测结果...</div></div></div> : reportRows.length ? <><div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><div className="rounded-md border bg-card p-3"><div className="mb-2 text-sm font-medium">收益与波动随手续费变化</div><EChart height={300} option={performanceOption} /></div><div className="rounded-md border bg-card p-3"><div className="mb-2 text-sm font-medium">风险调整收益随手续费变化</div><EChart height={300} option={riskOption} /></div></div><FeeResultTable results={results} /></> : <FeeProgressTable items={batch.items} />}
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          </div>}
      </div>
    </LargeDialogContent>
  </Dialog>;
}

async function loadFeeResults(items: BatchResearchItem[]) {
  const results: FeeResult[] = Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await loadFeeResult(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
  return results;
}

async function loadFeeResult(item: BatchResearchItem): Promise<FeeResult> {
  if (item.state !== "SUCCESS" && item.state !== "FORCED_SUCCESS") return { error: item.error, item, report: null, totalFee: null };
  if (item.workflow_instance_id === null) return { error: "工作流实例尚未生成", item, report: null, totalFee: null };
  try {
    const buffer = await backtestApi.output(item.workflow_instance_id, "daily_portfolios");
    const analytics = await BacktestAnalytics.create(item.workflow_instance_id, buffer);
    try {
      const portfolio = await analytics.portfolios();
      const parameters = item.parameters as unknown as BacktestParameters;
      const report = portfolio.length ? quantStatsReport(portfolio.map((row) => ({ time: row.time, value: row.dailyReturn ?? 0 })), parameters.annual_trading_days, parameters.risk_free_rate, true) : null;
      const fees = portfolio.flatMap((row) => row.dailyFee === null || row.dailyFee < 0 ? [] : [row.dailyFee]);
      return { error: null, item, report, totalFee: fees.length ? fees.reduce((sum, value) => sum + value, 0) : null };
    } finally {
      await analytics.close();
    }
  } catch (reason) {
    return { error: errorMessage(reason), item, report: null, totalFee: null };
  }
}

function FeeProgressTable({ items }: { items: BatchResearchItem[] }) {
  return <div className="overflow-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>手续费率</TableHead><TableHead>工作流</TableHead><TableHead>状态</TableHead><TableHead>错误</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell>{feeLabel(item)}</TableCell><TableCell className="font-mono">{item.workflow_instance_id ?? "—"}</TableCell><TableCell><SchedulerStateBadge state={item.state} /></TableCell><TableCell className="max-w-96 truncate text-destructive">{item.error ?? "—"}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function FeeResultTable({ results }: { results: FeeResult[] }) {
  return <div className="overflow-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>手续费率</TableHead><TableHead>状态</TableHead><TableHead className="text-right">累计收益</TableHead><TableHead className="text-right">年化收益</TableHead><TableHead className="text-right">夏普比率</TableHead><TableHead className="text-right">年化波动</TableHead><TableHead className="text-right">最大回撤</TableHead><TableHead className="text-right">胜率</TableHead><TableHead className="text-right">累计手续费</TableHead><TableHead>错误</TableHead></TableRow></TableHeader><TableBody>{results.map((result) => <TableRow key={result.item.id}><TableCell className="font-medium">{feeLabel(result.item)}</TableCell><TableCell>{result.report ? <SchedulerStateBadge state="SUCCESS" /> : <SchedulerStateBadge state={result.item.state} />}</TableCell><MetricCell value={result.report?.totalReturn} percent /><MetricCell value={result.report?.cagr} percent /><MetricCell value={result.report?.sharpe} /><MetricCell value={result.report?.volatility} percent /><MetricCell value={result.report?.maxDrawdown} percent /><MetricCell value={result.report?.winRate} percent /><MetricCell value={result.totalFee} currency /><TableCell className="max-w-96 truncate text-destructive">{result.error ?? "—"}</TableCell></TableRow>)}</TableBody></Table></div>;
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
  const value = (select: (report: QuantStatsReport) => number) => results.map((result) => result.report ? select(result.report) : null);
  const series = kind === "performance"
    ? [
    { name: "累计收益", data: value((report) => report.totalReturn * 100) },
    { name: "年化收益", data: value((report) => report.cagr * 100) },
    { name: "年化波动", data: value((report) => report.volatility * 100) },
    { name: "最大回撤", data: value((report) => report.maxDrawdown * 100) }
      ]
    : [
    { name: "夏普比率", data: value((report) => report.sharpe) },
    { name: "索提诺比率", data: value((report) => report.sortino) },
    { name: "卡尔玛比率", data: value((report) => report.calmar) }
      ];
  return { animationDuration: 180, grid: { left: 48, right: 20, top: 40, bottom: 34, containLabel: true }, legend: { top: 0, left: 0 }, tooltip: { trigger: "axis" }, xAxis: { type: "category", data: labels, axisLabel: { interval: 0 } }, yAxis: { type: "value", axisLabel: { formatter: (axisValue: number) => kind === "performance" ? `${axisValue}%` : axisValue.toFixed(2) } }, series: series.map((item) => ({ ...item, type: "line", showSymbol: true, connectNulls: false })) };
}
