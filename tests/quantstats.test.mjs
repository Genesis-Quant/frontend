import assert from "node:assert/strict";
import test from "node:test";
import { quantStatsReport } from "../src/assets/lib/quantstats.ts";

function report(values, periods = 252, riskFreeRate = 0, excludeInitialReturn = false) {
  return quantStatsReport(values.map((value, index) => ({
    time: new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10), value
  })), periods, riskFreeRate, excludeInitialReturn);
}

test("daily returns above 100 percent are never reinterpreted as prices", () => {
  const actual = report([1.2, 0.1, 0.2]);
  assert.ok(Math.abs(actual.totalReturn - 1.904) < 1e-12);
  assert.ok(Math.abs(actual.netValue.at(-1).value - 2.904) < 1e-12);
  assert.equal(actual.maxDrawdown, 0);
  assert.equal(actual.winRate, 1);
});

test("drawdown intervals include initial losses, recovery and later losses", () => {
  for (const values of [[-0.1], [-0.1, 0, 0]]) {
    const actual = report(values);
    assert.equal(actual.drawdownPeriods.length, 1);
    assert.equal(actual.drawdownPeriods[0].start, "2025-01-01");
    assert.ok(Math.abs(actual.maxDrawdown + 0.1) < 1e-12);
  }
  const actual = report([-0.1, 0.2, -0.2, 0]);
  assert.equal(actual.drawdownPeriods.length, 2);
  assert.deepEqual(actual.drawdownPeriods.map(({ start, end }) => [start, end]), [
    ["2025-01-01", "2025-01-01"], ["2025-01-03", "2025-01-04"]
  ]);
});

test("Sortino applies negative as well as positive risk-free rates", () => {
  const values = [-0.02, 0.01, 0.03];
  for (const rf of [-0.04, 0, 0.04]) {
    const excess = values.map((value) => value - ((1 + rf) ** (1 / 252) - 1));
    const downside = Math.sqrt(excess.reduce((sum, value) => sum + Math.min(value, 0) ** 2, 0) / values.length);
    const expected = excess.reduce((sum, value) => sum + value, 0) / values.length / downside * Math.sqrt(252);
    assert.ok(Math.abs(report(values, 252, rf).sortino - expected) < 1e-12);
  }
});

test("one-point and constant rolling windows never throw or emit infinite Sharpe", () => {
  for (const periods of [1, 2, 252]) {
    assert.deepEqual(report(Array(130).fill(0.01), periods).rollingSharpe, []);
  }
  const actual = report(Array.from({ length: 130 }, (_, index) => index % 2 ? 0.02 : -0.01));
  assert.equal(actual.rollingSharpe.length, 5);
  assert.ok(actual.rollingSharpe.every(({ value }) => Number.isFinite(value)));
});

test("volatility needs two observations after excluding initial return", () => {
  assert.ok(Number.isNaN(report([0.01, 0.02], 252, 0, true).volatility));
  assert.equal(report([0.01, 0.02, 0.02], 252, 0, true).volatility, 0);
});
