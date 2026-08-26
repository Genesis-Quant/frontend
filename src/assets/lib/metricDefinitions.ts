export type BacktestMetricKey =
  | "totalReturn"
  | "annualReturn"
  | "sharpe"
  | "sortino"
  | "annualVolatility"
  | "maxDrawdown"
  | "calmar"
  | "payoffRatio"
  | "averageDailyReturn"
  | "maxConsecutiveLosses"
  | "profitFactor"
  | "recoveryFactor"
  | "expectedAnnualReturn"
  | "longestDrawdown"
  | "skew"
  | "kurtosis"
  | "dailyVaR"
  | "dailyCVaR"
  | "dailyWinRate"
  | "gainToPainRatio"
  | "averageDrawdown"
  | "averageDrawdownDays"
  | "rollingSharpe"
  | "sharpeDeviation"
  | "positivePathRate"
  | "cumulativeFee"
  | "averageTradingDayFee"
  | "maxDailyFee"
  | "feeToCapital";

export type FactorMetricKey =
  | "icMean"
  | "rankIcMean"
  | "icStd"
  | "rankIcStd"
  | "icIr"
  | "rankIcIr"
  | "icPositiveRatio"
  | "icThresholdRatio"
  | "cumulativeReturn"
  | "annualReturn"
  | "sharpe"
  | "maxDrawdown"
  | "annualVolatility"
  | "periodMean"
  | "periodStd"
  | "groupMean"
  | "pValue"
  | "decayPeak"
  | "halfLife"
  | "monotonicity"
  | "correlation"
  | "dominance";

function annualBasis(annualTradingDays?: number) {
  return annualTradingDays ? `${annualTradingDays} 个交易日` : "当前回测参数 annual_trading_days";
}

export function backtestMetricDescription(key: BacktestMetricKey, annualTradingDays?: number) {
  const basis = annualBasis(annualTradingDays);
  const descriptions: Record<BacktestMetricKey, string> = {
    totalReturn: "将所选报告区间内各交易日收益率依次复合得到；选择中途日期作为起点时，包含起始日相对前一交易日的收益。它是区间累计量，不需要也不应再次年化。",
    annualReturn: `由完整日频净值区间的复合收益按 ${basis} 折算为年化收益。`,
    sharpe: `已年化。用按 ${basis} 折算的年化收益减去年化无风险利率，再除以年化波动率。`,
    sortino: `已年化。用日超额收益与下行波动计算，并乘以 √${annualTradingDays ?? "annual_trading_days"}。`,
    annualVolatility: `已年化。日收益率总体标准差乘以 √${annualTradingDays ?? "annual_trading_days"}。`,
    maxDrawdown: "净值相对历史高点的最大跌幅，是路径指标，不进行年化。",
    calmar: "年化收益除以最大回撤绝对值；分子已经年化，结果无需再次年化。",
    payoffRatio: "非零日收益中，平均正收益与平均负收益绝对值之比，不进行年化。",
    averageDailyReturn: "日收益率的算术平均值。它保留日频口径；若需要年化应明确复利或单利假设，报告中的年化收益是更稳妥的年度口径。",
    maxConsecutiveLosses: "按日收益序列统计的最长连续亏损交易日数，不进行年化。",
    profitFactor: "全部正日收益之和除以负日收益绝对值之和，不进行年化。",
    recoveryFactor: "区间日收益率算术和的绝对值除以最大回撤绝对值，保持 QuantStats 的恢复因子口径，不进行年化。",
    expectedAnnualReturn: "先计算各自然年度（含区间两端可能存在的不完整年度）的复合收益，再取有效年度收益的几何平均；保持 QuantStats 的年度分组口径。",
    longestDrawdown: "从回撤开始到恢复历史高点的最长自然日数，不进行年化。",
    skew: "日收益分布的偏度，是无量纲分布形状指标，不进行年化。",
    kurtosis: "日收益分布的超额峰度，是无量纲分布形状指标，不进行年化。",
    dailyVaR: "基于日收益均值、样本标准差和正态分位数计算的一日 95% 参数 VaR。跨期限换算依赖分布与独立性假设，因此不自动年化。",
    dailyCVaR: "低于日度参数 VaR 阈值的实际日收益均值（一日预期短缺）。跨期限换算依赖模型假设，因此不自动年化。",
    dailyWinRate: "剔除零收益日后，正收益交易日所占比例，不进行年化。",
    gainToPainRatio: "日收益总和除以负日收益绝对值之和，不进行年化。",
    averageDrawdown: "各次完整或未恢复回撤的平均跌幅，是路径指标，不进行年化。",
    averageDrawdownDays: "各次回撤持续自然日数的平均值，不进行年化。",
    rollingSharpe: `每个滚动窗口内按日收益计算，并以 √${annualTradingDays ?? "annual_trading_days"} 年化。`,
    sharpeDeviation: "多条样本外净值路径的年化 Sharpe 横截面标准差，不是时间序列指标，不再年化。",
    positivePathRate: "最终累计收益大于 0 的样本外净值路径占比，不进行年化。",
    cumulativeFee: "报告区间内全部交易费用之和，是区间累计金额，不进行年化。",
    averageTradingDayFee: "实际发生费用的交易日手续费均值；无费用日不计入分母，保持日频金额口径。",
    maxDailyFee: "单个交易日发生的最高费用金额，不进行年化。",
    feeToCapital: "累计费用占初始资金的比例，是报告区间累计比率，不进行年化。"
  };
  return descriptions[key];
}

function returnPeriod(periods?: number) {
  return periods ? `${periods} 个交易日的前瞻收益` : "当前收益列对应的前瞻收益";
}

export function factorMetricDescription(key: FactorMetricKey, periods?: number) {
  const horizon = returnPeriod(periods);
  const descriptions: Record<FactorMetricKey, string> = {
    icMean: `各交易日因子值与${horizon}的 Pearson 相关系数均值。IC 序列不是收益率序列，不进行年化。`,
    rankIcMean: `各交易日因子排名与${horizon}排名的相关系数均值。Rank IC 序列不是收益率序列，不进行年化。`,
    icStd: "各交易日 IC 的样本标准差，保持单次 IC 观测口径，不进行年化。",
    rankIcStd: "各交易日 Rank IC 的样本标准差，保持单次 IC 观测口径，不进行年化。",
    icIr: `IC 均值除以 IC 样本标准差，当前值未年化。若需换算年度口径，必须根据${horizon}、每年独立 IC 观测数以及重叠收益带来的自相关自行计算，不能统一乘以 √252。`,
    rankIcIr: `Rank IC 均值除以 Rank IC 样本标准差，当前值未年化。若需换算年度口径，必须根据${horizon}、每年独立 IC 观测数以及重叠收益带来的自相关自行计算，不能统一乘以 √252。`,
    icPositiveRatio: "IC 大于 0 的有效交易日占比，是频率指标，不进行年化。",
    icThresholdRatio: "IC 超过指定阈值的有效交易日占比，是频率指标，不进行年化。",
    cumulativeReturn: "仅当收益列是 1 个交易日的非重叠前瞻收益时，将每日多空收益复利得到；多期重叠收益不累计。",
    annualReturn: "仅对 1 个交易日的非重叠前瞻收益按 252 个交易日复利年化；多期重叠收益不直接年化。",
    sharpe: "仅对 1 个交易日的非重叠多空收益计算：年化收益除以年化波动；多期重叠收益不直接计算。",
    maxDrawdown: "仅对可复利的 1 日多空收益净值计算，是路径指标，不进行年化。",
    annualVolatility: "仅对 1 个交易日的非重叠多空收益计算，日收益总体标准差乘以 √252。",
    periodMean: `${horizon}的算术平均值。多期收益通常相互重叠，不能在不知道采样与自相关结构时直接年化。`,
    periodStd: `${horizon}的样本标准差。多期收益通常相互重叠，不能统一乘以 √252 年化。`,
    groupMean: `对应因子分组的${horizon}均值，保持收益列原始周期口径。`,
    pValue: "该组收益均值相对 0 的单样本检验 p 值，不进行年化。",
    decayPeak: "IC 绝对值最大的收益周期及其 IC，用于描述信号衰减，不进行年化。",
    halfLife: "IC 绝对值从峰值衰减到一半所对应的收益周期，单位为交易日。",
    monotonicity: "分组序号与组均值之间的相关系数，是无量纲结构指标，不进行年化。",
    correlation: "两个因子值在共同有效样本上的相关系数，不进行年化。",
    dominance: "候选因子在可比指标上优于其他候选的次数，是横截面计数，不进行年化。"
  };
  return descriptions[key];
}
