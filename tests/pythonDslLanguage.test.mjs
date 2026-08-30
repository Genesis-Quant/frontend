import assert from "node:assert/strict";
import test from "node:test";

import { pythonDslSignatureHelp } from "../src/assets/lib/pythonDslLanguage.ts";

const catalog = {
  factors: ["close"],
  operators: [{
    op: "binary.add",
    type: "DIRECT",
    output_kind: "NUMBER",
    description: "两列或标量相加",
    definition: {
      properties: {
        fields: { $ref: "#/$defs/Fields" },
        params: { $ref: "#/$defs/Params" }
      },
      $defs: {
        Fields: {
          type: "object",
          properties: {
            left: { anyOf: [{ type: "number" }, { type: "string" }] },
            right: { anyOf: [{ type: "number" }, { type: "string" }] }
          },
          required: ["left", "right"]
        },
        Params: { type: "object", properties: {} }
      }
    }
  }]
};

test("provides signature help immediately after an operator call opens", () => {
  const source = "value = DIRECT.add(";
  const help = pythonDslSignatureHelp(source, source.length, catalog);

  assert.ok(help);
  assert.equal(help.activeSignature, 0);
  assert.equal(help.activeParameter, 0);
  assert.match(help.signatures[0].label, /^DIRECT\.add\(name:/);
  assert.match(help.signatures[0].label, /left:/);
  assert.match(help.signatures[0].label, /right:/);
});

test("tracks the active positional and keyword parameter", () => {
  const positional = "value = DIRECT.add(None, \"close\", ";
  const positionalHelp = pythonDslSignatureHelp(positional, positional.length, catalog);
  assert.equal(positionalHelp?.activeParameter, 2);

  const keyword = "value = DIRECT.add(None, left=\"close\", right=";
  const keywordHelp = pythonDslSignatureHelp(keyword, keyword.length, catalog);
  assert.equal(keywordHelp?.activeParameter, 2);
});
