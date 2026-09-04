import assert from "node:assert/strict";
import test from "node:test";

import { dslToPython } from "../src/assets/lib/dslSource.ts";

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
