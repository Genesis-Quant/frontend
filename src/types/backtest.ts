import type { DslCatalog, DslDocument, DslSource, FactorQuery } from "@/types/factor";
import { initialDslSource } from "@/assets/lib/dslSource";

export const callbackNames = ["initialize", "beforeTrading", "onBar", "onSnapshot", "onOrder", "onTrade", "afterTrading", "finalize"] as const;
export type CallbackName = typeof callbackNames[number];
export type StrategyParameterValue = string | number | boolean | null;
export type StrategyParameters = Record<string, StrategyParameterValue>;
export const callbackParameters: Record<CallbackName, string> = {
  initialize: "mutable context",
  beforeTrading: "mutable context",
  onBar: "mutable context, message, indicator",
  onSnapshot: "mutable context, message, indicator",
  onOrder: "mutable context, event",
  onTrade: "mutable context, event",
  afterTrading: "mutable context",
  finalize: "mutable context"
};
export type BacktestSummary = Record<string, number | null>;

export type BacktestCatalog = DslCatalog & {
  benchmark_codes: string[];
};

export type BacktestParameters = {
  config: Record<string, unknown>;
  params: StrategyParameters;
  codes_query: FactorQuery | null;
  dataset_query: FactorQuery;
  adj: "hfq" | "qfq" | null;
  annual_trading_days: number;
  risk_free_rate: number;
  utils: string;
  callbacks: Record<CallbackName, string>;
};

export type BacktestWorkflowSummary = {
  id: number;
  version: number;
  saved: boolean;
  workspace_id: number;
  workflow_instance_id: number | null;
  state: string;
  error: string | null;
  parameters: unknown;
  updated_at: string;
};

export type BacktestProject = {
  id: number;
  title: string;
  latest_version: number | null;
  draft: BacktestWorkflowSummary;
  created_at: string;
  updated_at: string;
};

export type BacktestProjectListItem = {
  id: number;
  title: string;
  latest_version: number | null;
  latest_summary: BacktestSummary | null;
  updated_at: string;
};

export type BacktestProjectPage = {
  all_total: number;
  items: BacktestProjectListItem[];
  page: number;
  page_size: number;
  total: number;
};

export type BacktestWorkflowSubmitted = { workspace_id: number; workflow_instance_id: number };

export type BacktestVersion = {
  id: number;
  project_id: number;
  workflow_workspace_id: number;
  workflow_instance_id: number | null;
  version: number;
  saved: boolean;
  is_current: boolean;
  remark: string;
  parameters: unknown;
  summary: BacktestSummary | null;
  created_at: string;
  updated_at: string;
};

export type BacktestVersionListItem = Pick<BacktestVersion, "id" | "version" | "saved" | "is_current" | "remark" | "workflow_instance_id" | "created_at">;

export type BacktestOutputName = "trade_details" | "daily_positions" | "daily_portfolios" | "daily_trading_statistics";
export type BacktestOutput = { name: BacktestOutputName; filename: string; size: number; modified_at: string };

export const optimizationAlgorithms = [
  "random_search",
  "latin_hypercube",
  "halton",
  "maximin",
  "hill_climb",
  "coordinate_descent",
  "pattern_search",
  "tabu_search",
  "simulated_annealing",
  "threshold_accepting",
  "great_deluge",
  "differential_evolution",
  "particle_swarm",
  "genetic_algorithm",
  "evolution_strategy",
  "cross_entropy",
  "tpe",
  "rbf_surrogate",
  "knn_ucb",
  "adaptive_random"
] as const;
export type OptimizationAlgorithm = typeof optimizationAlgorithms[number];

export type OptimizationSettings = {
  parameter_space: Record<string, number[]>;
  algorithms: OptimizationAlgorithm[];
  start_date: string;
  end_date: string;
  lookback_period: string;
  holding_period: string;
  repetitions: number;
  evaluation_budget: number;
  seed: number;
};

export type BacktestProjectSortField = "id" | "title" | "latest_version" | "totalReturn" | "annualReturn" | "sharpeRatio" | "annualVolatility" | "maxDrawdown" | "dailyWinningRate" | "updated_at";

export type OptimizationParameters = BacktestParameters & OptimizationSettings;

export type BacktestOptimization = {
  id: number;
  project_id: number;
  version: number;
  workflow_workspace_id: number;
  workflow_instance_id: number | null;
  state: string;
  error: string | null;
  parameters: OptimizationParameters;
  created_at: string;
  updated_at: string;
};

export type BacktestOptimizationPage = {
  items: BacktestOptimization[];
  total: number;
  page: number;
  page_size: number;
};

export type OptimizationOutput = {
  name: OptimizationAlgorithm;
  filename: string;
  size: number;
  modified_at: string;
};

export type BatchResearchItemRequest = {
  parameters: BacktestParameters;
};

export type SensitivityCase = {
  params: StrategyParameters;
  commission: number;
};

export type SensitivityParameters = BacktestParameters & {
  analysis_type: "fee_analysis" | "sensitivity";
  cases: SensitivityCase[];
};

export type SensitivityOutput = {
  name: "results";
  filename: string;
  size: number;
  modified_at: string;
};

export type BatchResearchRequest = {
  analysis_type: "fee_analysis" | "sensitivity";
  project_id: number;
  version: number;
  description: string;
  items: BatchResearchItemRequest[];
};

export type BatchResearchListItem = {
  id: number;
  analysis_type: "fee_analysis" | "sensitivity";
  analysis_type_label: string;
  project_id: number;
  version: number;
  description: string;
  workflow_workspace_id: number;
  workflow_instance_id: number | null;
  state: string;
  requested_count: number;
  completed_count: number;
  failed_count: number;
  error: string | null;
  parameters: SensitivityParameters;
  created_at: string;
  updated_at: string;
};

export type BatchResearchResponse = BatchResearchListItem;

export type BatchResearchPage = {
  items: BatchResearchListItem[];
  total: number;
  page: number;
  page_size: number;
};

function defaultBacktestCodesQuery(datasetQuery?: Pick<FactorQuery, "start_date" | "end_date">): FactorQuery {
  return withInitialDslSource({
    start_date: datasetQuery?.start_date ?? "2020-01-01",
    end_date: datasetQuery?.end_date ?? "2026-01-01",
    lookback: "P0D",
    codes: [],
    factors: [],
    derivatives: {
      stock_pool_member: {
        type: "DIRECT",
        op: "binary.gt",
        fields: { left: "weight_000300SH", right: 0 },
        params: {}
      }
    },
    filters: ["stock_pool_member"]
  });
}

export function setBacktestStockPoolType(parameters: BacktestParameters, dynamic: boolean): BacktestParameters {
  return {
    ...parameters,
    codes_query: dynamic
      ? parameters.codes_query ?? defaultBacktestCodesQuery(parameters.dataset_query)
      : null
  };
}

export const defaultBacktestParameters = (): BacktestParameters => ({
  config: { cash: 1_000_000, commission: 0.0003, tax: 0.001, syntheticSpread: 0.001, enableMinimumPerTransactionFee: true },
  params: {
    riskParityCapitalRatio: 0.98,
    riskParityAssetCount: 20,
    riskParityCovarianceWindow: 60,
    riskParityRebalanceBars: 5,
    riskParityMinimumMomentum: 0
  },
  codes_query: defaultBacktestCodesQuery(),
  dataset_query: withInitialDslSource({
    start_date: "2020-01-01",
    end_date: "2026-01-01",
    lookback: "P180D",
    codes: [],
    factors: [],
    derivatives: {
      return_1d: {
        type: "TS",
        op: "unary.pct_change",
        fields: { col: "close_hfq" },
        params: { periods: 1 }
      },
      momentum_120d: {
        type: "TS",
        op: "unary.pct_change",
        fields: { col: "close_hfq" },
        params: { periods: 120 }
      },
      momentum_20d: {
        type: "TS",
        op: "unary.pct_change",
        fields: { col: "close_hfq" },
        params: { periods: 20 }
      },
      volatility_20d: {
        type: "TS",
        op: "unary.rolling_std",
        fields: { col: "return_1d" },
        params: { window: 20, min_periods: 20 }
      },
      momentum_120d_rank: {
        type: "CS",
        op: "unary.rank_pct",
        fields: { col: "momentum_120d" },
        params: { ascending: true, ties_method: "average" }
      },
      momentum_20d_rank: {
        type: "CS",
        op: "unary.rank_pct",
        fields: { col: "momentum_20d" },
        params: { ascending: true, ties_method: "average" }
      },
      low_volatility_rank: {
        type: "CS",
        op: "unary.rank_pct",
        fields: { col: "volatility_20d" },
        params: { ascending: false, ties_method: "average" }
      },
      momentum_score: {
        type: "DIRECT",
        op: "binary.add",
        fields: { left: "momentum_120d_rank", right: "momentum_20d_rank" },
        params: {}
      },
      multi_factor_score: {
        type: "DIRECT",
        op: "binary.add",
        fields: { left: "momentum_score", right: "low_volatility_rank" },
        params: {}
      }
    },
    filters: []
  }),
  adj: "hfq",
  annual_trading_days: 250,
  risk_free_rate: 0.04,
  utils: `def riskParityObjective(weights, covariance) {
    count = size(weights)
    covarianceTimesWeights = take(0.0, count)
    for (index in 0..(count - 1)) {
        covarianceTimesWeights[index] = sum(flatten(covariance[index,]) * weights)
    }
    portfolioVolatility = sqrt(sum(weights * covarianceTimesWeights))
    if (portfolioVolatility <= 0) {
        return double("inf")
    }
    riskContributions = weights * covarianceTimesWeights / portfolioVolatility
    targetContribution = portfolioVolatility / count
    return sum(square(riskContributions - targetContribution))
}

def weightSumConstraint(weights) {
    return sum(weights) - 1.0
}

def weightSumJacobian(weights) {
    return take(1.0, size(weights))
}

def nonnegativeWeightConstraint(weights) {
    return weights
}

def nonnegativeWeightJacobian(weights) {
    return diag(take(1.0, size(weights)))
}

def solveRiskParity(covariance, tolerance=0.000000000001, maxIterations=1000l) {
    count = rows(covariance)
    if (count == 0 || cols(covariance) != count) {
        throw "协方差矩阵必须是非空方阵"
    }
    equalityConstraint = dict(STRING, ANY)
    equalityConstraint[\`type] = \`eq
    equalityConstraint[\`fun] = weightSumConstraint
    equalityConstraint[\`jac] = weightSumJacobian
    nonnegativeConstraint = dict(STRING, ANY)
    nonnegativeConstraint[\`type] = \`ineq
    nonnegativeConstraint[\`fun] = nonnegativeWeightConstraint
    nonnegativeConstraint[\`jac] = nonnegativeWeightJacobian
    bounds = matrix(take(0.0, count), take(1.0, count))
    optimization = fminSLSQP(riskParityObjective{, covariance}, take(1.0 / count, count), constraints=[equalityConstraint, nonnegativeConstraint], bounds=bounds, ftol=tolerance, maxIter=maxIterations)
    if (optimization[\`mode] != 0) {
        throw "SLSQP 风险平价优化失败"
    }
    return optimization[\`xopt]
}`,
  callbacks: {
    initialize: `def initialize(mutable context) {
    strategyParams = getParams()
    context["barCount"] = 0l
    context["riskParityCapitalRatio"] = double(strategyParams["riskParityCapitalRatio"])
    context["riskParityAssetCount"] = long(strategyParams["riskParityAssetCount"])
    context["riskParityCovarianceWindow"] = long(strategyParams["riskParityCovarianceWindow"])
    context["riskParityRebalanceBars"] = long(strategyParams["riskParityRebalanceBars"])
    context["riskParityMinimumMomentum"] = double(strategyParams["riskParityMinimumMomentum"])
}`,
    beforeTrading: `def beforeTrading(mutable context) {
    return NULL
}`,
    onBar: `def onBar(mutable context, message, indicator) {
    return NULL
}`,
    onSnapshot: `def onSnapshot(mutable context, message, indicator) {
    /*
    message（策略中也可命名为 msg）是当前时间点的合成快照表；同一次回调中
    每行对应一只证券。日频行情会在 09:30 和 15:00 各生成一次快照。

    标量列：
    - symbol SYMBOL：证券代码，例如 600000.XSHG、000001.XSHE
    - symbolSource SYMBOL：交易所，XSHG 或 XSHE
    - timestamp TIMESTAMP：本次快照时间
    - lastPrice DOUBLE：09:30 使用当日开盘价，15:00 使用当日收盘价
    - upLimitPrice/downLimitPrice DOUBLE：当日涨跌停价
    - totalBidQty/totalOfferQty LONG：十亿股/份，表示不会触发整数溢出的近似无限流动性
    - prevClosePrice DOUBLE：前收盘价

    一档盘口 Array Vector 列：
    - bidPrice[0]/offerPrice[0]：买一价/卖一价
    - bidQty[0]/offerQty[0]：十亿股/份，表示不会触发整数溢出的近似无限流动性
    */
    if (time(message.timestamp[0]) != 09:30:00.000) {
        return
    }
    context["barCount"] = context["barCount"] + 1l
    if ((context["barCount"] - 1l) % context["riskParityRebalanceBars"] != 0l) {
        return
    }
    history = backtest::getHistoryData(context, message, false)
    historyTimes = exec distinct time from history order by time
    if (historyTimes.size() == 0) {
        return
    }
    signalTime = historyTimes[historyTimes.size() - 1]
    signal = select * from history where time == signalTime
    eligible = select code, multi_factor_score from signal where stock_pool_member == true, momentum_120d > context["riskParityMinimumMomentum"], volatility_20d > 0, not isNull(multi_factor_score), not isNull(return_1d)
    selectedCount = min(long(context["riskParityAssetCount"]), eligible.rows())
    rowCount = message.rows()
    weights = take(0.0, rowCount)
    if (selectedCount > 0) {
        selected = eligible[isort(eligible.multi_factor_score, false)[0:selectedCount]]
        riskDates = historyTimes.tail(long(context["riskParityCovarianceWindow"]))
        riskHistory = select time, code, return_1d from history where time in riskDates, code in selected.code
        returnMatrix = exec return_1d from riskHistory pivot by time, code
        returnMatrix = nullFill(returnMatrix, 0.0)
        covariance = covarMatrix(returnMatrix)
        riskCodes = symbol(returnMatrix.colNames())
        riskWeights = solveRiskParity(covariance)
        for (index in 0..(rowCount - 1)) {
            riskIndex = find(riskCodes, message.symbol[index])
            if (riskIndex >= 0 && riskIndex < riskCodes.size()) {
                weights[index] = riskWeights[riskIndex]
            }
        }
    }
    currentQuantities = take(0l, rowCount)
    for (index in 0..(rowCount - 1)) {
        position = Backtest::getPosition(context.engine, message.symbol[index], "stock")["longPosition"]
        if (count(position) > 0) {
            currentQuantities[index] = long(position.sum())
        }
    }
    equity = Backtest::getAvailableCash(context.engine, "stock") + sum(double(currentQuantities) * message.lastPrice)
    targetQuantities = take(0l, rowCount)
    for (index in 0..(rowCount - 1)) {
        if (weights[index] > 0 && message.lastPrice[index] > 0) {
            targetQuantities[index] = long(floor(equity * context["riskParityCapitalRatio"] * weights[index] / message.lastPrice[index] / 100.0)) * 100l
        }
    }
    for (index in 0..(rowCount - 1)) {
        difference = targetQuantities[index] - currentQuantities[index]
        if (difference < 0) {
            backtest::order_target(context, message, message.symbol[index], targetQuantities[index], "riskParitySell")
        }
    }
    for (index in 0..(rowCount - 1)) {
        difference = targetQuantities[index] - currentQuantities[index]
        if (difference > 0) {
            backtest::order_target(context, message, message.symbol[index], targetQuantities[index], "riskParityBuy")
        }
    }
}`,
    onOrder: `def onOrder(mutable context, event) {
    return NULL
}`,
    onTrade: `def onTrade(mutable context, event) {
    return NULL
}`,
    afterTrading: `def afterTrading(mutable context) {
    return NULL
}`,
    finalize: `def finalize(mutable context) {
    return NULL
}`
  }
});

function withInitialDslSource(query: Omit<FactorQuery, "dsl_source">): FactorQuery {
  const document: DslDocument = {
    factors: query.factors,
    derivatives: query.derivatives,
    filters: query.filters
  };
  return { ...query, dsl_source: initialDslSource(document) };
}

export function backtestCodesDsl(parameters: BacktestParameters): DslDocument {
  const { factors, derivatives, filters } = parameters.codes_query ?? { factors: [], derivatives: {}, filters: [] };
  return { factors, derivatives, filters };
}

export function backtestDatasetDsl(parameters: BacktestParameters): DslDocument {
  const { factors, derivatives, filters } = parameters.dataset_query;
  return { factors, derivatives, filters };
}

export function updateBacktestCodesDsl(parameters: BacktestParameters, dsl: DslDocument, source: DslSource): BacktestParameters {
  if (parameters.codes_query === null) return parameters;
  return { ...parameters, codes_query: { ...parameters.codes_query, ...dsl, dsl_source: source } };
}

export function updateBacktestDatasetDsl(parameters: BacktestParameters, dsl: DslDocument, source: DslSource): BacktestParameters {
  return { ...parameters, dataset_query: { ...parameters.dataset_query, ...dsl, dsl_source: source } };
}
