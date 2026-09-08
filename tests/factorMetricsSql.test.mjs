import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const duckdb = require("../node_modules/@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs");

// Extract the actual pure SQL builders without importing browser-only WASM URLs.
const source = readFileSync(new URL("../src/assets/lib/factorAnalysis.ts", import.meta.url), "utf8");
const tree = ts.createSourceFile("factorAnalysis.ts", source, ts.ScriptTarget.Latest, true);
const names = new Set(["factorMetricsSql", "endpointColumnNames", "groupDefinitions", "dateFilter", "numberValue", "identifier", "literal"]);
const builders = tree.statements.filter((node) => ts.isFunctionDeclaration(node) && names.has(node.name?.text));
assert.equal(builders.length, names.size);
const analyticsClass = tree.statements.find((node) => ts.isClassDeclaration(node) && node.name?.text === "FactorAnalytics");
const methods = analyticsClass.members.filter((node) => ts.isMethodDeclaration(node) && ["longShortSeries", "groupSeries"].includes(node.name.getText(tree)));
assert.equal(methods.length, 2);
const compiled = ts.transpileModule([
  ...builders.map((node) => node.getText(tree)),
  `class ChartQueries { ${methods.map((node) => node.getText(tree)).join("\n")} }`
].join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText;
const { factorMetricsSql, ChartQueries } = new Function("duckDbDateValue", `${compiled}\nreturn {factorMetricsSql, ChartQueries};`)((value) => String(value));

test("factor SQL uses initial NAV, handles total loss, and agrees for log/simple returns", async () => {
  const base = new URL("../node_modules/@duckdb/duckdb-wasm/dist/", import.meta.url);
  const db = await duckdb.createDuckDB({ mvp: {
    mainModule: fileURLToPath(new URL("duckdb-mvp.wasm", base)),
    mainWorker: fileURLToPath(new URL("duckdb-node-mvp.worker.cjs", base))
  } }, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME);
  await db.instantiate();
  const connection = db.connect();
  const directory = mkdtempSync(join(tmpdir(), "arena-factor-sql-"));
  const path = (name) => join(directory, name).replaceAll("\\", "/");
  const quoted = (value) => `'${value.replaceAll("'", "''")}'`;
  const information = path("ic.parquet");
  try {
    connection.query(`COPY (SELECT 0.1 AS signal_r1_ic, 0.2 AS signal_r1_rank_ic) TO ${quoted(information)} (FORMAT PARQUET)`);
    const cases = [
      { values: [-0.1, 0, 0.02], kind: "simple", expectedGrowth: 0.918, expectedDrawdown: 0.1 },
      { values: [Math.log(0.9), 0, Math.log(1.02)], kind: "log", expectedGrowth: 0.918, expectedDrawdown: 0.1 },
      { values: [-1, 0, 0.02], kind: "simple", expectedGrowth: 0, expectedDrawdown: 1 },
      { values: [0.1, 0.2, -0.1], kind: "simple", expectedGrowth: 1.188, expectedDrawdown: 0.1 },
      { values: [-1.1, 0, 0], kind: "simple", expectedGrowth: -0.1, expectedDrawdown: 1.1 },
      { values: [null, 0.05, null, -0.2, null], kind: "simple", expectedGrowth: 0.84, expectedDrawdown: 0.2 },
      { values: [null, Math.log(1.05), null, Math.log(0.8), null], kind: "log", expectedGrowth: 0.84, expectedDrawdown: 0.2 }
    ];
    for (const [index, item] of cases.entries()) {
      const rows = item.values.map((value, i) => `(DATE '2025-01-0${i + 1}', 0.0, ${value})`).join(",");
      const file = path(`returns-${index}.parquet`);
      connection.query(`COPY (SELECT *, signal_r1_bottom AS signal_r1_group0, signal_r1_top AS signal_r1_group1 FROM (VALUES ${rows}) AS data(time,signal_r1_bottom,signal_r1_top)) TO ${quoted(file)} (FORMAT PARQUET)`);
      const result = connection.query(factorMetricsSql(information, file, ["signal"], ["r1"], {
        r1: { kind: item.kind, periods: 1 }
      })).toArray()[0].toJSON();
      assert.ok(Math.abs(result.cumulative_return - (item.expectedGrowth - 1)) < 1e-12);
      assert.ok(Math.abs(result.max_drawdown - item.expectedDrawdown) < 1e-12);
      if (item.expectedGrowth < 0) assert.equal(result.annual_return, null);
      const charts = new ChartQueries();
      charts.groupsFile = file;
      charts.parameters = { n_select: 1 };
      charts.returnSpec = () => ({ kind: item.kind, periods: 1 });
      charts.rows = async (query) => connection.query(query).toArray().map((row) => row.toJSON());
      const longShort = await charts.longShortSeries("signal", "r1");
      const groups = await charts.groupSeries("signal", "r1", 2);
      assert.ok(Math.abs(longShort.at(-1).cumulative - (item.expectedGrowth - 1)) < 1e-12);
      assert.ok(Math.abs(groups.at(-1).values["最大 1 支"] - item.expectedGrowth) < 1e-12);
      assert.ok(Math.abs(groups[0].reverseValues["最大 1 支"] - item.expectedGrowth) < 1e-12);
      for (let offset = 0; offset < item.values.length; offset += 1) {
        const suffix = item.values.slice(offset).filter((value) => value !== null);
        const actual = groups[offset].reverseValues["最大 1 支"];
        if (!suffix.length) assert.equal(actual, null);
        else {
          const expected = item.kind === "log"
            ? Math.exp(suffix.reduce((sum, value) => sum + value, 0))
            : suffix.reduce((product, value) => product * (1 + value), 1);
          assert.ok(Math.abs(actual - expected) < 1e-12);
        }
      }
      const selected = await charts.groupSeries("signal", "r1", 2, { start: "2025-01-02", end: "2025-01-03" });
      assert.equal(selected.length, 2);
      assert.ok(Math.abs(selected[0].reverseValues["最大 1 支"] - selected.at(-1).values["最大 1 支"]) < 1e-12);
      charts.returnSpec = () => ({ kind: item.kind, periods: 5 });
      const overlapping = await charts.groupSeries("signal", "r1", 2);
      assert.ok(overlapping.every((row) => Object.values(row.values).every((value) => value === null)));
      assert.ok(overlapping.every((row) => Object.values(row.reverseValues).every((value) => value === null)));
    }
  } finally {
    connection.close();
    db.reset();
    rmSync(directory, { recursive: true, force: true });
  }
});
