import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { mergeChartRanges } from "@/assets/lib/chart";
import { normalizeAnalysisParameters, stockPoolLabel, stockPools, type FactorAnalysisParameters, type FactorVersion, type FactorVersionListItem } from "@/types/factor";
import type { BacktestParameters, BacktestVersion, BacktestVersionListItem } from "@/types/backtest";
import type { BacktestChartRanges, FactorChartRanges } from "@/types/chart";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, LargeDialogContent } from "@/ui/dialog";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";

const FactorAnalysisReport = lazy(() => import("@/components/panel/FactorAnalysisReport"));
const BacktestReport = lazy(() => import("@/components/panel/BacktestReport"));

export type CompareVersion = FactorVersion | BacktestVersion;
type VersionListItem = FactorVersionListItem | BacktestVersionListItem;

type VersionCompareDialogProps = {
  currentVersion: CompareVersion | null;
  currentVersionNumber: number;
  kind: "factor" | "backtest";
  loadVersion: (version: number) => Promise<CompareVersion>;
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

export default function VersionCompareDialog({ currentVersion, currentVersionNumber, kind, loadVersion, onOpenChange, open, projectTitle, versions }: VersionCompareDialogProps) {
  const ordered = useMemo(() => versions.filter((version) => version.saved || version.is_current).sort((left, right) => left.version - right.version), [versions]);
  const selectable = ordered.filter((version) => version.version !== currentVersionNumber);
  const [compareVersion, setCompareVersion] = useState<number | null>(null);
  const [result, setResult] = useState<{ left: CompareVersion; right: CompareVersion } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCompareVersion(selectable.at(-1)?.version ?? null);
    setError("");
  }, [currentVersionNumber, open, versions]);

  const selected = selectable.find((version) => version.version === compareVersion);

  async function compare() {
    if (!selected || comparing) return;
    setComparing(true);
    setError("");
    try {
      const [left, right] = await Promise.all([currentVersion ?? loadVersion(currentVersionNumber), loadVersion(selected.version)]);
      setResult({
        left: normalizeCompareVersion(kind, left),
        right: normalizeCompareVersion(kind, right)
      });
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
            <SelectContent>{selectable.map((version) => <SelectItem key={version.id} value={String(version.version)}>v{version.version}{version.saved ? "" : " · 未保存"}</SelectItem>)}</SelectContent>
          </Select>
          {selected?.remark ? <div className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 px-3 py-2 text-sm leading-5 text-muted-foreground">{selected.remark}</div> : null}
          {ordered.length < 2 ? <p className="text-sm text-muted-foreground">至少需要两个版本才能对比。</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={!selected || comparing} onClick={compare}>{comparing ? "正在读取" : "开始对比"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={result !== null} onOpenChange={(nextOpen) => { if (!nextOpen) setResult(null); }}>
      <LargeDialogContent className="flex flex-col overflow-hidden">
        <DialogHeader><DialogTitle>版本对比</DialogTitle><DialogDescription>左侧为当前版本，右侧为选择的对比版本。</DialogDescription></DialogHeader>
        {result ? <VersionCompareResult kind={kind} left={result.left} leftProjectTitle={projectTitle} right={result.right} rightProjectTitle={projectTitle} /> : null}
      </LargeDialogContent>
    </Dialog>
  </>;
}

export function VersionCompareResult({ kind, left, leftProjectTitle, right, rightProjectTitle }: { kind: "factor" | "backtest"; left: CompareVersion; leftProjectTitle: string; right: CompareVersion; rightProjectTitle: string }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [leftFactorRanges, setLeftFactorRanges] = useState<FactorChartRanges>();
  const [rightFactorRanges, setRightFactorRanges] = useState<FactorChartRanges>();
  const [leftBacktestRanges, setLeftBacktestRanges] = useState<BacktestChartRanges>();
  const [rightBacktestRanges, setRightBacktestRanges] = useState<BacktestChartRanges>();
  const leftFactorParameters = kind === "factor" ? left.parameters as FactorAnalysisParameters : null;
  const rightFactorParameters = kind === "factor" ? right.parameters as FactorAnalysisParameters : null;
  const leftFactors = leftFactorParameters?.factor_columns ?? [];
  const rightFactors = rightFactorParameters?.factor_columns ?? [];
  const [leftFactor, setLeftFactor] = useState(leftFactors[0] ?? "");
  const [rightFactor, setRightFactor] = useState(rightFactors[0] ?? "");
  const factorRanges = useMemo(() => mergeFactorRanges(leftFactorRanges, rightFactorRanges), [leftFactorRanges, rightFactorRanges]);
  const backtestRanges = useMemo(() => mergeBacktestRanges(leftBacktestRanges, rightBacktestRanges), [leftBacktestRanges, rightBacktestRanges]);

  useEffect(() => {
    if (!leftFactors.includes(leftFactor)) setLeftFactor(leftFactors[0] ?? "");
    if (!rightFactors.includes(rightFactor)) setRightFactor(rightFactors[0] ?? "");
  }, [leftFactor, leftFactors, rightFactor, rightFactors]);

  useEffect(() => {
    setLeftFactorRanges(undefined);
    setRightFactorRanges(undefined);
  }, [left.id, leftFactor, right.id, rightFactor]);

  useEffect(() => {
    setLeftBacktestRanges(undefined);
    setRightBacktestRanges(undefined);
  }, [left.id, right.id]);

  return <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2"><VersionSummary accent="border-l-sky-500" kind={kind} projectTitle={leftProjectTitle} version={left} /><VersionSummary accent="border-l-amber-500" kind={kind} projectTitle={rightProjectTitle} version={right} /></div>
    {kind === "factor"
      ? <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <ResultColumn accent="border-l-sky-500">
          <FactorTabs factor={leftFactor} factors={leftFactors} onChange={setLeftFactor} />
          {left.workflow_instance_id && leftFactor ? <Suspense fallback={<ReportLoading />}><FactorAnalysisReport chartRanges={factorRanges} factor={leftFactor} key={`${left.workflow_instance_id}:${leftFactor}`} parameters={leftFactorParameters!} workflowInstanceId={left.workflow_instance_id} onChartRanges={setLeftFactorRanges} /></Suspense> : <MissingResult />}
        </ResultColumn>
        <ResultColumn accent="border-l-amber-500">
          <FactorTabs factor={rightFactor} factors={rightFactors} onChange={setRightFactor} />
          {right.workflow_instance_id && rightFactor ? <Suspense fallback={<ReportLoading />}><FactorAnalysisReport chartRanges={factorRanges} factor={rightFactor} key={`${right.workflow_instance_id}:${rightFactor}`} parameters={rightFactorParameters!} workflowInstanceId={right.workflow_instance_id} onChartRanges={setRightFactorRanges} /></Suspense> : <MissingResult />}
        </ResultColumn>
      </div>
      : null}
    {kind === "backtest"
      ? <>
      <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList scrollable>{backtestTabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}</TabsList></Tabs>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <ResultColumn accent="border-l-sky-500">{left.workflow_instance_id ? <Suspense fallback={<ReportLoading />}><BacktestReport activeTab={activeTab} annualTradingDays={(left.parameters as BacktestParameters).annual_trading_days} chartRanges={backtestRanges} riskFreeRate={(left.parameters as BacktestParameters).risk_free_rate} showTabs={false} workflowInstanceId={left.workflow_instance_id} onActiveTabChange={setActiveTab} onChartRanges={setLeftBacktestRanges} /></Suspense> : <MissingResult />}</ResultColumn>
        <ResultColumn accent="border-l-amber-500">{right.workflow_instance_id ? <Suspense fallback={<ReportLoading />}><BacktestReport activeTab={activeTab} annualTradingDays={(right.parameters as BacktestParameters).annual_trading_days} chartRanges={backtestRanges} riskFreeRate={(right.parameters as BacktestParameters).risk_free_rate} showTabs={false} workflowInstanceId={right.workflow_instance_id} onActiveTabChange={setActiveTab} onChartRanges={setRightBacktestRanges} /></Suspense> : <MissingResult />}</ResultColumn>
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

function VersionSummary({ accent, kind, projectTitle, version }: { accent: string; kind: "factor" | "backtest"; projectTitle: string; version: CompareVersion }) {
  const fields = kind === "factor" ? factorSummary(version.parameters as FactorAnalysisParameters) : backtestSummary(version.parameters as BacktestParameters);
  return <div className={`min-w-0 space-y-3 rounded-md border border-l-4 bg-card p-3 ${accent}`}>
    <div><div className="truncate text-sm font-medium">{projectTitle}</div><div className="mt-0.5 text-xs text-muted-foreground">v{version.version}{version.saved ? "" : " · 未保存"}</div></div>
    <div className={`h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/20 px-3 py-2 text-sm leading-6 ${version.remark.trim() ? "text-muted-foreground" : "text-muted-foreground/70"}`}>{version.remark.trim() || "无备注"}</div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-muted/25 p-3 text-xs">{fields.map(([label, value]) => <div className="min-w-0" key={label}><div className="text-muted-foreground">{label}</div><div className="mt-0.5 truncate font-medium tabular-nums" title={value}>{value}</div></div>)}</div>
  </div>;
}

function ResultColumn({ accent, children }: { accent: string; children: React.ReactNode }) { return <div className={`min-w-0 rounded-md border border-l-4 bg-card p-3 ${accent}`}>{children}</div>; }
function ReportLoading() { return <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">正在加载报告</div>; }
function MissingResult() { return <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">该版本尚未产生可对比结果</div>; }
function FactorTabs({ factor, factors, onChange }: { factor: string; factors: string[]; onChange: (value: string) => void }) {
  if (!factors.length) return null;
  return <Tabs className="mb-4" value={factor} onValueChange={onChange}><TabsList scrollable>{factors.map((item) => <TabsTrigger key={item} value={item}>{item}</TabsTrigger>)}</TabsList></Tabs>;
}

function normalizeCompareVersion(kind: "factor" | "backtest", version: CompareVersion): CompareVersion {
  return kind === "factor"
    ? { ...version, parameters: normalizeAnalysisParameters(version.parameters) } as FactorVersion
    : version;
}

function factorSummary(parameters: FactorAnalysisParameters): string[][] {
  if (!parameters.dataset_query || !Array.isArray(parameters.factor_columns) || !Array.isArray(parameters.return_columns)) return [["状态", "尚未执行"]];
  const pool = stockPoolLabel(parameters);
  return [["日期范围", `${parameters.dataset_query.start_date} — ${parameters.dataset_query.end_date}`], ["股票池", pool], ["回溯周期", parameters.dataset_query.lookback], ["分组数量", String(parameters.n_groups)], ["极端股票数", String(parameters.n_select)], ["因子", parameters.factor_columns.join(", ") || "—"], ["收益列", parameters.return_columns.join(", ") || "—"]];
}

function backtestSummary(parameters: BacktestParameters): string[][] {
  if (!parameters.dataset_query) return [["状态", "尚未执行"]];
  const benchmark = typeof parameters.config.benchmark === "string"
    ? stockPools.find((option) => option.value === parameters.config.benchmark)?.label ?? parameters.config.benchmark
    : "不使用";
  return [["日期范围", `${parameters.dataset_query.start_date} — ${parameters.dataset_query.end_date}`], ["初始资金", Number(parameters.config.cash ?? 0).toLocaleString("zh-CN")], ["复权方式", parameters.adj ?? "不复权"], ["基准指数", benchmark], ["年化交易日", String(parameters.annual_trading_days)], ["无风险利率", String(parameters.risk_free_rate)], ["回溯周期", parameters.dataset_query.lookback]];
}
