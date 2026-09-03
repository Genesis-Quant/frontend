import assert from "node:assert/strict";
import test from "node:test";

import { sqlCompletionCandidates } from "../src/assets/lib/sqlLanguage.ts";

const tables = [
  {
    name: "query_1",
    detail: "动量因子",
    columns: [
      { name: "time", detail: "交易日期" },
      { name: "code", detail: "证券代码" },
      { name: "momentum_20d", detail: "派生因子" }
    ]
  },
  {
    name: "query_2",
    detail: "估值因子",
    columns: [
      { name: "time", detail: "交易日期" },
      { name: "code", detail: "证券代码" },
      { name: "pe_ttm", detail: "基础因子" },
      { name: "行业 分类", detail: "派生因子" }
    ]
  }
];

function candidates(source) {
  const marker = source.indexOf("|");
  const value = marker < 0 ? source : source.slice(0, marker) + source.slice(marker + 1);
  return sqlCompletionCandidates(value, marker < 0 ? value.length : marker, tables);
}

test("offers only selected tables after FROM", () => {
  const result = candidates("SELECT * FROM que");
  assert.deepEqual(result.map((item) => item.label), ["query_1", "query_2"]);
});

test("offers columns for a table-qualified expression", () => {
  const result = candidates("SELECT query_1.");
  assert.deepEqual(result.map((item) => item.label), ["*", "time", "code", "momentum_20d"]);
  assert.equal(result.find((item) => item.label === "momentum_20d")?.insertText, "momentum_20d");
});

test("resolves aliases and only offers columns from the aliased table", () => {
  const result = candidates("SELECT momentum.| FROM query_1 AS momentum JOIN query_2 valuation ON momentum.code = valuation.code");
  assert.deepEqual(result.map((item) => item.label), ["*", "time", "code", "momentum_20d"]);
});

test("resolves aliases for comma-separated relations", () => {
  const result = candidates("SELECT valuation.| FROM query_1 momentum, query_2 valuation");
  assert.deepEqual(result.map((item) => item.label), ["*", "time", "code", "pe_ttm", "行业 分类"]);
});

test("does not consume JOIN as an alias", () => {
  const result = candidates("SELECT query_2.| FROM query_1 JOIN query_2 ON query_1.code = query_2.code");
  assert.deepEqual(result.map((item) => item.label), ["*", "time", "code", "pe_ttm", "行业 分类"]);
});

test("does not let a later statement overwrite the current alias", () => {
  const result = candidates("SELECT q.| FROM query_1 q; SELECT * FROM query_2 q");
  assert.deepEqual(result.map((item) => item.label), ["*", "time", "code", "momentum_20d"]);
});

test("does not let a nested query overwrite an outer alias", () => {
  const result = candidates("SELECT q.| FROM query_1 q WHERE EXISTS (SELECT 1 FROM query_2 q WHERE q.code IS NOT NULL)");
  assert.deepEqual(result.map((item) => item.label), ["*", "time", "code", "momentum_20d"]);
});

test("uses aliases from the innermost query containing the cursor", () => {
  const result = candidates("SELECT * FROM query_1 q WHERE EXISTS (SELECT q.| FROM query_2 q WHERE q.code IS NOT NULL)");
  assert.deepEqual(result.map((item) => item.label), ["*", "time", "code", "pe_ttm", "行业 分类"]);
});

test("keeps the outer query scope while completing inside a function call", () => {
  const result = candidates("SELECT coalesce(q.|, 0) FROM query_1 q");
  assert.deepEqual(result.map((item) => item.label), ["*", "time", "code", "momentum_20d"]);
});

test("qualifies duplicate columns when several tables are selected", () => {
  const result = candidates("SELECT ");
  assert.ok(result.some((item) => item.label === "query_1.time" && item.insertText === "query_1.time"));
  assert.ok(result.some((item) => item.label === "query_2.time" && item.insertText === "query_2.time"));
  assert.ok(result.some((item) => item.label === "pe_ttm" && item.insertText === "pe_ttm"));
});

test("only offers unqualified columns from relations in the current query", () => {
  const result = candidates("SELECT | FROM query_1");
  assert.ok(result.some((item) => item.label === "momentum_20d"));
  assert.ok(!result.some((item) => item.label === "pe_ttm"));
});

test("quotes output columns that are not plain SQL identifiers", () => {
  const result = candidates("SELECT query_2.");
  assert.equal(result.find((item) => item.label === "行业 分类")?.insertText, '"行业 分类"');
});

test("quotes output columns that are DuckDB reserved identifiers", () => {
  const result = sqlCompletionCandidates("SELECT ", 7, [{
    name: "query_3",
    columns: [{ name: "order" }, { name: "ordinary" }, { name: "select" }]
  }]);
  assert.equal(result.find((item) => item.label === "order")?.insertText, '"order"');
  assert.equal(result.find((item) => item.label === "ordinary")?.insertText, "ordinary");
  assert.equal(result.find((item) => item.label === "select")?.insertText, '"select"');
});

test("offers DuckDB functions as snippets with descriptions", () => {
  const result = candidates("SELECT cor");
  const correlation = result.find((item) => item.label === "corr");
  assert.equal(correlation?.insertText, "corr(${1:y}, ${2:x})");
  assert.equal(correlation?.snippet, true);
  assert.match(correlation?.documentation ?? "", /相关系数/);
});

test("does not parse relation names inside comments or string literals", () => {
  const result = candidates("SELECT '-- FROM query_1 fake' AS note /* JOIN query_2 hidden */ FROM query_1 visible WHERE visible.");
  assert.deepEqual(result.map((item) => item.label), ["*", "time", "code", "momentum_20d"]);
});

test("unknown qualifiers do not leak columns from unrelated tables", () => {
  assert.deepEqual(candidates("SELECT missing.") , []);
});
