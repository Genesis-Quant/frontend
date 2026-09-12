import assert from "node:assert/strict";
import test from "node:test";

import { defaultBacktestParameters, setBacktestMarketSource, setBacktestStockPoolType } from "../src/types/backtest.ts";

test("market source changes only execution configuration, never source text", () => {
  const daily = defaultBacktestParameters();
  assert.equal(daily.market_source, "daily");
  const before = structuredClone(daily);
  const snapshot = setBacktestMarketSource(daily, "snapshot");
  assert.equal(snapshot.adj, null);
  assert.equal(snapshot.config.syntheticSpread, 0);
  assert.deepEqual(snapshot.dataset_query, daily.dataset_query);
  assert.deepEqual(snapshot.codes_query, daily.codes_query);
  assert.deepEqual(snapshot.callbacks, daily.callbacks);
  assert.equal(snapshot.utils, daily.utils);
  assert.deepEqual(daily, before);
  const restored = setBacktestMarketSource(snapshot, "daily");
  assert.deepEqual(restored, { ...snapshot, market_source: "daily" });
});

test("new backtests use the dynamic HS300 stock pool by default", () => {
  const parameters = defaultBacktestParameters();
  assert.ok(parameters.codes_query);
  assert.equal(
    parameters.codes_query.derivatives.stock_pool_member.fields.left,
    "weight_000300SH"
  );
  assert.deepEqual(parameters.codes_query.filters, ["stock_pool_member"]);
  assert.deepEqual(parameters.dataset_query.codes, []);
  assert.equal("stock_pool_member" in parameters.dataset_query.derivatives, false);
  assert.equal(parameters.callbacks.onSnapshot.includes("stock_pool_member == true"), true);
});

test("switching stock pool type preserves the dataset DSL and static codes", () => {
  const parameters = defaultBacktestParameters();
  parameters.dataset_query.codes = ["600000.SH", "000001.SZ"];
  parameters.dataset_query.dsl_source = {
    language: "python",
    json_source: "custom json source",
    python_source: "custom python source"
  };
  const originalDataset = structuredClone(parameters.dataset_query);

  const dynamic = setBacktestStockPoolType(parameters, true);
  assert.ok(dynamic.codes_query);
  assert.equal(dynamic.codes_query.start_date, parameters.dataset_query.start_date);
  assert.equal(dynamic.codes_query.end_date, parameters.dataset_query.end_date);
  assert.deepEqual(dynamic.codes_query.filters, ["stock_pool_member"]);
  assert.equal(dynamic.codes_query.derivatives.stock_pool_member.fields.left, "weight_000300SH");
  assert.deepEqual(dynamic.dataset_query, originalDataset);
  assert.deepEqual(dynamic.callbacks, parameters.callbacks);

  const staticParameters = setBacktestStockPoolType(dynamic, false);
  assert.equal(staticParameters.codes_query, null);
  assert.deepEqual(staticParameters.dataset_query.codes, ["600000.SH", "000001.SZ"]);
  assert.deepEqual(staticParameters.dataset_query, originalDataset);
});
