import assert from "node:assert/strict";
import test from "node:test";

import {
  analysisSettings,
  defaultAnalysisParameters,
  returnTypes,
  setAnalysisDsl,
  setAnalysisReturns,
  setAnalysisReturnType
} from "../src/types/factor.ts";

function assertReturn(node, priceField, start, end) {
  assert.equal(node.type, "DIRECT");
  assert.equal(node.op, "unary.log");
  const division = node.fields.col;
  assert.equal(division.op, "binary.div");
  for (const [side, offset] of [["right", start], ["left", end]]) {
    const shift = division.fields[side];
    assert.equal(shift.type, "TS");
    assert.equal(shift.op, "unary.shift");
    assert.deepEqual(shift.fields, { col: priceField });
    assert.deepEqual(shift.params, { periods: -offset });
    assert.equal(shift.on ?? null, null);
  }
}

test("default ret0-ret9 use consecutive next-day adjusted open-to-open log returns", () => {
  const parameters = defaultAnalysisParameters();
  assert.equal(analysisSettings(parameters).priceField, "open_hfq");
  assert.equal(analysisSettings(parameters).returnType, "next_open");
  assert.deepEqual(parameters.return_columns, Array.from({ length: 10 }, (_, lag) => `ret${lag}`));
  parameters.return_columns.forEach((name, lag) => {
    assertReturn(parameters.dataset_query.derivatives[name], "open_hfq", lag + 1, lag + 2);
    assert.deepEqual(parameters.return_specs[name], { kind: "log", periods: 1 });
  });
  assert.equal(parameters.dataset_query.derivatives.momentum_20d.fields.col, "close_hfq");
});

test("both open price options keep next-day alignment when resizing the return series", () => {
  for (const field of ["open", "open_hfq"]) {
    let parameters = setAnalysisReturns(defaultAnalysisParameters(), field, 60);
    assert.equal(analysisSettings(parameters).priceField, field);
    parameters.return_columns.forEach((name, lag) => {
      assertReturn(parameters.dataset_query.derivatives[name], field, lag + 1, lag + 2);
    });
    parameters = setAnalysisReturns(parameters, analysisSettings(parameters).priceField, 2);
    assert.deepEqual(parameters.return_columns, ["ret0", "ret1"]);
    assert.deepEqual(Object.keys(parameters.return_specs), ["ret0", "ret1"]);
    assert.equal("ret2" in parameters.dataset_query.derivatives, false);
    assertReturn(parameters.dataset_query.derivatives.ret1, field, 2, 3);
  }
});

test("existing close-price choices retain their explicit close-to-close definition", () => {
  for (const field of ["close", "close_hfq"]) {
    const parameters = setAnalysisReturns(defaultAnalysisParameters(), field, 3);
    const original = structuredClone(parameters);
    assert.equal(analysisSettings(parameters).priceField, field);
    parameters.return_columns.forEach((name, lag) => {
      assertReturn(parameters.dataset_query.derivatives[name], field, lag, lag + 1);
    });
    assert.deepEqual(parameters, original);
  }
});

test("return type selector exposes only same-day close and next-day open", () => {
  assert.deepEqual(returnTypes, [
    { label: "当日收盘", value: "close" },
    { label: "下日开盘", value: "next_open" }
  ]);
});

test("switching return types preserves adjustment, sources, and round-trips saved parameters", () => {
  for (const adjusted of [false, true]) {
    const close = adjusted ? "close_hfq" : "close";
    const open = adjusted ? "open_hfq" : "open";
    const original = setAnalysisReturns(defaultAnalysisParameters(), close, 3);
    const snapshot = structuredClone(original);
    assert.equal(analysisSettings(original).returnType, "close");
    const nextOpen = setAnalysisReturnType(original, "next_open", 3);
    assert.equal(analysisSettings(nextOpen).priceField, open);
    assert.equal(analysisSettings(nextOpen).returnType, "next_open");
    nextOpen.return_columns.forEach((name, lag) => assertReturn(nextOpen.dataset_query.derivatives[name], open, lag + 1, lag + 2));
    assert.deepEqual(nextOpen.dataset_query.dsl_source, original.dataset_query.dsl_source);
    const restored = JSON.parse(JSON.stringify(nextOpen));
    assert.equal(analysisSettings(restored).returnType, "next_open");
    const sameDayClose = setAnalysisReturnType(restored, "close", 3);
    sameDayClose.return_columns.forEach((name, lag) => assertReturn(sameDayClose.dataset_query.derivatives[name], close, lag, lag + 1));
    assert.deepEqual(sameDayClose, original);
    assert.deepEqual(original, snapshot);
  }
});

const customReturns = [
  ["same-day open", (parameters) => {
    const division = parameters.dataset_query.derivatives.ret0.fields.col;
    division.fields.right.params.periods = 0;
    division.fields.left.params.periods = -1;
  }],
  ["delayed close", (parameters) => {
    for (const name of parameters.return_columns) {
      const division = parameters.dataset_query.derivatives[name].fields.col;
      division.fields.right.fields.col = "close_hfq";
      division.fields.left.fields.col = "close_hfq";
    }
  }],
  ["different exit offset", (parameters) => { parameters.dataset_query.derivatives.ret0.fields.col.fields.left.params.periods = -3; }],
  ["mixed entry and exit prices", (parameters) => { parameters.dataset_query.derivatives.ret0.fields.col.fields.right.fields.col = "close_hfq"; }],
  ["different later return", (parameters) => { parameters.dataset_query.derivatives.ret2.fields.col.fields.right.params.periods = 0; }],
  ["different operation", (parameters) => { parameters.dataset_query.derivatives.ret0.op = "unary.neg"; }],
  ["masked shift", (parameters) => { parameters.dataset_query.derivatives.ret0.fields.col.fields.right.on = "stock_pool_member"; }],
  ["disabled outer expression", (parameters) => { parameters.dataset_query.derivatives.ret0.on = false; }],
  ["different return kind", (parameters) => { parameters.return_specs.ret0.kind = "simple"; }],
  ["different holding period", (parameters) => { parameters.return_specs.ret0.periods = 5; }],
  ["nonsequential column names", (parameters) => {
    parameters.return_columns.splice(1, 1);
    delete parameters.return_specs.ret1;
  }],
  ["missing return expression", (parameters) => { delete parameters.dataset_query.derivatives.ret0; }]
];

for (const [name, customize] of customReturns) {
  test(`custom ${name} is not labelled as a standard return type or rewritten`, () => {
    const parameters = defaultAnalysisParameters();
    customize(parameters);
    const original = structuredClone(parameters);
    const settings = analysisSettings(parameters);
    assert.equal(settings.returnType, null);
    assert.equal(settings.priceField, null);
    assert.deepEqual(parameters, original);
  });
}

test("standard return matching tolerates explicit default masks and JSON key order", () => {
  for (const field of ["open", "open_hfq", "close", "close_hfq"]) {
    const parameters = setAnalysisReturns(defaultAnalysisParameters(), field, 3);
    function reorder(node) {
      return {
        params: { ...node.params },
        on: null,
        fields: Object.fromEntries(Object.entries(node.fields).reverse().map(([key, value]) => [key, typeof value === "object" ? reorder(value) : value])),
        op: node.op,
        type: node.type
      };
    }
    for (const name of parameters.return_columns) parameters.dataset_query.derivatives[name] = reorder(parameters.dataset_query.derivatives[name]);
    const original = structuredClone(parameters);
    assert.equal(analysisSettings(parameters).priceField, field);
    assert.equal(analysisSettings(parameters).returnType, field.startsWith("open") ? "next_open" : "close");
    assert.deepEqual(parameters, original);
  }
});

test("explicit selection replaces custom offsets while preserving unadjusted prices and sources", () => {
  const parameters = setAnalysisReturns(defaultAnalysisParameters(), "open", 3);
  customReturns[0][1](parameters);
  const original = structuredClone(parameters);
  assert.equal(analysisSettings(parameters).returnType, null);
  const updated = setAnalysisReturnType(parameters, "next_open", 3);
  assert.equal(analysisSettings(updated).returnType, "next_open");
  assert.equal(analysisSettings(updated).priceField, "open");
  assertReturn(updated.dataset_query.derivatives.ret0, "open", 1, 2);
  assert.deepEqual(updated.dataset_query.dsl_source, original.dataset_query.dsl_source);
  assert.deepEqual(parameters, original);
});

test("unrecognizable custom prices use adjusted prices only after an explicit standard selection", () => {
  const parameters = defaultAnalysisParameters();
  parameters.dataset_query.derivatives.ret0 = { type: "DIRECT", op: "unary.neg", fields: { col: "custom_signal" }, params: {} };
  const original = structuredClone(parameters);
  assert.equal(analysisSettings(parameters).returnType, null);
  assert.deepEqual(parameters, original);
  const updated = setAnalysisReturnType(parameters, "close", 2);
  assert.equal(analysisSettings(updated).priceField, "close_hfq");
  assertReturn(updated.dataset_query.derivatives.ret0, "close_hfq", 0, 1);
  assert.deepEqual(updated.dataset_query.dsl_source, original.dataset_query.dsl_source);
  assert.deepEqual(parameters, original);
});

test("changing returns preserves authored factor sources and does not mutate the previous parameters", () => {
  const parameters = setAnalysisReturns(defaultAnalysisParameters(), "close_hfq", 10);
  const original = structuredClone(parameters);
  const updated = setAnalysisReturns(parameters, "open_hfq", 4);

  assert.deepEqual(parameters, original);
  assert.deepEqual(updated.dataset_query.dsl_source, original.dataset_query.dsl_source);
  assert.deepEqual(updated.dataset_query.derivatives.momentum_20d, original.dataset_query.derivatives.momentum_20d);
  assert.deepEqual(updated.factor_columns, original.factor_columns);
  assert.deepEqual(updated.codes_query, original.codes_query);
  assert.deepEqual(updated.dataset_query.filters, original.dataset_query.filters);
});

test("editing the factor DSL preserves the configured open-to-open returns", () => {
  const parameters = defaultAnalysisParameters();
  const dsl = {
    factors: [],
    derivatives: { signal: { type: "DIRECT", op: "unary.neg", fields: { col: "close_hfq" }, params: {} } },
    filters: []
  };
  const updated = setAnalysisDsl(parameters, dsl, parameters.dataset_query.dsl_source);
  assert.deepEqual(updated.factor_columns, ["signal"]);
  for (const name of parameters.return_columns) {
    assert.deepEqual(updated.dataset_query.derivatives[name], parameters.dataset_query.derivatives[name]);
  }
});

test("return values use future trading rows and stay null when either endpoint is missing", () => {
  const { derivatives } = defaultAnalysisParameters().dataset_query;
  const opens = [10, 20, 30, null, 60];
  const valueAt = (node, row) => {
    if (node.op === "unary.shift") return opens[row - node.params.periods] ?? null;
    if (node.op === "binary.div") {
      const left = valueAt(node.fields.left, row);
      const right = valueAt(node.fields.right, row);
      return left === null || right === null ? null : left / right;
    }
    const value = valueAt(node.fields.col, row);
    return value === null ? null : Math.log(value);
  };

  assert.equal(valueAt(derivatives.ret0, 0), Math.log(30 / 20));
  assert.equal(valueAt(derivatives.ret1, 0), null);
  assert.equal(valueAt(derivatives.ret0, 1), null);
  assert.equal(valueAt(derivatives.ret0, 2), null);
  assert.equal(valueAt(derivatives.ret0, 3), null);
  assert.equal(valueAt(derivatives.ret9, 0), null);
});
