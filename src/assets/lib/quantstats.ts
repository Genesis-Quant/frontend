export type DatedReturn = { time: string; value: number };
export type DrawdownPoint = { time: string; value: number };
export type DrawdownPeriod = { start: string; valley: string; end: string; days: number; maxDrawdownPercent: number; maxDrawdown99Percent: number };
export type RollingPoint = { time: string; value: number };

export type QuantStatsReport = {
  totalReturn: number;
  cagr: number;
  sharpe: number;
  sortino: number;
  volatility: number;
  maxDrawdown: number;
  calmar: number;
  payoffRatio: number;
  averageReturn: number;
  maxConsecutiveLosses: number;
  profitFactor: number;
  recoveryFactor: number;
  expectedAnnualReturn: number;
  skew: number;
  kurtosis: number;
  valueAtRisk: number;
  conditionalValueAtRisk: number;
  winRate: number;
  gainToPainRatio: number;
  drawdown: DrawdownPoint[];
  drawdownPeriods: DrawdownPeriod[];
  rollingSharpe: RollingPoint[];
  netValue: RollingPoint[];
};

export function quantStatsReport(rows: DatedReturn[], periods = 252, riskFreeRate = 0, excludeInitialReturn = false): QuantStatsReport {
  const returns = prepareReturns(rows.map((row) => row.value));
  const volatilityReturns = excludeInitialReturn ? returns.slice(1) : returns;
  const annualReturn = cagr(returns, periods);
  const annualVolatility = volatility(volatilityReturns, periods);
  const drawdown = toDrawdownSeries(returns).map((value, index) => ({ time: rows[index].time, value }));
  return {
    totalReturn: compoundedReturn(returns),
    cagr: annualReturn,
    sharpe: sharpe(annualReturn, annualVolatility, riskFreeRate),
    sortino: sortino(returns, riskFreeRate, periods),
    volatility: annualVolatility,
    maxDrawdown: maxDrawdown(returns),
    calmar: calmar(annualReturn, maxDrawdown(returns)),
    payoffRatio: payoffRatio(returns),
    averageReturn: mean(returns),
    maxConsecutiveLosses: consecutiveLosses(returns),
    profitFactor: profitFactor(returns),
    recoveryFactor: recoveryFactor(returns),
    expectedAnnualReturn: expectedAnnualReturn(rows),
    skew: skew(returns),
    kurtosis: kurtosis(returns),
    valueAtRisk: valueAtRisk(returns),
    conditionalValueAtRisk: conditionalValueAtRisk(returns),
    winRate: winRate(returns),
    gainToPainRatio: gainToPainRatio(returns),
    drawdown,
    drawdownPeriods: drawdownDetails(drawdown),
    rollingSharpe: rollingSharpe(rows, riskFreeRate, Math.max(1, Math.round(periods / 2)), periods),
    netValue: cumulativeReturns(returns).map((value, index) => ({ time: rows[index].time, value: value + 1 }))
  };
}

export function prepareReturns(values: number[], riskFreeRate = 0, periods?: number) {
  let returns = values.map((value) => Number.isFinite(value) ? value : 0);
  if (returns.length && Math.min(...returns) >= 0 && Math.max(...returns) > 1) returns = returns.map((value, index) => index ? value / values[index - 1] - 1 : 0);
  if (riskFreeRate > 0) {
    const periodRate = periods ? (1 + riskFreeRate) ** (1 / periods) - 1 : riskFreeRate;
    returns = returns.map((value) => value - periodRate);
  }
  return returns;
}

export function compoundedReturn(returns: number[]) { return returns.reduce((total, value) => total * (1 + value), 1) - 1; }

export function cumulativeReturns(returns: number[]) {
  let total = 1;
  return returns.map((value) => {
    total *= 1 + value;
    return total - 1;
  });
}

export function cagr(returns: number[], periods = 252) {
  if (!returns.length) return Number.NaN;
  const growth = compoundedReturn(returns) + 1;
  return growth > 0 ? growth ** (periods / returns.length) - 1 : Number.NaN;
}

export function sharpe(annualReturn: number, annualVolatility: number, riskFreeRate = 0) {
  return annualVolatility === 0 ? Number.NaN : (annualReturn - riskFreeRate) / annualVolatility;
}

export function sortino(returns: number[], riskFreeRate = 0, periods = 252) {
  const excess = prepareReturns(returns, riskFreeRate, periods);
  const downside = Math.sqrt(excess.filter((value) => value < 0).reduce((total, value) => total + value ** 2, 0) / excess.length);
  return downside === 0 ? Number.NaN : mean(excess) / downside * Math.sqrt(periods);
}

export function volatility(returns: number[], periods = 252) { return populationStandardDeviation(prepareReturns(returns)) * Math.sqrt(periods); }

export function toDrawdownSeries(returns: number[]) {
  const prices = preparePrices(returns);
  const baseline = prices[0] > 1000 ? 100_000 : prices[0] > 10 ? 100 : 1;
  let peak = baseline;
  return prices.map((price) => {
    peak = Math.max(peak, price);
    const value = price / peak - 1;
    return Object.is(value, -0) ? 0 : value;
  });
}

export function maxDrawdown(returns: number[]) {
  const drawdown = toDrawdownSeries(returns);
  return drawdown.length ? Math.min(0, ...drawdown) : 0;
}

export function calmar(annualReturn: number, drawdown: number) { return drawdown === 0 ? Number.NaN : annualReturn / Math.abs(drawdown); }

export function payoffRatio(returns: number[]) {
  const prepared = prepareReturns(returns);
  const wins = prepared.filter((value) => value > 0);
  const losses = prepared.filter((value) => value < 0);
  const averageLoss = losses.length ? mean(losses) : 0;
  return averageLoss === 0 || !wins.length ? Number.NaN : mean(wins) / Math.abs(averageLoss);
}

export function profitFactor(returns: number[]) {
  const prepared = prepareReturns(returns);
  const wins = prepared.filter((value) => value >= 0).reduce((total, value) => total + value, 0);
  const losses = Math.abs(prepared.filter((value) => value < 0).reduce((total, value) => total + value, 0));
  return losses === 0 ? wins === 0 ? 0 : Number.POSITIVE_INFINITY : wins / losses;
}

export function recoveryFactor(returns: number[], riskFreeRate = 0) {
  const prepared = prepareReturns(returns);
  const drawdown = Math.abs(maxDrawdown(prepared));
  return drawdown === 0 ? Number.NaN : Math.abs(prepared.reduce((total, value) => total + value, 0) - riskFreeRate) / drawdown;
}

export function gainToPainRatio(returns: number[]) {
  const prepared = prepareReturns(returns);
  const pain = Math.abs(prepared.filter((value) => value < 0).reduce((total, value) => total + value, 0));
  return pain === 0 ? Number.NaN : prepared.reduce((total, value) => total + value, 0) / pain;
}

export function expectedReturn(returns: number[]) { return returns.length ? returns.reduce((total, value) => total * (1 + value), 1) ** (1 / returns.length) - 1 : Number.NaN; }

export function expectedAnnualReturn(rows: DatedReturn[]) {
  const prepared = prepareReturns(rows.map((row) => row.value));
  const years = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const year = row.time.slice(0, 4);
    years.set(year, [...years.get(year) ?? [], prepared[index]]);
  });
  return expectedReturn([...years.values()].map(compoundedReturn));
}

export function valueAtRisk(returns: number[], sigma = 1, confidence = 0.95) {
  const prepared = prepareReturns(returns);
  const probability = 1 - (confidence > 1 ? confidence / 100 : confidence);
  const standardDeviation = sampleStandardDeviation(prepared);
  return standardDeviation === 0 || Number.isNaN(standardDeviation) ? Number.NaN : mean(prepared) + normalInverseCdf(probability) * standardDeviation * sigma;
}

export function conditionalValueAtRisk(returns: number[], sigma = 1, confidence = 0.95) {
  const prepared = prepareReturns(returns);
  const threshold = valueAtRisk(prepared, sigma, confidence);
  const tail = prepared.filter((value) => value < threshold);
  return tail.length ? mean(tail) : threshold;
}

export function winRate(returns: number[]) {
  const prepared = prepareReturns(returns);
  const nonZero = prepared.filter((value) => value !== 0);
  return nonZero.length ? prepared.filter((value) => value > 0).length / nonZero.length : 0;
}

export function consecutiveLosses(returns: number[]) {
  let current = 0;
  let longest = 0;
  for (const value of prepareReturns(returns)) {
    current = value < 0 ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

export function skew(returns: number[]) {
  const values = prepareReturns(returns);
  const count = values.length;
  if (count < 3) return Number.NaN;
  const average = mean(values);
  if (values.every((value) => value === average)) return 0;
  const deviation = values.reduce((total, value) => total + (value - average) ** 3, 0);
  return count * deviation / ((count - 1) * (count - 2) * sampleStandardDeviation(values) ** 3);
}

export function kurtosis(returns: number[]) {
  const values = prepareReturns(returns);
  const count = values.length;
  if (count < 4) return Number.NaN;
  const average = mean(values);
  if (values.every((value) => value === average)) return 0;
  const variance = sampleStandardDeviation(values) ** 2;
  const fourthMoment = values.reduce((total, value) => total + (value - average) ** 4, 0);
  return count * (count + 1) * fourthMoment / ((count - 1) * (count - 2) * (count - 3) * variance ** 2) - 3 * (count - 1) ** 2 / ((count - 2) * (count - 3));
}

export function drawdownDetails(drawdown: DrawdownPoint[]) {
  const starts: number[] = [];
  const ends: number[] = [];
  for (let index = 1; index < drawdown.length; index += 1) {
    if (drawdown[index].value !== 0 && drawdown[index - 1].value === 0) starts.push(index);
    if (drawdown[index].value === 0 && drawdown[index - 1].value !== 0) ends.push(index - 1);
  }
  if (!starts.length) return [];
  if (ends.length && starts[0] > ends[0]) starts.unshift(0);
  if (!ends.length || starts.at(-1)! > ends.at(-1)!) ends.push(drawdown.length - 1);
  return starts.map((start, index) => {
    const end = ends[index];
    const period = drawdown.slice(start, end + 1);
    const values = period.map((row) => row.value);
    const minimum = Math.min(...values);
    const threshold = quantile(values.map((value) => -value), 0.99);
    const clean = values.filter((value) => -value < threshold);
    return {
      start: drawdown[start].time,
      valley: period[values.indexOf(minimum)].time,
      end: drawdown[end].time,
      days: calendarDays(drawdown[start].time, drawdown[end].time),
      maxDrawdownPercent: minimum * 100,
      maxDrawdown99Percent: (clean.length ? Math.min(...clean) : Number.NaN) * 100
    };
  });
}

export function rollingSharpe(rows: DatedReturn[], riskFreeRate = 0, rollingPeriod = 126, periodsPerYear = 252) {
  const returns = prepareReturns(rows.map((row) => row.value), riskFreeRate, rollingPeriod);
  const result: RollingPoint[] = [];
  for (let index = rollingPeriod - 1; index < returns.length; index += 1) {
    const window = returns.slice(index - rollingPeriod + 1, index + 1);
    const value = mean(window) / sampleStandardDeviation(window) * Math.sqrt(periodsPerYear);
    if (!Number.isNaN(value)) result.push({ time: rows[index].time, value });
  }
  return result;
}

function preparePrices(values: number[]) {
  const clean = values.map((value) => Number.isFinite(value) ? value : 0);
  if (!clean.length || !(Math.min(...clean) < 0 || Math.max(...clean) < 1)) return clean;
  let price = 1;
  return clean.map((value) => {
    price *= 1 + value;
    return price;
  });
}

function mean(values: number[]) { return values.length ? values.reduce((total, value) => total + value, 0) / values.length : Number.NaN; }

function sampleStandardDeviation(values: number[]) {
  if (values.length < 2) return Number.NaN;
  const average = mean(values);
  return Math.sqrt(values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1));
}

function populationStandardDeviation(values: number[]) {
  if (values.length < 2) return Number.NaN;
  const average = mean(values);
  return Math.sqrt(values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length);
}

function quantile(values: number[], probability: number) {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const weight = position - lower;
  return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * weight;
}

function calendarDays(start: string, end: string) { return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1; }

function normalInverseCdf(probability: number) {
  const q = probability - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    return q * polynomial(r, [3.3871328727963665, 133.14166789178438, 1971.5909503065513, 13731.69376550946, 45921.95393154987, 67265.7709270087, 33430.57558358813, 2509.0809287301227]) / polynomial(r, [1, 42.31333070160091, 687.1870074920579, 5394.196021424751, 21213.794301586597, 39307.89580009271, 28729.085735721943, 5226.495278852855]);
  }
  let r = Math.sqrt(-Math.log(q < 0 ? probability : 1 - probability));
  let value: number;
  if (r <= 5) {
    r -= 1.6;
    value = polynomial(r, [1.4234371107496835, 4.630337846156546, 5.769497221460691, 3.6478483247632045, 1.2704582524523684, 0.2417807251774506, 0.022723844989269184, 0.0007745450142783414]) / polynomial(r, [1, 2.053191626637759, 1.6763848301838038, 0.6897673349851, 0.14810397642748008, 0.015198666563616457, 0.0005475938084995345, 1.0507500716444169e-9]);
  } else {
    r -= 5;
    value = polynomial(r, [6.657904643501103, 5.463784911164114, 1.7848265399172913, 0.29656057182850487, 0.026532189526576124, 0.0012426609473880784, 0.000027115555687434876, 2.010334399292288e-7]) / polynomial(r, [1, 0.5998322065558879, 0.1369298809227358, 0.014875361290850615, 0.0007868691311456133, 1.846318317510055e-5, 1.421511758316446e-7, 2.0442631033899397e-15]);
  }
  return q < 0 ? -value : value;
}

function polynomial(value: number, coefficients: number[]) { return coefficients.reduceRight((total, coefficient) => total * value + coefficient); }
