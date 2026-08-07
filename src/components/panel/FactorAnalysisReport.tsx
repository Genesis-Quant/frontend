import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import IconDatabase from "~icons/lucide/database";
import IconLoaderCircle from "~icons/lucide/loader-circle";

import { factorApi } from "@/assets/lib/factor";
import { chartRange, formatAxisLabel, thresholdMarkLine } from "@/assets/lib/chart";
import { errorMessage } from "@/assets/lib/utils";
import {
  FactorAnalytics,
  type DecayPoint,
  type GroupPoint,
  type GroupStatistic,
  type InformationPoint,
  type LongShortPoint
} from "@/assets/lib/factorAnalysis";
import DateRangeBar from "@/components/bar/DateRangeBar";
import EChart from "@/components/chart/EChart";
import { useAppStore } from "@/store";
import type { AxisFormat, ChartRange, FactorChartRanges } from "@/types/chart";
import type { FactorAnalysisParameters, FactorMetrics } from "@/types/factor";
import { Button } from "@/ui/button";

type DualChartRanges = { primary?: ChartRange; secondary?: ChartRange };

type FactorAnalysisReportProps = {
  chartRanges?: FactorChartRanges;
  factor: string;
  parameters: FactorAnalysisParameters;
  workflowInstanceId: number;
  onChartRanges?: (ranges: FactorChartRanges) => void;
  onMetrics: (metrics: FactorMetrics) => void;
};

type IcType = "RankIC" | "IC";
export default function FactorAnalysisReport({ chartRanges, factor, onChartRanges, onMetrics, parameters, workflowInstanceId }: FactorAnalysisReportProps) {
  const theme = useAppStore((state) => state.theme);
  const analytics = useRef<FactorAnalytics | null>(null);
  const factorColumnsKey = parameters.factor_columns.join("\u0001");
  const returnColumnsKey = parameters.return_columns.join("\u0001");
  const firstReturnColumn = parameters.return_columns[0] ?? "";
  const [metrics, setMetrics] = useState<FactorMetrics | null>(null);
  const [icReturnColumn, setIcReturnColumn] = useState(firstReturnColumn);
  const [returnColumn, setReturnColumn] = useState(firstReturnColumn);
  const [groupReturnColumn, setGroupReturnColumn] = useState(firstReturnColumn);
  const [icType, setIcType] = useState<IcType>("RankIC");
  const [information, setInformation] = useState<InformationPoint[]>([]);
  const [longShort, setLongShort] = useState<LongShortPoint[]>([]);
  const [groups, setGroups] = useState<GroupPoint[]>([]);
  const [groupStatistics, setGroupStatistics] = useState<GroupStatistic[]>([]);
  const [decay, setDecay] = useState<DecayPoint[]>([]);
  const [timeline, setTimeline] = useState<InformationPoint[]>([]);
  const [rangeFactor, setRangeFactor] = useState("");
  const [minimumDate, setMinimumDate] = useState("");
  const [maximumDate, setMaximumDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [informationLoading, setInformationLoading] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [decayLoading, setDecayLoading] = useState(false);
  const [error, setError] = useState("");
  const rangePoints = useMemo(() => timeline.map((row) => ({ time: row.time, value: row.rankIc ?? row.ic })), [timeline]);

  useEffect(() => {
    if (!parameters.return_columns.includes(icReturnColumn)) setIcReturnColumn(firstReturnColumn);
    if (!parameters.return_columns.includes(returnColumn)) setReturnColumn(firstReturnColumn);
    if (!parameters.return_columns.includes(groupReturnColumn)) setGroupReturnColumn(firstReturnColumn);
  }, [firstReturnColumn, groupReturnColumn, icReturnColumn, parameters.return_columns, returnColumn]);

  useEffect(() => {
    let cancelled = false;
    let session: FactorAnalytics | null = null;
    setLoading(true);
    setError("");
    setMetrics(null);
    async function loadResults() {
      try {
        const [informationBuffer, groupBuffer] = await Promise.all([
          factorApi.output(workflowInstanceId, "information_coefficient"),
          factorApi.output(workflowInstanceId, "group_returns")
        ]);
        session = await FactorAnalytics.create(workflowInstanceId, { information: informationBuffer, groups: groupBuffer });
        if (cancelled) {
          await session.close();
          return;
        }
        analytics.current = session;
        const calculated = await session.metrics(parameters);
        if (cancelled) return;
        setMetrics(calculated);
        onMetrics(calculated);
      } catch (reason) {
        if (!cancelled) setError(errorMessage(reason));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadResults();
    return () => {
      cancelled = true;
      if (analytics.current === session) analytics.current = null;
      session?.close().catch(() => undefined);
    };
  }, [factorColumnsKey, onMetrics, parameters.n_groups, returnColumnsKey, workflowInstanceId]);

  useEffect(() => {
    const session = analytics.current;
    if (!session || !metrics || !factor || !firstReturnColumn) return undefined;
    let cancelled = false;
    setRangeFactor("");
    Promise.all([session.dateRange(factor, firstReturnColumn), session.informationSeries(factor, firstReturnColumn)])
      .then(([range, rows]) => {
        if (cancelled) return;
        setTimeline(rows.filter((row) => row.time >= range.start && row.time <= range.end));
        setMinimumDate(range.start);
        setMaximumDate(range.end);
        setStartDate(range.start);
        setEndDate(range.end);
        setRangeFactor(factor);
      })
      .catch((reason) => { if (!cancelled) setError(errorMessage(reason)); });
    return () => { cancelled = true; };
  }, [factor, firstReturnColumn, metrics]);

  useEffect(() => {
    const session = analytics.current;
    if (!session || !metrics || !factor || !icReturnColumn || rangeFactor !== factor) return undefined;
    let cancelled = false;
    setInformationLoading(true);
    session.informationSeries(factor, icReturnColumn, { start: startDate, end: endDate })
      .then((rows) => { if (!cancelled) setInformation(rows); })
      .catch((reason) => { if (!cancelled) setError(errorMessage(reason)); })
      .finally(() => { if (!cancelled) setInformationLoading(false); });
    return () => { cancelled = true; };
  }, [endDate, factor, icReturnColumn, metrics, rangeFactor, startDate]);

  useEffect(() => {
    const session = analytics.current;
    if (!session || !metrics || !factor || !returnColumn || rangeFactor !== factor) return undefined;
    let cancelled = false;
    setReturnLoading(true);
    session.longShortSeries(factor, returnColumn, parameters.n_groups, { start: startDate, end: endDate })
      .then((rows) => { if (!cancelled) setLongShort(rows); })
      .catch((reason) => { if (!cancelled) setError(errorMessage(reason)); })
      .finally(() => { if (!cancelled) setReturnLoading(false); });
    return () => { cancelled = true; };
  }, [endDate, factor, metrics, parameters.n_groups, rangeFactor, returnColumn, startDate]);

  useEffect(() => {
    const session = analytics.current;
    if (!session || !metrics || !factor || !groupReturnColumn || rangeFactor !== factor) return undefined;
    let cancelled = false;
    setGroupLoading(true);
    Promise.all([
      session.groupSeries(factor, groupReturnColumn, parameters.n_groups, { start: startDate, end: endDate }),
      session.groupStatistics(factor, groupReturnColumn, parameters.n_groups, { start: startDate, end: endDate })
    ])
      .then(([series, statistics]) => {
        if (cancelled) return;
        setGroups(series);
        setGroupStatistics(statistics);
      })
      .catch((reason) => { if (!cancelled) setError(errorMessage(reason)); })
      .finally(() => { if (!cancelled) setGroupLoading(false); });
    return () => { cancelled = true; };
  }, [endDate, factor, groupReturnColumn, metrics, parameters.n_groups, rangeFactor, startDate]);

  useEffect(() => {
    const session = analytics.current;
    if (!session || !metrics || !factor || rangeFactor !== factor) return undefined;
    let cancelled = false;
    setDecayLoading(true);
    session.decay(factor, parameters.return_columns, { start: startDate, end: endDate })
      .then((rows) => { if (!cancelled) setDecay(rows); })
      .catch((reason) => { if (!cancelled) setError(errorMessage(reason)); })
      .finally(() => { if (!cancelled) setDecayLoading(false); });
    return () => { cancelled = true; };
  }, [endDate, factor, metrics, rangeFactor, returnColumnsKey, startDate]);

  useEffect(() => {
    if (!onChartRanges) return;
    onChartRanges({
      information: {
        primary: chartRange(information.map((row) => icType === "RankIC" ? row.rankIc : row.ic)),
        secondary: chartRange(information.map((row) => icType === "RankIC" ? row.rankIcCumulative : row.icCumulative))
      },
      longShort: { primary: chartRange(longShort.map((row) => row.value), true), secondary: chartRange(longShort.map((row) => row.cumulative)) },
      groupStatistics: chartRange(groupStatistics.map((row) => row.mean), true),
      groups: chartRange(groups.flatMap((row) => Object.values(row.values))),
      decay: chartRange(decay.flatMap((row) => [row.icMean, row.rankIcMean]), true)
    });
  }, [decay, groupStatistics, groups, icType, information, longShort, onChartRanges]);

  if (loading) return <ResultState icon={<IconLoaderCircle className="animate-spin" width={20} height={20} />} title="DuckDB 正在读取 Parquet" detail="正在浏览器内加载 IC 与分组收益结果。" />;
  if (error && !metrics) return <ResultState icon={<IconDatabase width={20} height={20} />} title="结果读取失败" detail={error} />;
  if (!metrics || !factor) return null;

  return <section className="space-y-4">
    <DateRangeBar
      endDate={endDate}
      maximumDate={maximumDate}
      minimumDate={minimumDate}
      startDate={startDate}
      theme={theme}
      points={rangePoints}
      onEndDate={(value) => setEndDate(value < startDate ? startDate : value)}
      onReset={() => { setStartDate(minimumDate); setEndDate(maximumDate); }}
      onStartDate={(value) => setStartDate(value > endDate ? endDate : value)}
    />

    <ReportCard title="IC 分析">
      <CardToolbar end={<Segmented value={icType} options={["RankIC", "IC"]} onChange={(value) => setIcType(value as IcType)} />}>
        <ReturnSelector value={icReturnColumn} options={parameters.return_columns} onChange={setIcReturnColumn} />
      </CardToolbar>
      <MetricGrid items={informationMetrics(information, icType)} />
      <ChartPanel title={`${icType} 时序与累计`}>
        <SeriesContent loading={informationLoading} count={information.length} height={330}>{information.length >= 8 && <EChart option={informationOption(information, theme, icType, chartRanges?.information)} height={330} />}</SeriesContent>
      </ChartPanel>
    </ReportCard>

    <ReportCard title="收益分析">
      <CardToolbar><ReturnSelector value={returnColumn} options={parameters.return_columns} onChange={setReturnColumn} /></CardToolbar>
      <MetricGrid items={returnMetrics(longShort)} />
      <ChartPanel title="多空收益与累计收益">
        <SeriesContent loading={returnLoading} count={longShort.length} height={350}>{longShort.length >= 8 && <EChart option={longShortOption(longShort, theme, chartRanges?.longShort)} height={350} />}</SeriesContent>
      </ChartPanel>
    </ReportCard>

    <ReportCard title="分组分析">
      <CardToolbar><ReturnSelector value={groupReturnColumn} options={parameters.return_columns} onChange={setGroupReturnColumn} /></CardToolbar>
      <SummaryTiles items={groupStatistics.map((item) => [item.group, `${format(item.mean, "percent")} / p=${format(item.pValue)}`])} />
      <ChartPanel title="分组平均收益与显著性 p 值">
        <SeriesContent loading={groupLoading} count={groupStatistics.length} height={330}>{groupStatistics.length > 0 && <EChart option={groupStatisticsOption(groupStatistics, theme, chartRanges?.groupStatistics)} height={330} />}</SeriesContent>
      </ChartPanel>
      <ChartPanel title="各分组净值曲线">
        <SeriesContent loading={groupLoading} count={groups.length} height={350}>{groups.length >= 8 && <EChart option={groupOption(groups, theme, chartRanges?.groups)} height={350} />}</SeriesContent>
      </ChartPanel>
    </ReportCard>

    <ReportCard title="衰减分析">
      <SummaryTiles items={decaySummary(decay)} />
      <ChartPanel title="IC 均值衰减">
        <SeriesContent loading={decayLoading} count={decay.length} height={330}>{decay.length > 0 && <EChart option={decayOption(decay, theme, chartRanges?.decay)} height={330} />}</SeriesContent>
      </ChartPanel>
    </ReportCard>

    {error && <div className="rounded-md border border-destructive/30 bg-destructive/8 px-4 py-3 text-xs text-destructive">{error}</div>}
  </section>;
}

function informationMetrics(rows: InformationPoint[], type: IcType) {
  const rank = type === "RankIC";
  const values = rows.map((row) => rank ? row.rankIc : row.ic).filter((value): value is number => value !== null);
  const average = mean(values);
  const deviation = sampleStd(values);
  return [
    [`${type} 均值`, format(average)],
    [`${type} 标准差`, format(deviation)],
    [`${type} IR`, format(average !== null && deviation ? average / deviation : null)],
    [`${type} > 0 占比`, format(ratio(values, (value) => value > 0), "percent")],
    [`${type} > 0.03 占比`, format(ratio(values, (value) => value > 0.03), "percent")]
  ];
}

function returnMetrics(rows: LongShortPoint[]) {
  const values = rows.map((row) => row.value).filter((value): value is number => value !== null);
  const cumulative = rows.at(-1)?.cumulative ?? null;
  const annualReturn = cumulative === null || !values.length || 1 + cumulative <= 0 ? null : (1 + cumulative) ** (252 / values.length) - 1;
  const annualVolatility = populationStd(values) * Math.sqrt(252);
  return [
    ["多空累计收益", format(cumulative, "percent")],
    ["多空年化收益", format(annualReturn, "percent")],
    ["多空夏普", format(annualReturn !== null && annualVolatility ? annualReturn / annualVolatility : null)],
    ["多空最大回撤", format(maxDrawdown(rows), "percent")],
    ["多空年化波动", format(annualVolatility || null, "percent")],
    ["多空收益均值", format(mean(values), "percent")],
    ["多空收益标准差", format(sampleStd(values), "percent")]
  ];
}

function decaySummary(rows: DecayPoint[]): string[][] {
  const rankPeak = peak(rows, "rankIcMean");
  const icPeak = peak(rows, "icMean");
  return [
    ["RankIC 峰值收益列", rankPeak?.label ?? "—"],
    ["RankIC 峰值大小", format(rankPeak?.rankIcMean)],
    ["RankIC 半衰期", halfLife(rows, "rankIcMean", rankPeak)],
    ["IC 峰值收益列", icPeak?.label ?? "—"],
    ["IC 峰值大小", format(icPeak?.icMean)],
    ["IC 半衰期", halfLife(rows, "icMean", icPeak)]
  ];
}

function MetricGrid({ items }: { items: string[][] }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{items.map(([label, value]) => <div className="rounded-md border bg-card px-4 py-3 shadow-sm" key={label}><div className="text-xs text-muted-foreground">{label}</div><div className="numeric mt-2 text-lg font-semibold tracking-tight">{value}</div></div>)}</div>;
}

function SummaryTiles({ items }: { items: string[][] }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{items.map(([label, value]) => <div className="rounded-md border bg-card px-4 py-3 shadow-sm" key={label}><div className="text-xs text-muted-foreground">{label}</div><div className="numeric mt-2 truncate text-sm font-semibold">{value}</div></div>)}</div>;
}

function ReportCard({ children, title }: { children: React.ReactNode; title: string }) {
  return <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.18, ease: "easeOut" }}><div className="rounded-md border bg-card py-5 shadow-sm"><h3 className="px-5 pb-2 text-base font-semibold">{title}</h3><div className="space-y-4 px-5">{children}</div></div></motion.div>;
}

function ChartPanel({ children, title }: { children: React.ReactNode; title: string }) {
  return <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.16, ease: "easeOut" }}><div className="rounded-md border bg-card py-4 shadow-sm"><h4 className="px-4 pb-2 text-sm font-medium">{title}</h4><div className="px-4">{children}</div></div></motion.div>;
}

function CardToolbar({ children, end }: { children: React.ReactNode; end?: React.ReactNode }) {
  return <div className="flex w-full flex-wrap items-center justify-between gap-2"><div className="min-w-0">{children}</div>{end && <div className="ml-auto shrink-0">{end}</div>}</div>;
}

function ReturnSelector({ onChange, options, value }: { onChange: (value: string) => void; options: string[]; value: string }) {
  return <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-md border bg-muted/60 p-1">{options.map((option) => <Button aria-pressed={option === value} className={option === value ? "font-mono shadow-sm" : "font-mono text-muted-foreground"} key={option} size="sm" type="button" variant={option === value ? "default" : "ghost"} onClick={() => onChange(option)}>{option}</Button>)}</div>;
}

function Segmented({ onChange, options, value }: { onChange: (value: string) => void; options: string[]; value: string }) {
  return <div className="flex w-fit gap-1 rounded-md border bg-muted/60 p-1">{options.map((option) => <Button aria-pressed={option === value} className={option === value ? "shadow-sm" : "text-muted-foreground"} key={option} size="sm" type="button" variant={option === value ? "default" : "ghost"} onClick={() => onChange(option)}>{option}</Button>)}</div>;
}

function SeriesContent({ children, count, height, loading }: { children: React.ReactNode; count: number; height: number; loading: boolean }) {
  if (loading && !children) return <div className="grid place-items-center" style={{ height }}><IconLoaderCircle className="animate-spin text-primary" width={20} height={20} /></div>;
  if (!children) return <SparseState count={count} height={height} />;
  return children;
}

function SparseState({ count, height }: { count: number; height: number }) {
  return <div className="grid place-items-center rounded-md border border-dashed border-border text-center text-xs text-muted-foreground" style={{ height }}><div><div className="numeric text-2xl text-foreground">{count}</div><div className="mt-2">没有足够的数据绘制该图表</div></div></div>;
}

function ResultState({ detail, icon, title }: { detail: string; icon: React.ReactNode; title: string }) {
  return <div className="grid min-h-72 place-items-center rounded-md border bg-card p-8 text-center shadow-sm"><div><span className="mx-auto grid size-11 place-items-center rounded-full border bg-muted text-primary">{icon}</span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{detail}</p></div></div>;
}

function informationOption(rows: InformationPoint[], theme: string, type: IcType, ranges?: DualChartRanges) {
  const values = rows.map((row) => type === "RankIC" ? row.rankIc : row.ic);
  const cumulative = rows.map((row) => type === "RankIC" ? row.rankIcCumulative : row.icCumulative);
  const option: Record<string, unknown> = baseOption(theme, rows.map((row) => row.time), [
    { name: type, type: "line", data: values, showSymbol: false, lineStyle: { width: 1.2, opacity: 0.55 }, color: type === "RankIC" ? "#059669" : "#2563eb" },
    { name: `${type} 累计`, type: "line", yAxisIndex: 1, data: cumulative, showSymbol: false, lineStyle: { width: 2.2 }, color: "#d97706" }
  ], ranges?.primary);
  option.yAxis = [axis(theme, true, ranges?.primary), axis(theme, false, ranges?.secondary)];
  return option;
}

function longShortOption(rows: LongShortPoint[], theme: string, ranges?: DualChartRanges) {
  const option: Record<string, unknown> = baseOption(theme, rows.map((row) => row.time), [
    { name: "多空收益", type: "bar", data: rows.map((row) => row.value), itemStyle: { color: "#2563eb", opacity: 0.55 } },
    { name: "累计收益", type: "line", yAxisIndex: 1, data: rows.map((row) => row.cumulative), showSymbol: false, lineStyle: { width: 2.2 }, color: "#d97706" }
  ], ranges?.primary);
  option.yAxis = [axis(theme, true, ranges?.primary, "percent"), axis(theme, false, ranges?.secondary, "percent")];
  return option;
}

function groupStatisticsOption(rows: GroupStatistic[], theme: string, range?: ChartRange) {
  const option: Record<string, unknown> = baseOption(theme, rows.map((row) => row.group), [
    { name: "平均收益", type: "bar", data: rows.map((row) => row.mean), itemStyle: { color: "#2563eb", opacity: 0.72 }, barMaxWidth: 34 },
    { name: "p 值", type: "line", yAxisIndex: 1, data: rows.map((row) => row.pValue), symbolSize: 7, lineStyle: { width: 1.8 }, color: "#d97706", markLine: thresholdMarkLine(theme, "p = 0.05", 0.05) }
  ], range);
  option.xAxis = { ...(option.xAxis as Record<string, unknown>), boundaryGap: true };
  option.yAxis = [axis(theme, true, range, "percent"), { ...axis(theme, false), min: 0, max: 1 }];
  return option;
}

function groupOption(rows: GroupPoint[], theme: string, range?: ChartRange) {
  const names = Object.keys(rows[0]?.values ?? {});
  const colors = ["#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e3a8a"];
  return baseOption(theme, rows.map((row) => row.time), names.map((name, index) => ({
    name,
    type: "line",
    data: rows.map((row) => row.values[name]),
    showSymbol: false,
    lineStyle: { width: index === 0 || index === names.length - 1 ? 2.2 : 1, opacity: index === 0 || index === names.length - 1 ? 1 : 0.5 },
    color: colors[index % colors.length]
  })), range);
}

function decayOption(rows: DecayPoint[], theme: string, range?: ChartRange) {
  const option: Record<string, unknown> = baseOption(theme, rows.map((row) => row.label), [
    { name: "IC 均值", type: "bar", data: rows.map((row) => row.icMean), itemStyle: { color: "#2563eb", opacity: 0.78 }, barMaxWidth: 24 },
    { name: "RankIC 均值", type: "bar", data: rows.map((row) => row.rankIcMean), itemStyle: { color: "#059669", opacity: 0.78 }, barMaxWidth: 24 }
  ], range);
  option.xAxis = { ...(option.xAxis as Record<string, unknown>), boundaryGap: true };
  return option;
}

function baseOption(theme: string, x: string[], series: unknown[], range?: ChartRange) {
  const color = theme === "dark" ? "#8996a5" : "#687771";
  const line = theme === "dark" ? "rgba(160,184,210,.10)" : "rgba(24,66,54,.10)";
  return {
    animationDuration: 450,
    grid: { left: 50, right: 34, top: 42, bottom: 38, containLabel: true },
    legend: { top: 0, left: 0, textStyle: { color, fontSize: 10 } },
    tooltip: { trigger: "axis", backgroundColor: theme === "dark" ? "#151b24" : "#fff", borderColor: line, textStyle: { color: theme === "dark" ? "#eef4f7" : "#13201d", fontSize: 11 } },
    xAxis: { type: "category", data: x, boundaryGap: false, axisLine: { lineStyle: { color: line } }, axisLabel: { color, fontSize: 9, hideOverlap: true }, axisTick: { show: false } },
    yAxis: axis(theme, true, range),
    series
  };
}

function axis(theme: string, splitLine = true, range?: ChartRange, format: AxisFormat = "decimal") {
  const color = theme === "dark" ? "#8996a5" : "#687771";
  const line = theme === "dark" ? "rgba(160,184,210,.10)" : "rgba(24,66,54,.10)";
  return { type: "value", scale: true, min: range?.min, max: range?.max, axisLabel: { color, fontSize: 9, formatter: (value: number) => formatAxisLabel(value, format) }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: splitLine, lineStyle: { color: line } } };
}

function peak(rows: DecayPoint[], field: "icMean" | "rankIcMean") {
  return rows.reduce<DecayPoint | null>((current, row) => {
    const value = row[field];
    if (value === null) return current;
    return !current || Math.abs(value) > Math.abs(current[field] ?? 0) ? row : current;
  }, null);
}

function halfLife(rows: DecayPoint[], field: "icMean" | "rankIcMean", peakRow: DecayPoint | null) {
  if (!peakRow || Math.abs(peakRow[field] ?? 0) <= 0) return "—";
  const threshold = Math.abs(peakRow[field] ?? 0) / 2;
  const found = rows.find((row) => row.position > peakRow.position && Math.abs(row[field] ?? Number.POSITIVE_INFINITY) <= threshold);
  return found?.label ?? "未触及";
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sampleStd(values: number[]) {
  if (values.length < 2) return null;
  const average = mean(values) ?? 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

function populationStd(values: number[]) {
  if (!values.length) return 0;
  const average = mean(values) ?? 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

function maxDrawdown(rows: LongShortPoint[]) {
  let peakValue = 1;
  let maximum = 0;
  for (const row of rows) {
    const value = 1 + (row.cumulative ?? 0);
    peakValue = Math.max(peakValue, value);
    maximum = Math.max(maximum, peakValue > 0 ? 1 - value / peakValue : 0);
  }
  return rows.length ? maximum : null;
}

function ratio(values: number[], predicate: (value: number) => boolean) {
  return values.length ? values.filter(predicate).length / values.length : null;
}

function format(value: number | null | undefined, type: "number" | "percent" = "number") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return type === "percent" ? `${(value * 100).toFixed(2)}%` : value.toFixed(4);
}
