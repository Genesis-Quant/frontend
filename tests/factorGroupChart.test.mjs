import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

import { chartRange, formatAxisLabel } from "../src/assets/lib/chart.ts";

const source = readFileSync(new URL("../src/components/panel/FactorAnalysisReport.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("FactorAnalysisReport.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["groupChartPoints", "groupOption", "groupColor", "baseOption", "axis"]);
const functions = tree.statements.filter((node) => ts.isFunctionDeclaration(node) && names.has(node.name?.text));
assert.equal(functions.length, names.size);
const compiled = ts.transpileModule(functions.map((node) => node.getText(tree)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText;
const { groupChartPoints, groupOption } = new Function("formatAxisLabel", `${compiled}\nreturn { groupChartPoints, groupOption };`)(formatAxisLabel);

const rows = [
  { time: "2026-01-02", values: { low: 1.01, high: 1.02 }, reverseValues: { low: 1.030301, high: 1.061208 } },
  { time: "2026-01-05", values: { low: 1.0201, high: 1.0404 }, reverseValues: { low: 1.0201, high: 1.0404 } },
  { time: "2026-01-06", values: { low: 1.030301, high: 1.061208 }, reverseValues: { low: 1.01, high: 1.02 } }
];

test("reverse curves anchor all groups at one and retain every day's return", () => {
  const original = structuredClone(rows);
  const reversed = groupChartPoints(rows, true);
  assert.equal(reversed.length, rows.length + 1);
  assert.deepEqual(reversed.map((row) => row.time), ["2026-01-06（起点）", "2026-01-06", "2026-01-05", "2026-01-02"]);
  assert.deepEqual(reversed[0].values, { low: 1, high: 1 });
  assert.deepEqual(reversed.at(-1).values, rows.at(-1).values);
  assert.deepEqual(rows, original);
  assert.equal(groupChartPoints(rows, false), rows);
});

test("ordered positive returns keep both group order and rising time paths after reversal", () => {
  for (const reverse of [false, true]) {
    const points = groupChartPoints(rows, reverse);
    for (const [index, row] of points.entries()) {
      assert.ok(row.values.high >= row.values.low);
      if (index > 0) {
        assert.ok(row.values.low >= points[index - 1].values.low);
        assert.ok(row.values.high >= points[index - 1].values.high);
      }
    }
  }
});

test("reverse display preserves genuine recent crossings and missing values", () => {
  const input = [
    { time: "2026-01-02", values: { low: 1.1, high: 2 }, reverseValues: { low: 1.65, high: 2.2 } },
    { time: "2026-01-05", values: { low: 1.65, high: 2.2 }, reverseValues: { low: 1.5, high: 1.1 } },
    { time: "2026-01-06", values: { low: 1.65, high: 2.2 }, reverseValues: { low: null, high: null } }
  ];
  const reversed = groupChartPoints(input, true);
  assert.deepEqual(reversed[1].values, { low: null, high: null });
  assert.ok(reversed[2].values.low > reversed[2].values.high);
  assert.ok(reversed[3].values.low < reversed[3].values.high);
  assert.deepEqual(reversed.at(-1).values, input.at(-1).values);
});

test("chart dates, colors, tooltips and comparison range follow the displayed series", () => {
  const reversed = groupChartPoints(rows, true);
  const range = chartRange(reversed.flatMap((row) => Object.values(row.values)));
  assert.deepEqual(range, { min: 1, max: 1.061208 });
  const forwardOption = groupOption(rows, "light");
  const reverseOption = groupOption(reversed, "dark", range);
  assert.deepEqual(reverseOption.xAxis.data, reversed.map((row) => row.time));
  assert.deepEqual(reverseOption.series.map((series) => [series.name, series.color]), forwardOption.series.map((series) => [series.name, series.color]));
  assert.deepEqual(reverseOption.series[1].data, [1, 1.02, 1.0404, 1.061208]);
  assert.equal(reverseOption.tooltip.trigger, "axis");
  assert.equal(reverseOption.yAxis.min, 1);
  assert.equal(reverseOption.yAxis.max, 1.061208);
});

test("empty and single-date series can be switched without fabricating a return", () => {
  assert.deepEqual(groupChartPoints([], true), []);
  const single = [{ time: "2026-01-02", values: { only: 0 }, reverseValues: { only: 0 } }];
  assert.deepEqual(groupChartPoints(single, true).map((row) => row.values.only), [1, 0]);
});
