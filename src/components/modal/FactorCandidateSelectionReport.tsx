import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Loader2, MinusCircle, ShieldAlert, XCircle } from "lucide-react";

import { factorApi } from "@/assets/lib/factor";
import { FactorAnalytics, type GroupStatistic, type InformationPoint, type LongShortPoint } from "@/assets/lib/factorAnalysis";
import { formatDateTime } from "@/assets/lib/dateTime";
import { errorMessage } from "@/assets/lib/utils";
import { normalizeAnalysisParameters, type FactorReturnSpec, type FactorVersion, type FactorVersionListItem } from "@/types/factor";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, LargeDialogContent } from "@/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";

type Recommendation = "keep" | "watch" | "reject";

type CandidateTarget = {
  factorName: string;
  groupStatistics: GroupStatistic[];
  information: InformationPoint[];
  label: string;
  longShort: LongShortPoint[];
  returnSpec: FactorReturnSpec;
  version: FactorVersion;
};

type CandidateEvidence = {
  candidate: CandidateTarget;
  dominanceCount: number;
  icIr: number | null;
  icMean: number | null;
  longShortAnnual: number | null;
  longShortCumulative: number | null;
  longShortMean: number | null;
  maxAbsCorrelation: number | null;
  maxDrawdown: number | null;
  monotonicity: number | null;
  rankIcIr: number | null;
  rankIcMean: number | null;
  recommendation: Recommendation;
  score: number;
};

type CandidateStats = {
  icIr: number | null;
  icMean: number | null;
  icSeries: Map<string, number>;
  longShortAnnual: number | null;
  longShortCumulative: number | null;
  longShortMean: number | null;
  longShortSeries: Map<string, number>;
  maxDrawdown: number | null;
  monotonicity: number | null;
  rankIcIr: number | null;
  rankIcMean: number | null;
  rankIcSeries: Map<string, number>;
};

type CorrelationMatrix = {
  labels: string[];
  values: Array<Array<number | null>>;
};

type CandidateReportResult = {
  evidences: CandidateEvidence[];
  longShortCorrelation: CorrelationMatrix;
  rankIcCorrelation: CorrelationMatrix;
};

type FactorCandidateSelectionReportProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: number;
  projectTitle: string;
  versions: FactorVersionListItem[];
};

export function FactorCandidateSelectionReport({ onOpenChange, open, projectId, projectTitle, versions }: FactorCandidateSelectionReportProps) {
  const sortedVersions = useMemo(() => [...versions].sort((left, right) => left.version - right.version), [versions]);
  const defaultSelected = useMemo(() => sortedVersions.slice(-Math.min(4, sortedVersions.length)).map((item) => String(item.version)), [sortedVersions]);
  const [manualSelected, setManualSelected] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState<CandidateReportResult | null>(null);
  const selected = manualSelected ?? defaultSelected;

  useEffect(() => {
    if (!open) return;
    setManualSelected(null);
    setError("");
  }, [open, versions]);

  function toggleVersion(version: string) {
    setManualSelected((current) => {
      const source = current ?? defaultSelected;
      return source.includes(version) ? source.filter((item) => item !== version) : [...source, version];
    });
  }

  function closeSelection(nextOpen: boolean) {
    if (!nextOpen) {
      setManualSelected(null);
      setError("");
    }
    onOpenChange(nextOpen);
  }

  async function generateReport() {
    if (selected.length < 2) {
      setError("至少选择两个版本才能生成优选报告");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const candidates: CandidateTarget[] = [];
      for (const version of selected) candidates.push(await loadCandidate(projectId, Number(version)));
      setResult(buildCandidateReport(candidates));
      closeSelection(false);
      setResultOpen(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  return <>
    <Dialog open={open} onOpenChange={closeSelection}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>因子候选优选报告</DialogTitle>
          <DialogDescription>选择同一项目内的历史版本，比较 IC、Rank IC、分组单调性、多空表现、回撤和候选冗余。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid max-h-[52vh] grid-cols-1 gap-2 overflow-y-auto pr-1">
            {sortedVersions.length
              ? sortedVersions.map((version) => {
              const value = String(version.version);
              const checked = selected.includes(value);
              return <button key={value} type="button" className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border bg-card p-3 text-left transition hover:bg-muted/35 data-[selected=true]:border-primary/60 data-[selected=true]:bg-primary/5" data-selected={checked} onClick={() => toggleVersion(value)}>
                <Checkbox checked={checked} onCheckedChange={() => toggleVersion(value)} onClick={(event) => event.stopPropagation()} />
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">v{version.version}</span>
                    <Badge variant="secondary">历史版本</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(version.created_at)}</span>
                  </div>
                  {version.remark ? <div className="line-clamp-2 text-xs leading-5 text-muted-foreground">{version.remark}</div> : null}
                </div>
              </button>;
              })
              : <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">暂无可选择版本</div>}
          </div>
          <div className="text-xs text-muted-foreground">已选择 {selected.length} 个版本。优选报告只比较同一项目内的历史结果。</div>
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => closeSelection(false)} disabled={loading}>取消</Button>
          <Button onClick={generateReport} disabled={loading || selected.length < 2}>{loading ? <Loader2 className="animate-spin" /> : <BarChart3 />}生成报告</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={resultOpen} onOpenChange={setResultOpen}>
      <LargeDialogContent className="flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{projectTitle} · 因子优选报告</DialogTitle>
          <DialogDescription>依据多目标证据给出 Keep / Watch / Reject，相关矩阵使用各版本的实际时序结果。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{result ? <CandidateReportPanel result={result} /> : <div className="py-10 text-center text-sm text-muted-foreground">请选择版本生成报告</div>}</div>
      </LargeDialogContent>
    </Dialog>
  </>;
}

function CandidateReportPanel({ result }: { result: CandidateReportResult }) {
  const keep = result.evidences.filter((item) => item.recommendation === "keep");
  const watch = result.evidences.filter((item) => item.recommendation === "watch");
  const reject = result.evidences.filter((item) => item.recommendation === "reject");
  const best = result.evidences[0];
  const bestLabel = best?.recommendation === "keep" ? "建议优先保留" : best?.recommendation === "watch" ? "相对优先观察" : "暂无保留候选";
  return <div className="space-y-5 pb-2">
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
      <div className="rounded-md border bg-card p-4"><div className="text-xs text-muted-foreground">{bestLabel}</div><div className="mt-1 truncate text-xl font-semibold">{best ? labelCandidate(best) : "—"}</div><div className="mt-3 text-sm leading-6 text-muted-foreground">{best ? explainBest(best) : "候选证据不足，无法给出优先保留建议。"}</div></div>
      <RecommendationStat icon={CheckCircle2} label="Keep" tone="text-emerald-500" value={keep.length} />
      <RecommendationStat icon={MinusCircle} label="Watch" tone="text-amber-500" value={watch.length} />
      <RecommendationStat icon={XCircle} label="Reject" tone="text-destructive" value={reject.length} />
    </div>
    <div className="rounded-md border bg-card">
      <div className="border-b px-4 py-3"><div className="font-medium">候选证据向量</div><div className="mt-1 text-xs text-muted-foreground">预测性、稳定性、收益风险、冗余和支配关系一起判断，不按单一指标排序。</div></div>
      <Table><TableHeader><TableRow><TableHead>建议</TableHead><TableHead>候选</TableHead><TableHead className="text-right">Rank IC</TableHead><TableHead className="text-right">Rank ICIR</TableHead><TableHead className="text-right">ICIR</TableHead><TableHead className="text-right">单调性</TableHead><TableHead className="text-right">多空年化收益</TableHead><TableHead className="text-right">多空回撤</TableHead><TableHead className="text-right">最大相关</TableHead><TableHead className="text-right">支配数</TableHead></TableRow></TableHeader><TableBody>{result.evidences.map((item) => <TableRow key={item.candidate.label}><TableCell><RecommendationBadge value={item.recommendation} /></TableCell><TableCell><div className="max-w-56 truncate font-medium" title={labelCandidate(item)}>{labelCandidate(item)}</div><div className="text-xs text-muted-foreground">{item.candidate.version.remark || "无备注"}</div></TableCell><MetricCell value={item.rankIcMean} /><MetricCell value={item.rankIcIr} /><MetricCell value={item.icIr} /><MetricCell value={item.monotonicity} /><MetricCell kind="percent" value={item.longShortAnnual} /><MetricCell kind="percent" value={item.maxDrawdown} /><MetricCell value={item.maxAbsCorrelation} /><TableCell className="text-right tabular-nums">{item.dominanceCount}</TableCell></TableRow>)}</TableBody></Table>
    </div>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><CorrelationMatrixCard description="衡量候选排序预测能力是否同涨同跌，作为暴露冗余的代理。" matrix={result.rankIcCorrelation} title="Rank IC 时序相关矩阵" /><CorrelationMatrixCard description="衡量多空收益路径是否重复；高度相关时优先保留回撤更小、Rank IC 更稳的候选。" matrix={result.longShortCorrelation} title="多空收益相关矩阵" /></div>
    <div className="rounded-md border bg-muted/20 p-4"><div className="flex items-center gap-2 font-medium"><ShieldAlert className="size-4 text-amber-500" />冗余与选择偏差提示</div><div className="mt-2 text-sm leading-6 text-muted-foreground">相关矩阵基于各版本输出的 Rank IC 和多空收益时序计算；候选数量越多，单一最高收益越容易带有选择偏差，因此报告不会只按单一指标排序。</div></div>
  </div>;
}

function RecommendationStat({ icon: Icon, label, tone, value }: { icon: typeof CheckCircle2; label: string; tone: string; value: number }) {
  return <div className="rounded-md border bg-card p-4"><div className={`flex items-center gap-2 text-sm ${tone}`}><Icon className="size-4" />{label}</div><div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div></div>;
}

function RecommendationBadge({ value }: { value: Recommendation }) {
  if (value === "keep") return <Badge className="bg-emerald-500 text-black hover:bg-emerald-500">Keep</Badge>;
  if (value === "reject") return <Badge variant="destructive">Reject</Badge>;
  return <Badge className="bg-amber-500 text-black hover:bg-amber-500">Watch</Badge>;
}

function MetricCell({ kind = "decimal", value }: { kind?: "decimal" | "percent"; value: number | null }) {
  const content = formatNumber(value, kind === "percent");
  return <TableCell className="text-right tabular-nums">{content}</TableCell>;
}

function CorrelationMatrixCard({ description, matrix, title }: { description: string; matrix: CorrelationMatrix; title: string }) {
  return <div className="rounded-md border bg-card"><div className="border-b px-4 py-3"><div className="font-medium">{title}</div><div className="mt-1 text-xs text-muted-foreground">{description}</div></div><div className="overflow-x-auto p-3"><table className="w-full min-w-[520px] border-separate border-spacing-1 text-xs"><thead><tr><th className="px-2 py-1 text-left text-muted-foreground">候选</th>{matrix.labels.map((label) => <th key={label} className="max-w-28 truncate px-2 py-1 text-right text-muted-foreground" title={label}>{label}</th>)}</tr></thead><tbody>{matrix.labels.map((label, rowIndex) => <tr key={label}><th className="max-w-32 truncate px-2 py-1 text-left font-medium" title={label}>{label}</th>{matrix.values[rowIndex].map((value, columnIndex) => <td key={`${label}-${matrix.labels[columnIndex]}`} className="rounded-sm px-2 py-1 text-right tabular-nums" style={correlationCellStyle(value)}>{value === null ? "—" : formatNumber(value)}</td>)}</tr>)}</tbody></table></div></div>;
}

async function loadCandidate(projectId: number, versionNumber: number): Promise<CandidateTarget> {
  const version = await factorApi.getVersion(projectId, versionNumber);
  const parameters = normalizeAnalysisParameters(version.parameters);
  const factorName = parameters.factor_columns.at(-1);
  const returnColumn = parameters.return_columns[0];
  if (!factorName || !returnColumn) throw new Error(`v${version.version} 缺少因子或收益列，无法生成优选报告`);
  if (version.workflow_instance_id === null) throw new Error(`v${version.version} 尚未产生分析结果`);
  const [informationBuffer, groupBuffer] = await Promise.all([factorApi.output(version.workflow_instance_id, "information_coefficient"), factorApi.output(version.workflow_instance_id, "group_returns")]);
  const analytics = await FactorAnalytics.create(
    version.workflow_instance_id,
    { information: informationBuffer, groups: groupBuffer },
    parameters
  );
  try {
    const [information, longShort, groupStatistics] = await Promise.all([analytics.informationSeries(factorName, returnColumn), analytics.longShortSeries(factorName, returnColumn, parameters.n_groups), analytics.groupStatistics(factorName, returnColumn, parameters.n_groups)]);
    return { factorName, groupStatistics, information, label: `v${version.version}`, longShort, returnSpec: parameters.return_specs[returnColumn], version };
  } finally {
    await analytics.close();
  }
}

function buildCandidateReport(candidates: CandidateTarget[]): CandidateReportResult {
  const stats = new Map(candidates.map((candidate) => [candidate.label, candidateStats(candidate)]));
  const rankIcCorrelation = buildCorrelationMatrix(candidates, (candidate) => stats.get(candidate.label)?.rankIcSeries ?? new Map());
  const longShortCorrelation = buildCorrelationMatrix(candidates, (candidate) => stats.get(candidate.label)?.longShortSeries ?? new Map());
  const maxAbs = maxAbsCorrelationByLabel(rankIcCorrelation);
  const raw = candidates.map((candidate) => {
    const current = stats.get(candidate.label) ?? emptyCandidateStats();
    return { candidate, dominanceCount: 0, icIr: current.icIr, icMean: current.icMean, longShortAnnual: current.longShortAnnual, longShortCumulative: current.longShortCumulative, longShortMean: current.longShortMean, maxAbsCorrelation: maxAbs.get(candidate.label) ?? null, maxDrawdown: current.maxDrawdown, monotonicity: current.monotonicity, rankIcIr: current.rankIcIr, rankIcMean: current.rankIcMean, recommendation: "watch" as Recommendation, score: 0 };
  });
  const dominance = dominanceCounts(raw);
  const evidences = raw.map((item) => { const dominanceCount = dominance.get(item.candidate.label) ?? 0; return { ...item, dominanceCount, recommendation: classifyCandidate(item, dominanceCount), score: scoreCandidate(item, dominanceCount) }; }).sort((left, right) => recommendationRank(left.recommendation) - recommendationRank(right.recommendation) || right.score - left.score);
  return { evidences, longShortCorrelation, rankIcCorrelation };
}

function candidateStats(candidate: CandidateTarget): CandidateStats {
  const icValues = candidate.information.flatMap((row) => row.ic === null ? [] : [row.ic]);
  const rankIcValues = candidate.information.flatMap((row) => row.rankIc === null ? [] : [row.rankIc]);
  const longShortValues = candidate.longShort.flatMap((row) => row.value === null ? [] : [row.value]);
  const cumulative = candidate.longShort.at(-1)?.cumulative ?? null;
  const observations = longShortValues.length;
  const icIr = informationRatio(icValues);
  const rankIcIr = informationRatio(rankIcValues);
  return {
    icIr,
    icMean: mean(icValues),
    icSeries: seriesMap(candidate.information, "ic"),
    longShortAnnual: candidate.returnSpec.periods === 1 ? annualizedReturn(cumulative, observations, 252) : null,
    longShortCumulative: cumulative,
    longShortMean: mean(longShortValues),
    longShortSeries: new Map(candidate.longShort.flatMap((row) => row.value === null ? [] : [[row.time, row.value] as [string, number]])),
    maxDrawdown: maxDrawdown(candidate.longShort),
    monotonicity: monotonicity(candidate.groupStatistics),
    rankIcIr,
    rankIcMean: mean(rankIcValues),
    rankIcSeries: seriesMap(candidate.information, "rankIc")
  };
}

function emptyCandidateStats(): CandidateStats {
  return { icIr: null, icMean: null, icSeries: new Map(), longShortAnnual: null, longShortCumulative: null, longShortMean: null, longShortSeries: new Map(), maxDrawdown: null, monotonicity: null, rankIcIr: null, rankIcMean: null, rankIcSeries: new Map() };
}

function seriesMap(rows: InformationPoint[], key: "ic" | "rankIc") {
  return new Map(rows.flatMap((row) => { const value = row[key]; return value === null ? [] : [[row.time, value] as [string, number]]; }));
}

function monotonicity(groups: GroupStatistic[]) {
  const values = groups.filter((group) => group.group.startsWith("Group ")).map((group) => ({ index: Number(group.group.replace(/[^0-9]/g, "")), mean: group.mean })).filter((item): item is { index: number; mean: number } => Number.isFinite(item.index) && item.mean !== null).sort((left, right) => left.index - right.index);
  return values.length < 3 ? null : spearman(values.map((item) => [item.index, item.mean]));
}

function buildCorrelationMatrix(candidates: CandidateTarget[], extractor: (candidate: CandidateTarget) => Map<string, number>): CorrelationMatrix {
  const labels = candidates.map((candidate) => candidate.label);
  const series = candidates.map(extractor);
  return { labels, values: candidates.map((_, rowIndex) => candidates.map((__, columnIndex) => rowIndex === columnIndex ? 1 : alignedCorrelation(series[rowIndex], series[columnIndex]))) };
}

function maxAbsCorrelationByLabel(matrix: CorrelationMatrix) {
  return new Map(matrix.labels.map((label, rowIndex) => [label, matrix.values[rowIndex].flatMap((value, columnIndex) => rowIndex === columnIndex || value === null ? [] : [Math.abs(value)]).reduce<number | null>((maximum, value) => maximum === null ? value : Math.max(maximum, value), null)]));
}

function dominanceCounts(items: CandidateEvidence[]) {
  const counts = new Map(items.map((item) => [item.candidate.label, 0]));
  for (const left of items) for (const right of items) if (left !== right && dominates(left, right)) counts.set(left.candidate.label, (counts.get(left.candidate.label) ?? 0) + 1);
  return counts;
}

function dominates(left: CandidateEvidence, right: CandidateEvidence) {
  const leftDrawdown = absOrInfinity(left.maxDrawdown);
  const rightDrawdown = absOrInfinity(right.maxDrawdown);
  const checks = [greaterOrEqual(left.rankIcMean, right.rankIcMean), greaterOrEqual(left.rankIcIr, right.rankIcIr), greaterOrEqual(left.longShortAnnual ?? left.longShortCumulative, right.longShortAnnual ?? right.longShortCumulative), leftDrawdown <= rightDrawdown];
  return checks.every(Boolean) && (greater(left.rankIcMean, right.rankIcMean) || greater(left.rankIcIr, right.rankIcIr) || greater(left.longShortAnnual ?? left.longShortCumulative, right.longShortAnnual ?? right.longShortCumulative) || leftDrawdown < rightDrawdown);
}

function classifyCandidate(item: CandidateEvidence, dominanceCount: number): Recommendation {
  const predictive = positive(item.rankIcMean) && positive(item.rankIcIr);
  const profitable = positive(item.longShortAnnual ?? item.longShortCumulative ?? item.longShortMean);
  const monotonic = item.monotonicity === null || item.monotonicity > 0.15;
  const drawdownAcceptable = item.maxDrawdown === null || Math.abs(item.maxDrawdown) <= 0.35;
  const redundant = item.maxAbsCorrelation !== null && Math.abs(item.maxAbsCorrelation) >= 0.9;
  if (predictive && profitable && monotonic && drawdownAcceptable && !redundant) return "keep";
  if (!predictive && !profitable && dominanceCount === 0) return "reject";
  return "watch";
}

function scoreCandidate(item: CandidateEvidence, dominanceCount: number) {
  const rankIc = item.rankIcMean ?? 0;
  const rankIr = item.rankIcIr ?? 0;
  const annual = item.longShortAnnual ?? item.longShortCumulative ?? 0;
  const mono = item.monotonicity ?? 0;
  const drawdown = Math.abs(item.maxDrawdown ?? 0);
  const redundancy = Math.abs(item.maxAbsCorrelation ?? 0);
  return rankIc * 120 + rankIr * 8 + annual * 4 + mono * 1.4 + dominanceCount * 0.8 - drawdown * 1.5 - Math.max(0, redundancy - 0.85) * 3;
}

function alignedCorrelation(left: Map<string, number>, right: Map<string, number>) {
  const pairs: Array<[number, number]> = [];
  left.forEach((value, key) => { const other = right.get(key); if (other !== undefined) pairs.push([value, other]); });
  return pairs.length < 3 ? null : pearson(pairs);
}

function pearson(pairs: Array<[number, number]>) {
  const leftMean = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length;
  const rightMean = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length;
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (const [left, right] of pairs) { const leftDelta = left - leftMean; const rightDelta = right - rightMean; covariance += leftDelta * rightDelta; leftVariance += leftDelta ** 2; rightVariance += rightDelta ** 2; }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator > 0 ? covariance / denominator : null;
}

function spearman(pairs: Array<[number, number]>) {
  return pearson(pairs.map((pair, index) => [pair[0], rankValues(pairs.map((item) => item[1]))[index]]));
}

function rankValues(values: number[]) {
  return values.map((value, index) => ({ index, value })).sort((left, right) => left.value - right.value).reduce<number[]>((ranks, item, rank) => { ranks[item.index] = rank + 1; return ranks; }, []);
}

function maxDrawdown(rows: LongShortPoint[]) {
  let peak = 1;
  let drawdown = 0;
  let seen = false;
  for (const row of rows) {
    if (row.cumulative === null) continue;
    seen = true;
    const nav = 1 + row.cumulative;
    peak = Math.max(peak, nav);
    drawdown = Math.max(drawdown, peak > 0 ? 1 - nav / peak : 0);
  }
  return seen ? drawdown : null;
}

function annualizedReturn(cumulative: number | null, observations: number, annualization: number) {
  return cumulative === null || observations <= 0 || cumulative <= -1 ? null : Math.pow(1 + cumulative, annualization / observations) - 1;
}

function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function informationRatio(values: number[]) { const average = mean(values); const deviation = sampleStd(values); return average !== null && deviation !== null && deviation > 0 ? average / deviation : null; }
function sampleStd(values: number[]) { if (values.length < 2) return null; const average = mean(values) ?? 0; return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)); }
function positive(value: number | null) { return value !== null && value > 0; }
function greaterOrEqual(left: number | null, right: number | null) { return left !== null && right !== null && left >= right; }
function greater(left: number | null, right: number | null) { return left !== null && right !== null && left > right; }
function absOrInfinity(value: number | null) { return value === null ? Number.POSITIVE_INFINITY : Math.abs(value); }
function recommendationRank(value: Recommendation) { return value === "keep" ? 0 : value === "watch" ? 1 : 2; }
function labelCandidate(item: CandidateEvidence) { return `${item.candidate.label} · ${item.candidate.factorName}`; }
function explainBest(item: CandidateEvidence) { return item.recommendation === "keep" ? "预测性、收益路径和冗余约束相对均衡，可作为优先保留候选。" : item.recommendation === "watch" ? "证据存在冲突，建议继续观察方向、衰减或参数稳健性。" : "核心证据偏弱，仅因相对排序靠前，不建议直接保留。"; }
function formatNumber(value: number | null, percent = false) { return value === null || !Number.isFinite(value) ? "—" : `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(percent ? value * 100 : value)}${percent ? "%" : ""}`; }
function correlationCellStyle(value: number | null) { if (value === null) return { backgroundColor: "hsl(var(--muted) / 0.28)" }; const opacity = Math.min(0.9, 0.16 + Math.abs(value) * 0.55); const color = value >= 0 ? `rgba(16, 185, 129, ${opacity})` : `rgba(239, 68, 68, ${opacity})`; return { backgroundColor: color, color: Math.abs(value) > 0.72 ? "white" : undefined }; }

export default FactorCandidateSelectionReport;
