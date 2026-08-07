import type { DslDocument, FactorQuery } from "@/types/factor";

export const callbackNames = ["initialize", "beforeTrading", "onBar", "onSnapshot", "onOrder", "onTrade", "afterTrading", "finalize"] as const;
export type CallbackName = typeof callbackNames[number];
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

export type BacktestParameters = {
  config: Record<string, unknown>;
  codes_query: FactorQuery | null;
  dataset_query: FactorQuery;
  adj: "hfq" | "qfq" | null;
  annual_trading_days: number;
  risk_free_rate: number;
  utils: string;
  callbacks: Record<CallbackName, string>;
};

export type BacktestWorkflowSummary = {
  record_id: number;
  workflow_instance_id: number | null;
  state: string;
  error: string | null;
  parameters: BacktestParameters;
  updated_at: string;
};

export type BacktestProject = {
  id: number;
  title: string;
  latest_version: number | null;
  draft: BacktestWorkflowSummary | null;
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
  items: BacktestProjectListItem[];
  page: number;
  page_size: number;
  total: number;
};

export type BacktestWorkflowSubmitted = { record_id: number; workflow_instance_id: number };

export type BacktestVersion = {
  id: number;
  project_id: number;
  workflow_instance_id: number;
  version: number;
  remark: string;
  parameters: BacktestParameters;
  summary: BacktestSummary;
  created_at: string;
};

export type BacktestVersionListItem = Pick<BacktestVersion, "id" | "version" | "remark" | "created_at">;

export type BacktestOutputName = "trade_details" | "daily_positions" | "daily_portfolios" | "return_summary" | "daily_trading_statistics" | "engine_stat";
export type BacktestOutput = { name: BacktestOutputName; filename: string; size: number; modified_at: string };

export function defaultBacktestCodesQuery(datasetQuery?: Pick<FactorQuery, "start_date" | "end_date">): FactorQuery {
  return {
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
  };
}

export const defaultBacktestParameters = (): BacktestParameters => ({
  config: { cash: 1_000_000, commission: 0.0003, tax: 0.001, matchingMode: 2, enableMinimumPerTransactionFee: true },
  codes_query: null,
  dataset_query: {
    start_date: "2020-01-01",
    end_date: "2026-01-01",
    lookback: "P180D",
    codes: [],
    factors: [],
    derivatives: {
      stock_pool_member: {
        type: "DIRECT",
        op: "binary.gt",
        fields: { left: "weight_000300SH", right: 0 },
        params: {}
      },
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
      }
    },
    filters: []
  },
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
    if (portfolioVolatility <= 0) return double("inf")
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
    if (count == 0 || cols(covariance) != count) throw "协方差矩阵必须是非空方阵"
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
    if (optimization[\`mode] != 0) throw "SLSQP 风险平价优化失败"
    return optimization[\`xopt]
}`,
  callbacks: {
    initialize: `def initialize(mutable context) {
    context["barCount"] = 0l
    context["rebalanceCount"] = 0l
    context["riskParityCapitalRatio"] = 0.98
    context["riskParityLotSize"] = 100l
    context["riskParityMomentumThreshold"] = 0.0
    context["riskParityAssetCount"] = 20l
    context["riskParityCovarianceWindow"] = 60l
}`,
    beforeTrading: `def beforeTrading(mutable context) {
    return NULL
}`,
    onBar: `def onBar(mutable context, message, indicator) {
    context["barCount"] = context["barCount"] + 1l
    if (context["barCount"] % 5l != 1l) return
    source = context["coreBacktestUnfilteredFactorData"]
    currentDate = date(message.tradeTime[0])
    historyTimes = exec distinct time from source where date(time) < currentDate order by time
    if (historyTimes.size() == 0) return
    signalTime = historyTimes[historyTimes.size() - 1]
    signal = select * from source where time == signalTime
    eligible = select code, momentum_120d from signal where stock_pool_member == true, momentum_120d > context["riskParityMomentumThreshold"], not isNull(momentum_120d), not isNull(return_1d)
    selectedCount = min(long(context["riskParityAssetCount"]), eligible.rows())
    rowCount = message.rows()
    weights = take(0.0, rowCount)
    if (selectedCount > 0) {
        selected = eligible[isort(eligible.momentum_120d, false)[0:selectedCount]]
        riskDates = historyTimes.tail(long(context["riskParityCovarianceWindow"]))
        riskHistory = select time, code, return_1d from source where time in riskDates, code in selected.code
        returnMatrix = exec return_1d from riskHistory pivot by time, code
        returnMatrix = nullFill(returnMatrix, 0.0)
        covariance = covarMatrix(returnMatrix)
        riskCodes = string(returnMatrix.colNames())
        riskWeights = solveRiskParity(covariance)
        for (index in 0..(rowCount - 1)) {
            code = strReplace(strReplace(string(message.symbol[index]), ".XSHE", ".SZ"), ".XSHG", ".SH")
            riskIndex = find(riskCodes, code)
            if (riskIndex < riskCodes.size()) weights[index] = riskWeights[riskIndex]
        }
    }
    currentQuantities = take(0l, rowCount)
    for (index in 0..(rowCount - 1)) {
        position = Backtest::getPosition(context.engine, message.symbol[index], "stock")["longPosition"]
        if (count(position) > 0) currentQuantities[index] = long(position[0])
    }
    equity = Backtest::getAvailableCash(context.engine, "stock") + sum(double(currentQuantities) * message.open)
    targetQuantities = take(0l, rowCount)
    for (index in 0..(rowCount - 1)) {
        if (weights[index] > 0 && message.open[index] > 0) targetQuantities[index] = long(floor(equity * context["riskParityCapitalRatio"] * weights[index] / message.open[index] / double(context["riskParityLotSize"]))) * context["riskParityLotSize"]
    }
    for (index in 0..(rowCount - 1)) {
        difference = targetQuantities[index] - currentQuantities[index]
        if (difference < 0) Backtest::submitOrder(context.engine, (message.symbol[index], context.tradeTime, 5, message.open[index], -difference, 3), "riskParitySell")
    }
    for (index in 0..(rowCount - 1)) {
        difference = targetQuantities[index] - currentQuantities[index]
        if (difference > 0) Backtest::submitOrder(context.engine, (message.symbol[index], context.tradeTime, 5, message.open[index], difference, 1), "riskParityBuy")
    }
    context["rebalanceCount"] = context["rebalanceCount"] + 1l
}`,
    onSnapshot: `def onSnapshot(mutable context, message, indicator) {
    return NULL
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
    print("rebalanceCount=" + string(context["rebalanceCount"]))
}`
  }
});

export function backtestCodesDsl(parameters: BacktestParameters): DslDocument {
  const { factors, derivatives, filters } = parameters.codes_query ?? { factors: [], derivatives: {}, filters: [] };
  return { factors, derivatives, filters };
}

export function backtestDatasetDsl(parameters: BacktestParameters): DslDocument {
  const { factors, derivatives, filters } = parameters.dataset_query;
  return { factors, derivatives, filters };
}

export function updateBacktestCodesDsl(parameters: BacktestParameters, dsl: DslDocument): BacktestParameters {
  if (parameters.codes_query === null) return parameters;
  return { ...parameters, codes_query: { ...parameters.codes_query, ...dsl } };
}

export function updateBacktestDatasetDsl(parameters: BacktestParameters, dsl: DslDocument): BacktestParameters {
  return { ...parameters, dataset_query: { ...parameters.dataset_query, ...dsl } };
}
