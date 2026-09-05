import assert from "node:assert/strict";
import test from "node:test";

import { dslToPython, initialDslSource } from "../src/assets/lib/dslSource.ts";
import { analysisExecutionParameters, defaultAnalysisParameters } from "../src/types/factor.ts";

test("selects the active compiled factor instead of the stored preview without rewriting sources", () => {
  const parameters = defaultAnalysisParameters();
  parameters.factor_columns = [];
  const original = structuredClone(parameters);
  const document = {
    factors: [],
    derivatives: {
      new_signal: { type: "DIRECT", op: "unary.neg", fields: { col: "close_hfq" }, params: {} }
    },
    filters: []
  };

  const executable = analysisExecutionParameters(parameters, document);

  assert.deepEqual(executable.factor_columns, ["new_signal"]);
  assert.deepEqual(executable.dataset_query, original.dataset_query);
  assert.deepEqual(parameters, original);
});

test("keeps explicitly selected factors when compiling another preview", () => {
  const parameters = defaultAnalysisParameters();
  parameters.factor_columns = ["first", "second"];
  const document = { factors: ["close_hfq"], derivatives: {}, filters: [] };

  assert.equal(analysisExecutionParameters(parameters, document), parameters);
  assert.deepEqual(parameters.factor_columns, ["first", "second"]);
});

test("uses Python as the active language for newly created DSL sources", () => {
  const source = initialDslSource({ factors: ["close"], derivatives: {}, filters: [] });

  assert.equal(source.language, "python");
  assert.equal(source.python_source, 'FACTORS = ["close"]\n\nFILTERS = []');
  assert.match(source.json_source, /"factors"/);
});

test("renders hierarchical Python DSL and omits anonymous operation names", () => {
  const source = dslToPython({
    factors: [],
    derivatives: {
      valid: {
        type: "DIRECT",
        op: "multiary.and",
        fields: {
          cols: [
            {
              type: "DIRECT",
              op: "binary.gt",
              fields: { left: "close", right: 0 },
              params: {}
            },
            {
              type: "DIRECT",
              op: "binary.gt",
              fields: { left: "vol", right: 0 },
              params: {}
            }
          ]
        },
        params: {}
      }
    },
    filters: ["valid"]
  });

  assert.match(source, /DIRECT\.multiary\.and_\("valid"/);
  assert.match(source, /DIRECT\.binary\.gt\(left="close", right=0\)/);
  assert.match(source, /DIRECT\.binary\.gt\(left="vol", right=0\)/);
  assert.doesNotMatch(source, /DIRECT\.multiary_and/);
  assert.doesNotMatch(source, /DIRECT\.binary_gt/);
  assert.doesNotMatch(source, /DERIVATIVES/);
  assert.doesNotMatch(source, /None/);
});

test("renders named derivative references as OP variables in dependency order", () => {
  const source = dslToPython({
    factors: [],
    derivatives: {
      ranked: {
        type: "CS",
        op: "unary.rank_pct",
        fields: { col: "positive" },
        params: { ascending: true, ties_method: "average" }
      },
      positive: {
        type: "DIRECT",
        op: "binary.gt",
        fields: { left: "close", right: 0 },
        params: {}
      }
    },
    filters: ["positive"]
  });

  assert.ok(source.indexOf('"positive"') < source.indexOf('"ranked"'));
  assert.match(source, /rank_pct\("ranked", col=_dsl_1/);
  assert.match(source, /FILTERS = \[_dsl_1\]/);
});
