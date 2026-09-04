import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { backtestApi, canDeleteBacktestAnalysis } from "@/assets/lib/backtest";
import { SensitivityAnalytics, type SensitivityResultRow } from "@/assets/lib/sensitivity";
import { errorMessage } from "@/assets/lib/utils";
import { workflowsApi } from "@/assets/lib/workflows";
import EChart from "@/components/chart/EChart";
import DeleteConfirmationDialog from "@/components/modal/DeleteConfirmationDialog";
import { AnalysisHistoryItem, AnalysisHistoryPanel } from "@/components/panel/AnalysisHistoryPanel";
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
  const [deleteTarget, setDeleteTarget] = useState<BatchResearchListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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
    setDeleteTarget(null);
    setDeleting(false);
    setDeleteError("");
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
    const parsed = parseRateText(rateText);
    if (parsed.error !== null) {
      setError(parsed.error);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const created = await backtestApi.createFeeAnalysis(projectId, version, parsed.rates.map((rate) => rate / 100));
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

  async function deleteResearch() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await backtestApi.deleteBatchResearch(deleteTarget.id);
      setHistory((items) => items.filter((item) => item.id !== deleteTarget.id));
      if (research?.id === deleteTarget.id) {
        analytics.current?.close();
        analytics.current = null;
        setResearch(null);
        setResults([]);
      }
      setDeleteTarget(null);
    } catch (reason) {
      setDeleteError(errorMessage(reason));
    } finally {
      setDeleting(false);
    }
  }

  const successfulResults = results.filter((row) => row.status === "SUCCESS");
  const performanceOption = useMemo(() => feeChartOption(successfulResults, "performance"), [successfulResults]);
  const riskOption = useMemo(() => feeChartOption(successfulResults, "risk"), [successfulResults]);
  const running = research !== null && !terminalStates.has(research.state);

  return <>
  <Dialog open={open} onOpenChange={onOpenChange}>
    <LargeDialogContent className={research ? "flex flex-col overflow-hidden" : "flex !h-[34rem] max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden sm:!max-w-5xl xl:!w-[min(64rem,calc(100vw-6rem))]"}>
      <DialogHeader className="shrink-0 border-b pb-3 pr-8">
        <DialogTitle>{projectTitle} · v{version ?? "—"} · 手续费分析</DialogTitle>
        <DialogDescription>{research ? `研究 #${research.id} 使用一个工作流复用回测数据，依次计算 ${research.requested_count} 个手续费率。` : "选择一系列手续费率，在同一个 Runtime 工作流中复用查询数据和消息表完成全部回测。费率按百分比填写。"}</DialogDescription>
      </DialogHeader>
      {!research
        ? <div className="grid min-h-0 flex-1 gap-4 pt-1 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-md border bg-card">
            <div className="border-b px-4 py-3"><div className="text-sm font-medium">分析配置</div><div className="mt-1 text-xs text-muted-foreground">保留当前版本的其他参数，仅替换手续费率。</div></div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <label className="block space-y-2"><span className="text-sm font-medium">手续费率（%）</span><Input value={rateText} onChange={(event) => setRateText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /><span className="text-xs text-muted-foreground">用逗号分隔；完整区间数据只查询一次。</span></label>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><div className="rounded-md bg-muted/40 px-3 py-2"><span className="block text-foreground">变更字段</span><code className="font-mono">config.commission</code></div><div className="rounded-md bg-muted/40 px-3 py-2"><span className="block text-foreground">结果存储</span>所有费率写入同一结果文件</div></div>
              {version === null ? <div className="text-sm text-destructive">请先选择一个已保存的回测版本。</div> : null}
              {error ? <ErrorMessage message={error} /> : null}
            </div>
            <DialogFooter className="shrink-0 border-t px-4 py-3"><Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button><Button onClick={submit} disabled={submitting || version === null}>{submitting ? <Loader2 className="animate-spin" /> : <BarChart3 />}开始分析</Button></DialogFooter>
          </section>
          <AnalysisHistoryPanel count={history.length} emptyMessage="当前版本还没有手续费分析" title="历史分析">
            {history.map((item) => <AnalysisHistoryItem deleteDisabled={!canDeleteBacktestAnalysis(item.state)} deleteLabel={`删除手续费分析 ${item.id}`} description={`${item.requested_count} 个费率`} key={item.id} loading={loadingHistoryResearchId === item.id} onDelete={() => { setDeleteError(""); setDeleteTarget(item); }} onOpen={() => openHistory(item.id)} state={item.state} title={`研究 #${item.id}`} />)}
          </AnalysisHistoryPanel>
        </div>
        : <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-5 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3"><div className="flex flex-wrap items-center gap-3"><SchedulerState state={research.state} /><span className="text-sm text-muted-foreground">Workspace #{research.workflow_workspace_id}</span>{research.workflow_instance_id ? <span className="text-sm text-muted-foreground">Workflow #{research.workflow_instance_id}</span> : null}<span className="text-sm text-muted-foreground">成功 {research.completed_count} / 失败 {research.failed_count} / 共 {research.requested_count}</span></div><div className="flex items-center gap-2"><Button size="sm" variant="destructive" disabled={!canDeleteBacktestAnalysis(research.state)} onClick={() => { setDeleteError(""); setDeleteTarget(research); }}><Trash2 />删除分析</Button><Button size="sm" variant="outline" disabled={running} onClick={() => { setResearch(null); setResults([]); setError(""); }}><RefreshCw />新建分析</Button></div></div>
          {research.error ? <ErrorMessage message={research.error} /> : null}
          {running ? <LoadingPanel label="手续费分析工作流正在运行..." /> : loadingResults ? <LoadingPanel label="DuckDB 正在读取手续费分析结果..." /> : results.length ? <><div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><div className="rounded-md border bg-card p-3"><div className="mb-2 text-sm font-medium">收益与波动随手续费变化</div><EChart height={300} option={performanceOption} /></div><div className="rounded-md border bg-card p-3"><div className="mb-2 text-sm font-medium">风险调整收益随手续费变化</div><EChart height={300} option={riskOption} /></div></div><FeeResultTable results={results} /></> : null}
          {error ? <ErrorMessage message={error} /> : null}
          </div>
        </div>}
    </LargeDialogContent>
  </Dialog>
  <DeleteConfirmationDialog actionLabel="删除分析" description={`将永久删除手续费分析 #${deleteTarget?.id ?? ""}、关联工作流和结果文件。该操作不可撤销。`} error={deleteError} open={deleteTarget !== null} submitting={deleting} title={`删除手续费分析 #${deleteTarget?.id ?? ""}`} onDelete={deleteResearch} onOpenChange={(nextOpen) => { if (!nextOpen && !deleting) { setDeleteTarget(null); setDeleteError(""); } }} />
  </>;
}

function FeeResultTable({ results }: { results: SensitivityResultRow[] }) {
  return <div className="overflow-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>手续费率</TableHead><TableHead>状态</TableHead><TableHead className="text-right">累计收益</TableHead><TableHead className="text-right">年化收益</TableHead><TableHead className="text-right">年化 Sharpe</TableHead><TableHead className="text-right">年化波动</TableHead><TableHead className="text-right">最大回撤</TableHead><TableHead className="text-right">日胜率</TableHead><TableHead className="text-right">累计手续费</TableHead><TableHead>错误</TableHead></TableRow></TableHeader><TableBody>{results.map((row) => <TableRow key={row.caseIndex}><TableCell className="font-medium">{feeLabel(row.commission)}</TableCell><TableCell><SchedulerState state={row.status} /></TableCell><MetricCell value={row.metrics.totalReturn} percent /><MetricCell value={row.metrics.cagr} percent /><MetricCell value={row.metrics.sharpe} /><MetricCell value={row.metrics.volatility} percent /><MetricCell value={row.metrics.maxDrawdown} percent /><MetricCell value={row.metrics.winRate} percent /><MetricCell value={row.metrics.totalFee} currency /><TableCell className="max-w-96 truncate text-destructive">{row.error ?? "—"}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function MetricCell({ currency = false, percent = false, value }: { currency?: boolean; percent?: boolean; value: number | null | undefined }) { return <TableCell className="text-right font-mono tabular-nums">{formatMetric(value, percent, currency)}</TableCell>; }
function parseRateText(value: string): { error: string | null; rates: number[] } {
  const rates = value.split(/[，,\s]+/).filter(Boolean).map(Number);
  if (!rates.length || rates.some((rate) => !Number.isFinite(rate) || rate < 0 || rate > 100)) {
    return { error: "请输入至少一个 0 到 100 之间的手续费率，多个值用逗号分隔", rates: [] };
  }
  if (new Set(rates).size !== rates.length) return { error: "手续费率不能重复", rates: [] };
  return { error: null, rates };
}
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
    : [{ name: "年化 Sharpe", data: value("sharpe") }, { name: "年化 Sortino", data: value("sortino") }, { name: "Calmar 比率", data: value("calmar") }];
  return { animationDuration: 180, grid: { left: 48, right: 20, top: 40, bottom: 34, containLabel: true }, legend: { top: 0, left: 0 }, tooltip: { trigger: "axis" }, xAxis: { type: "category", data: labels, axisLabel: { interval: 0 } }, yAxis: { type: "value", axisLabel: { formatter: (axisValue: number) => kind === "performance" ? `${axisValue}%` : axisValue.toFixed(2) } }, series: series.map((item) => ({ ...item, type: "line", showSymbol: true, connectNulls: false })) };
}
