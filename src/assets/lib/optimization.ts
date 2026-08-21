import { BrowserDuckDb, duckDbDateValue } from "@/assets/lib/duckdb";
import type { OptimizationAlgorithm } from "@/types/backtest";

export const optimizationAlgorithmLabels: Record<OptimizationAlgorithm, string> = {
  random_search: "随机搜索",
  latin_hypercube: "拉丁超立方",
  halton: "Halton 序列",
  maximin: "最大最小距离",
  hill_climb: "爬山搜索",
  coordinate_descent: "坐标下降",
  pattern_search: "模式搜索",
  tabu_search: "禁忌搜索",
  simulated_annealing: "模拟退火",
  threshold_accepting: "阈值接受",
  great_deluge: "大洪水算法",
  differential_evolution: "差分进化",
  particle_swarm: "粒子群",
  genetic_algorithm: "遗传算法",
  evolution_strategy: "进化策略",
  cross_entropy: "交叉熵方法",
  tpe: "TPE",
  rbf_surrogate: "RBF 代理模型",
  knn_ucb: "KNN-UCB",
  adaptive_random: "自适应随机搜索"
};

export type OptimizationRunMetric = {
  algorithm: OptimizationAlgorithm;
  repetition: number;
  totalReturn: number | null;
  annualReturn: number | null;
  sharpe: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  observations: number;
};

export type OptimizationMethodMetric = {
  algorithm: OptimizationAlgorithm;
  meanReturn: number | null;
  meanAnnualReturn: number | null;
  meanSharpe: number | null;
  sharpeDeviation: number | null;
  meanVolatility: number | null;
  meanMaxDrawdown: number | null;
  positiveRate: number | null;
  repetitions: number;
};

export type OptimizationPathPoint = {
  algorithm: OptimizationAlgorithm;
  time: string;
  repetition: number;
  netValue: number;
};

export type OptimizationMeanPathPoint = {
  algorithm: OptimizationAlgorithm;
  time: string;
  mean: number;
  lower: number;
  upper: number;
};

export type OptimizationWindowSelection = {
  algorithm: OptimizationAlgorithm;
  repetition: number;
  window: number;
  trainingStart: string;
  trainingEnd: string;
  holdingStart: string;
  holdingEnd: string;
  trainingSharpe: number | null;
  evaluationCount: number;
  initialParams: Record<string, number>;
  selectedParams: Record<string, number>;
};

export type OptimizationReportData = {
  methods: OptimizationMethodMetric[];
  runs: OptimizationRunMetric[];
  meanPaths: OptimizationMeanPathPoint[];
  paths: OptimizationPathPoint[];
  selections: OptimizationWindowSelection[];
};

export class OptimizationAnalytics {
  private constructor(
    private readonly database: BrowserDuckDb,
    private readonly files: string[]
  ) {}

  static async create(reportId: number, outputs: Partial<Record<OptimizationAlgorithm, ArrayBuffer>>) {
    const files = Object.fromEntries(
      Object.entries(outputs).map(([algorithm, buffer]) => [
        `optimization-${reportId}-${algorithm}.parquet`,
        buffer
      ])
    );
    if (!Object.keys(files).length) throw new Error("参数调优工作流没有可读取的 Parquet 输出");
    return new OptimizationAnalytics(await BrowserDuckDb.create(files), Object.keys(files));
  }

  async report(annualTradingDays: number, riskFreeRate: number): Promise<OptimizationReportData> {
    const source = this.sourceSql();
    const runRows = await this.database.rows(`
      WITH paths AS (${source}), drawdowns AS (
        SELECT *, greatest(1.0, max(path_net_value) OVER (
          PARTITION BY algorithm, repetition ORDER BY time
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )) AS running_peak
        FROM paths
      ), aggregated AS (
        SELECT algorithm, repetition,
          arg_max(path_net_value, time) AS final_net_value,
          stddev_pop(daily_return) FILTER (WHERE daily_return IS NOT NULL) AS daily_volatility,
          min(path_net_value / running_peak - 1.0) AS max_drawdown,
          count(*) AS observations,
          count(daily_return) AS return_observations
        FROM drawdowns GROUP BY algorithm, repetition
      )
      SELECT algorithm, repetition,
        final_net_value - 1.0 AS total_return,
        pow(final_net_value, ${annualTradingDays}.0 / observations) - 1.0 AS annual_return,
        CASE WHEN return_observations > 1 AND daily_volatility > 0 THEN
          (pow(final_net_value, ${annualTradingDays}.0 / observations) - 1.0 - ${riskFreeRate}) /
          (daily_volatility * sqrt(${annualTradingDays}.0))
        END AS sharpe,
        CASE WHEN return_observations > 1 THEN daily_volatility * sqrt(${annualTradingDays}.0) END AS volatility,
        max_drawdown, observations
      FROM aggregated ORDER BY algorithm, repetition
    `);
    const meanPathRows = await this.database.rows(`
      WITH paths AS (${source})
      SELECT algorithm, time, avg(path_net_value) AS mean,
        quantile_cont(path_net_value, 0.1) AS lower,
        quantile_cont(path_net_value, 0.9) AS upper
      FROM paths GROUP BY algorithm, time ORDER BY algorithm, time
    `);
    const pathRows = await this.database.rows(`
      WITH paths AS (${source})
      SELECT algorithm, time, repetition, path_net_value
      FROM paths ORDER BY algorithm, repetition, time
    `);
    const selectionRows = await this.database.rows(`
      WITH paths AS (${source})
      SELECT DISTINCT algorithm, repetition, "window", training_start, training_end,
        holding_start, holding_end, training_sharpe, evaluation_count,
        initial_params, selected_params
      FROM paths ORDER BY algorithm, repetition, "window"
    `);
    const runs = runRows.map(runMetric);
    return {
      methods: methodMetrics(runs),
      runs,
      meanPaths: meanPathRows.map((row) => ({
        algorithm: String(row.algorithm) as OptimizationAlgorithm,
        time: duckDbDateValue(row.time),
        mean: numberValue(row.mean) ?? 1,
        lower: numberValue(row.lower) ?? 1,
        upper: numberValue(row.upper) ?? 1
      })),
      paths: pathRows.map((row) => ({
        algorithm: String(row.algorithm) as OptimizationAlgorithm,
        time: duckDbDateValue(row.time),
        repetition: integerValue(row.repetition),
        netValue: numberValue(row.path_net_value) ?? 1
      })),
      selections: selectionRows.map(selection)
    };
  }

  close() {
    return this.database.close();
  }

  private sourceSql() {
    return this.files.map((file) => `
      SELECT CAST(algorithm AS VARCHAR) AS algorithm,
        CAST(time AS DATE) AS time,
        CAST(repetition AS INTEGER) AS repetition,
        CAST("window" AS INTEGER) AS "window",
        CAST(training_start AS DATE) AS training_start,
        CAST(training_end AS DATE) AS training_end,
        CAST(holding_start AS DATE) AS holding_start,
        CAST(holding_end AS DATE) AS holding_end,
        CAST(training_sharpe AS DOUBLE) AS training_sharpe,
        CAST(evaluation_count AS INTEGER) AS evaluation_count,
        CAST(initial_params AS VARCHAR) AS initial_params,
        CAST(selected_params AS VARCHAR) AS selected_params,
        CAST(path_net_value AS DOUBLE) AS path_net_value,
        CAST(daily_return AS DOUBLE) AS daily_return
      FROM read_parquet(${literal(file)})
    `).join(" UNION ALL ");
  }
}

function runMetric(row: Record<string, unknown>): OptimizationRunMetric {
  return {
    algorithm: String(row.algorithm) as OptimizationAlgorithm,
    repetition: integerValue(row.repetition),
    totalReturn: numberValue(row.total_return),
    annualReturn: numberValue(row.annual_return),
    sharpe: numberValue(row.sharpe),
    volatility: numberValue(row.volatility),
    maxDrawdown: numberValue(row.max_drawdown),
    observations: integerValue(row.observations)
  };
}

function methodMetrics(runs: OptimizationRunMetric[]): OptimizationMethodMetric[] {
  const algorithms = [...new Set(runs.map((run) => run.algorithm))];
  return algorithms.map((algorithm) => {
    const methodRuns = runs.filter((run) => run.algorithm === algorithm);
    const sharpes = finiteValues(methodRuns.map((run) => run.sharpe));
    return {
      algorithm,
      meanReturn: mean(finiteValues(methodRuns.map((run) => run.totalReturn))),
      meanAnnualReturn: mean(finiteValues(methodRuns.map((run) => run.annualReturn))),
      meanSharpe: mean(sharpes),
      sharpeDeviation: deviation(sharpes),
      meanVolatility: mean(finiteValues(methodRuns.map((run) => run.volatility))),
      meanMaxDrawdown: mean(finiteValues(methodRuns.map((run) => run.maxDrawdown))),
      positiveRate: methodRuns.length ? methodRuns.filter((run) => (run.totalReturn ?? 0) > 0).length / methodRuns.length : null,
      repetitions: methodRuns.length
    };
  }).sort((left, right) => (right.meanSharpe ?? Number.NEGATIVE_INFINITY) - (left.meanSharpe ?? Number.NEGATIVE_INFINITY));
}

function selection(row: Record<string, unknown>): OptimizationWindowSelection {
  return {
    algorithm: String(row.algorithm) as OptimizationAlgorithm,
    repetition: integerValue(row.repetition),
    window: integerValue(row.window),
    trainingStart: duckDbDateValue(row.training_start),
    trainingEnd: duckDbDateValue(row.training_end),
    holdingStart: duckDbDateValue(row.holding_start),
    holdingEnd: duckDbDateValue(row.holding_end),
    trainingSharpe: numberValue(row.training_sharpe),
    evaluationCount: integerValue(row.evaluation_count),
    initialParams: jsonParameters(row.initial_params),
    selectedParams: jsonParameters(row.selected_params)
  };
}

function jsonParameters(value: unknown): Record<string, number> {
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([name, item]) => {
      const number = Number(item);
      return Number.isFinite(number) ? [[name, number]] : [];
    }));
  } catch {
    return {};
  }
}

function finiteValues(values: Array<number | null>) { return values.filter((value): value is number => value !== null && Number.isFinite(value)); }
function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function deviation(values: number[]) { const average = mean(values); return average === null || values.length < 2 ? null : Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)); }
function numberValue(value: unknown) { const number = Number(value); return value === null || value === undefined || !Number.isFinite(number) ? null : number; }
function integerValue(value: unknown) { return Math.trunc(numberValue(value) ?? 0); }
function literal(value: string) { return `'${value.replace(/'/g, "''")}'`; }
