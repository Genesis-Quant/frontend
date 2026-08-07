import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { mergeChartRanges } from "@/assets/lib/chart";
import { stockPoolCode, stockPools, type FactorAnalysisParameters, type FactorVersion, type FactorVersionListItem } from "@/types/factor";
import type { BacktestParameters, BacktestVersion, BacktestVersionListItem } from "@/types/backtest";
import type { BacktestChartRanges, FactorChartRanges } from "@/types/chart";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, LargeDialogContent } from "@/ui/dialog";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";

const FactorAnalysisReport = lazy(() => import("@/components/panel/FactorAnalysisReport"));
const BacktestReport = lazy(() => import("@/components/panel/BacktestReport"));
const ignoreMetrics = () => undefined;

type Version = FactorVersion | BacktestVersion;
type VersionListItem = FactorVersionListItem | BacktestVersionListItem;

type VersionCompareDialogProps = {
  currentVersion: Version | null;
  kind: "factor" | "backtest";
  loadVersion: (version: number) => Promise<Version>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectTitle: string;
  versions: VersionListItem[];
};

const backtestTabs = [
  { value: "overview", label: "回测概览" },
  { value: "trade_details", label: "交易记录" },
  { value: "daily_positions", label: "每日持仓" },
  { value: "daily_portfolios", label: "组合资产" },
  { value: "daily_trading_statistics", label: "交易统计" }
];

export default function VersionCompareDialog({ currentVersion, kind, loadVersion, onOpenChange, open, projectTitle, versions }: VersionCompareDialogProps) {
  const ordered = useMemo(() => [...versions].sort((left, right) => left.version - right.version), [versions]);
  const selectable = ordered.filter((version) => version.version !== currentVersion?.version);
  const [compareVersion, setCompareVersion] = useState<number | null>(null);
  const [result, setResult] = useState<{ left: Version; right: Version } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCompareVersion(selectable.at(-1)?.version ?? null);
    setError("");
  }, [currentVersion?.version, open, versions]);

  const selected = selectable.find((version) => version.version === compareVersion);

  async function compare() {
    if (!currentVersion || !selected || comparing) return;
    setComparing(true);
    setError("");
    try {
      const right = await loadVersion(selected.version);
      setResult({ left: currentVersion, right });
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setComparing(false);
    }
  }

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>选择对比版本</DialogTitle><DialogDescription>当前版本显示在左侧，选择的版本显示在右侧。</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <Label>对比版本</Label>
          <Select value={compareVersion === null ? undefined : String(compareVersion)} onValueChange={(value) => setCompareVersion(Number(value))}>
            <SelectTrigger className="w-full"><SelectValue placeholder="选择一个历史版本" /></SelectTrigger>
            <SelectContent>{selectable.map((version) => <SelectItem key={version.id} value={String(version.version)}>v{version.version}</SelectItem>)}</SelectContent>
          </Select>
          {selected?.remark ? <div className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 px-3 py-2 text-sm leading-5 text-muted-foreground">{selected.remark}</div> : null}
          {ordered.length < 2 ? <p className="text-sm text-muted-foreground">至少保存两个版本后才能对比。</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={!selected || !currentVersion || comparing} onClick={compare}>{comparing ? "正在读取" : "开始对比"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={result !== null} onOpenChange={(nextOpen) => { if (!nextOpen) setResult(null); }}>
      <LargeDialogContent className="flex flex-col overflow-hidden">
        <DialogHeader><DialogTitle>版本对比</DialogTitle><DialogDescription>左侧为当前版本，右侧为选择的对比版本。</DialogDescription></DialogHeader>
        {result ? <CompareResult kind={kind} left={result.left} projectTitle={projectTitle} right={result.right} /> : null}
      </LargeDialogContent>
    </Dialog>
  </>;
}

function CompareResult({ kind, left, projectTitle, right }: { kind: "factor" | "backtest"; left: Version; projectTitle: string; right: Version }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [leftFactorRanges, setLeftFactorRanges] = useState<FactorChartRanges>();
  const [rightFactorRanges, setRightFactorRanges] = useState<FactorChartRanges>();
  const [leftBacktestRanges, setLeftBacktestRanges] = useState<BacktestChartRanges>();
  const [rightBacktestRanges, setRightBacktestRanges] = useState<BacktestChartRanges>();
  const leftFactors = kind === "factor" ? (left.parameters as FactorAnalysisParameters).factor_columns : [];
  const rightFactors = kind === "factor" ? (right.parameters as FactorAnalysisParameters).factor_columns : [];
  const factorPairs = Array.from({ length: Math.max(leftFactors.length, rightFactors.length) }, (_, index) => ({ left: leftFactors[index] ?? "", right: rightFactors[index] ?? "" }));
  const [factorIndex, setFactorIndex] = useState("0");
  const pair = factorPairs[Number(factorIndex)] ?? factorPairs[0];
  const factorRanges = useMemo(() => mergeFactorRanges(leftFactorRanges, rightFactorRanges), [leftFactorRanges, rightFactorRanges]);
  const backtestRanges = useMemo(() => mergeBacktestRanges(leftBacktestRanges, rightBacktestRanges), [leftBacktestRanges, rightBacktestRanges]);

  useEffect(() => {
    setLeftFactorRanges(undefined);
    setRightFactorRanges(undefined);
  }, [factorIndex, left.id, right.id]);

  useEffect(() => {
    setLeftBacktestRanges(undefined);
    setRightBacktestRanges(undefined);
  }, [left.id, right.id]);

  return <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2"><VersionSummary accent="border-l-sky-500" kind={kind} projectTitle={projectTitle} version={left} /><VersionSummary accent="border-l-amber-500" kind={kind} projectTitle={projectTitle} version={right} /></div>
    {kind === "factor" && pair
      ? <>
      <Tabs value={factorIndex} onValueChange={setFactorIndex}><TabsList>{factorPairs.map((item, index) => <TabsTrigger key={`${item.left}-${item.right}-${index}`} value={String(index)}>{factorPairLabel(item)}</TabsTrigger>)}</TabsList></Tabs>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <ResultColumn accent="border-l-sky-500">{pair.left ? <Suspense fallback={<ReportLoading />}><FactorAnalysisReport chartRanges={factorRanges} factor={pair.left} key={`${left.workflow_instance_id}:${pair.left}`} parameters={left.parameters as FactorAnalysisParameters} workflowInstanceId={left.workflow_instance_id} onChartRanges={setLeftFactorRanges} onMetrics={ignoreMetrics} /></Suspense> : <MissingFactor />}</ResultColumn>
        <ResultColumn accent="border-l-amber-500">{pair.right ? <Suspense fallback={<ReportLoading />}><FactorAnalysisReport chartRanges={factorRanges} factor={pair.right} key={`${right.workflow_instance_id}:${pair.right}`} parameters={right.parameters as FactorAnalysisParameters} workflowInstanceId={right.workflow_instance_id} onChartRanges={setRightFactorRanges} onMetrics={ignoreMetrics} /></Suspense> : <MissingFactor />}</ResultColumn>
      </div>
      </>
      : null}
    {kind === "backtest"
      ? <>
      <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList>{backtestTabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}</TabsList></Tabs>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <ResultColumn accent="border-l-sky-500"><Suspense fallback={<ReportLoading />}><BacktestReport activeTab={activeTab} annualTradingDays={(left.parameters as BacktestParameters).annual_trading_days} chartRanges={backtestRanges} riskFreeRate={(left.parameters as BacktestParameters).risk_free_rate} showTabs={false} workflowInstanceId={left.workflow_instance_id} onActiveTabChange={setActiveTab} onChartRanges={setLeftBacktestRanges} onSummary={ignoreMetrics} /></Suspense></ResultColumn>
        <ResultColumn accent="border-l-amber-500"><Suspense fallback={<ReportLoading />}><BacktestReport activeTab={activeTab} annualTradingDays={(right.parameters as BacktestParameters).annual_trading_days} chartRanges={backtestRanges} riskFreeRate={(right.parameters as BacktestParameters).risk_free_rate} showTabs={false} workflowInstanceId={right.workflow_instance_id} onActiveTabChange={setActiveTab} onChartRanges={setRightBacktestRanges} onSummary={ignoreMetrics} /></Suspense></ResultColumn>
      </div>
      </>
      : null}
  </div>;
}

function mergeFactorRanges(left?: FactorChartRanges, right?: FactorChartRanges): FactorChartRanges {
  return {
    information: { primary: mergeChartRanges(left?.information?.primary, right?.information?.primary), secondary: mergeChartRanges(left?.information?.secondary, right?.information?.secondary) },
    longShort: { primary: mergeChartRanges(left?.longShort?.primary, right?.longShort?.primary), secondary: mergeChartRanges(left?.longShort?.secondary, right?.longShort?.secondary) },
    groupStatistics: mergeChartRanges(left?.groupStatistics, right?.groupStatistics),
    groups: mergeChartRanges(left?.groups, right?.groups),
    decay: mergeChartRanges(left?.decay, right?.decay)
  };
}

function mergeBacktestRanges(left?: BacktestChartRanges, right?: BacktestChartRanges): BacktestChartRanges {
  return { netValue: mergeChartRanges(left?.netValue, right?.netValue), totalEquity: mergeChartRanges(left?.totalEquity, right?.totalEquity), drawdown: mergeChartRanges(left?.drawdown, right?.drawdown), rollingSharpe: mergeChartRanges(left?.rollingSharpe, right?.rollingSharpe) };
}

function VersionSummary({ accent, kind, projectTitle, version }: { accent: string; kind: "factor" | "backtest"; projectTitle: string; version: Version }) {
  const fields = kind === "factor" ? factorSummary(version.parameters as FactorAnalysisParameters) : backtestSummary(version.parameters as BacktestParameters);
  return <div className={`min-w-0 space-y-3 rounded-md border border-l-4 bg-card p-3 ${accent}`}>
    <div><div className="truncate text-sm font-medium">{projectTitle}</div><div className="mt-0.5 text-xs text-muted-foreground">v{version.version}</div></div>
    <div className={`h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/20 px-3 py-2 text-sm leading-6 ${version.remark.trim() ? "text-muted-foreground" : "text-muted-foreground/70"}`}>{version.remark.trim() || "无备注"}</div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-muted/25 p-3 text-xs">{fields.map(([label, value]) => <div className="min-w-0" key={label}><div className="text-muted-foreground">{label}</div><div className="mt-0.5 truncate font-medium tabular-nums" title={value}>{value}</div></div>)}</div>
  </div>;
}

function ResultColumn({ accent, children }: { accent: string; children: React.ReactNode }) { return <div className={`min-w-0 rounded-md border border-l-4 bg-card p-3 ${accent}`}>{children}</div>; }
function ReportLoading() { return <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">正在加载报告</div>; }
function MissingFactor() { return <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">该版本没有对应因子</div>; }
function factorPairLabel(pair: { left: string; right: string }) { return pair.left === pair.right ? pair.left : `${pair.left || "—"} / ${pair.right || "—"}`; }

function factorSummary(parameters: FactorAnalysisParameters): string[][] {
  const pool = stockPools.find((item) => item.value === stockPoolCode(parameters))?.label ?? stockPoolCode(parameters);
  return [["日期范围", `${parameters.dataset_query.start_date} — ${parameters.dataset_query.end_date}`], ["股票池", pool], ["回溯周期", parameters.dataset_query.lookback], ["分组数量", String(parameters.n_groups)], ["因子", parameters.factor_columns.join(", ") || "—"], ["收益列", parameters.return_columns.join(", ") || "—"]];
}

function backtestSummary(parameters: BacktestParameters): string[][] {
  return [["日期范围", `${parameters.dataset_query.start_date} — ${parameters.dataset_query.end_date}`], ["初始资金", Number(parameters.config.cash ?? 0).toLocaleString("zh-CN")], ["复权方式", parameters.adj ?? "不复权"], ["年化交易日", String(parameters.annual_trading_days)], ["无风险利率", String(parameters.risk_free_rate)], ["回溯周期", parameters.dataset_query.lookback]];
}
