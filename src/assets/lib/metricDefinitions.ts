import type { FactorReturnSpec } from "@/types/factor";

const FACTOR_ANNUAL_TRADING_DAYS = 252;

export function annualizeFactorInformationRatio(value: number | null | undefined, returnSpec: Pick<FactorReturnSpec, "periods"> | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || !returnSpec) return null;
  return value * Math.sqrt(FACTOR_ANNUAL_TRADING_DAYS / returnSpec.periods);
}

export function factorMetricDescription(kind: "icIr" | "rankIcIr", periods?: number, rawValue?: number | null) {
  const horizon = periods ? `${periods} 个交易日的前瞻收益` : "当前收益列对应的前瞻收益";
  const annualization = periods
    ? `原始值 × √(${FACTOR_ANNUAL_TRADING_DAYS} / ${periods})`
    : `原始值 × √(${FACTOR_ANNUAL_TRADING_DAYS} / return_specs.periods)`;
  const raw = rawValue === undefined
    ? ""
    : ` 原始未年化值：${rawValue === null || !Number.isFinite(rawValue) ? "—" : rawValue.toFixed(4)}。`;
  const label = kind === "rankIcIr" ? "Rank ICIR" : "ICIR";
  return `原始 ${label} 为均值除以样本标准差；页面根据${horizon}的 return spec 自动年化，计算为 ${annualization}。${raw}`;
}
