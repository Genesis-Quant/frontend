import assert from "node:assert/strict";
import test from "node:test";

import {
  pythonDslSignatureHelp,
  registerPythonDslLanguageProviders
} from "../src/assets/lib/pythonDslLanguage.ts";

const catalog = {
  factors: ["close"],
  operators: [
    {
      op: "binary.add",
      type: "DIRECT",
      output_kind: "NUMBER",
      description: "两列或标量相加",
      definition: binaryDefinition()
    },
    {
      op: "binary.gt",
      type: "DIRECT",
      output_kind: "BOOL",
      description: "左侧大于右侧",
      definition: binaryDefinition()
    }
  ]
};

function binaryDefinition() {
  return {
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
  };
}

function completionSuggestions(source) {
  const uri = "factor-dsl://completion-test.py";
  let completionProvider;
  const disposable = { dispose() {} };
  class Range {
    constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
      Object.assign(this, { startLineNumber, startColumn, endLineNumber, endColumn });
    }
  }
  const languages = {
    CompletionItemInsertTextRule: { InsertAsSnippet: 1 },
    CompletionItemKind: { Function: 1, Module: 2 },
    registerCompletionItemProvider(_selector, provider) {
      completionProvider = provider;
      return disposable;
    },
    registerSignatureHelpProvider() {
      return disposable;
    },
    registerHoverProvider() {
      return disposable;
    },
    registerDocumentSemanticTokensProvider() {
      return disposable;
    },
    registerDocumentFormattingEditProvider() {
      return disposable;
    }
  };
  registerPythonDslLanguageProviders({ languages, Range }, uri, catalog);
  const position = { lineNumber: 1, column: source.length + 1 };
  const word = /[A-Za-z_]\w*$/.exec(source)?.[0] ?? "";
  const model = {
    uri: { toString: () => uri },
    getValue: () => source,
    getOffsetAt: () => source.length,
    getWordUntilPosition: () => ({
      startColumn: position.column - word.length,
      endColumn: position.column
    }),
    getValueInRange: (range) => source.slice(
      range.startColumn - 1,
      range.endColumn - 1
    )
  };
  return completionProvider.provideCompletionItems(model, position).suggestions;
}
test("provides signature help immediately after an operator call opens", () => {
  const source = "value = DIRECT.binary.add(";
  const help = pythonDslSignatureHelp(source, source.length, catalog);

  assert.ok(help);
  assert.equal(help.activeSignature, 0);
  assert.equal(help.activeParameter, 0);
  assert.match(help.signatures[0].label, /^DIRECT\.binary\.add\(name:/);
  assert.match(help.signatures[0].label, /left:/);
  assert.match(help.signatures[0].label, /right:/);
});

test("tracks the active positional and keyword parameter", () => {
  const positional = "value = DIRECT.binary.add(\"value\", \"close\", ";
  const positionalHelp = pythonDslSignatureHelp(positional, positional.length, catalog);
  assert.equal(positionalHelp?.activeParameter, 2);

  const keyword = "value = DIRECT.binary.add(\"value\", left=\"close\", right=";
  const keywordHelp = pythonDslSignatureHelp(keyword, keyword.length, catalog);
  assert.equal(keywordHelp?.activeParameter, 2);
});

test("offers only the two required Python DSL result variables", () => {
  const declaration = completionSuggestions("").find(
    (item) => item.label === "DSL 完整声明"
  );

  assert.ok(declaration);
  assert.match(declaration.insertText, /FACTORS/);
  assert.match(declaration.insertText, /FILTERS/);
  assert.doesNotMatch(declaration.insertText, /DERIVATIVES/);
});

test("names assigned and filter operations while keeping nested operations anonymous", () => {
  const derivatives = completionSuggestions("value = DIRECT.binary.");
  assert.match(
    derivatives.find((item) => item.label === "add").insertText,
    /value/
  );

  const filters = completionSuggestions("FILTERS = [DIRECT.binary.");
  assert.deepEqual(filters.map((item) => item.label), ["gt"]);
  assert.match(filters[0].insertText, /filter_name/);

  const nested = completionSuggestions(
    'value = DIRECT.binary.add("value", left=DIRECT.binary.'
  );
  assert.doesNotMatch(
    nested.find((item) => item.label === "add").insertText,
    /factor_name|filter_name/
  );

  assert.deepEqual(
    completionSuggestions("FACTORS = [DIRECT.binary."),
    []
  );
});
