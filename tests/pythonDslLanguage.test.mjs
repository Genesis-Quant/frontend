import assert from "node:assert/strict";
import test from "node:test";

import {
  pythonDslDiagnostics,
  pythonDslDefinition,
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
    registerDefinitionProvider() {
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
  const lines = source.split("\n");
  const line = lines.at(-1) ?? "";
  const position = { lineNumber: lines.length, column: line.length + 1 };
  const word = /[A-Za-z_]\w*$/.exec(line)?.[0] ?? "";
  const model = {
    uri: { toString: () => uri },
    getValue: () => source,
    getOffsetAt: () => source.length,
    getWordUntilPosition: () => ({
      startColumn: position.column - word.length,
      endColumn: position.column
    }),
    getValueInRange: (range) => (lines[range.startLineNumber - 1] ?? "").slice(
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

  const nestedOnNextLine = completionSuggestions([
    'value = DIRECT.binary.add("value",',
    "    left=DIRECT.binary."
  ].join("\n"));
  assert.doesNotMatch(
    nestedOnNextLine.find((item) => item.label === "add").insertText,
    /^add\(\s*"left"/
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

test("marks only names passed to nested operators", () => {
  const namedNested = [
    'value = DIRECT.binary.add("value",',
    '    left=DIRECT.binary.add("intermediate", left="close", right=1),',
    "    right=1,",
    ")",
    "FACTORS = []",
    "FILTERS = []"
  ].join("\n");
  const diagnostics = pythonDslDiagnostics(namedNested);
  assert.equal(diagnostics.length, 1);
  assert.equal(namedNested.slice(diagnostics[0].start, diagnostics[0].end), '"intermediate"');

  const anonymousNested = namedNested.replace('"intermediate", ', "");
  assert.deepEqual(pythonDslDiagnostics(anonymousNested), []);

  const namedSiblings = namedNested.replace(
    "    right=1,",
    '    right=DIRECT.binary.add("second", left="open", right=1),'
  );
  assert.deepEqual(
    pythonDslDiagnostics(namedSiblings).map((diagnostic) => namedSiblings.slice(diagnostic.start, diagnostic.end)),
    ['"intermediate"', '"second"']
  );

  const namedTopLevel = namedNested.replace(
    '    left=DIRECT.binary.add("intermediate", left="close", right=1),',
    '    left="close",'
  );
  assert.deepEqual(pythonDslDiagnostics(namedTopLevel), []);
});

test("resolves named operations and helper functions to their declarations", () => {
  const source = [
    "def positive(col):",
    "    return DIRECT.binary.gt(left=col, right=0)",
    "",
    'base_universe = positive("close")',
    "FILTERS = [base_universe]"
  ].join("\n");

  const helperReference = source.lastIndexOf("positive");
  const helperDefinition = pythonDslDefinition(source, helperReference + 2);
  assert.equal(source.slice(helperDefinition.start, helperDefinition.end), "positive");
  assert.equal(helperDefinition.start, source.indexOf("positive"));

  const operationReference = source.lastIndexOf("base_universe");
  const operationDefinition = pythonDslDefinition(source, operationReference + 2);
  assert.equal(source.slice(operationDefinition.start, operationDefinition.end), "base_universe");
  assert.equal(operationDefinition.start, source.indexOf("base_universe"));
});

test("resolves helper parameters within their function and ignores strings", () => {
  const source = [
    "def positive(col):",
    "    return DIRECT.binary.gt(left=col, right=0)",
    "",
    'base_universe = positive("col")'
  ].join("\n");

  const parameterReference = source.indexOf("col", source.indexOf("return"));
  const parameterDefinition = pythonDslDefinition(source, parameterReference + 1);
  assert.equal(parameterDefinition.start, source.indexOf("col"));

  const stringReference = source.lastIndexOf("col");
  assert.equal(pythonDslDefinition(source, stringReference + 1), null);
});

test("resolves local assignments without treating multiline keyword arguments as definitions", () => {
  const source = [
    "def positive(col):",
    "    threshold = 0",
    "    return DIRECT.binary.gt(",
    "        left=col,",
    "        right=threshold,",
    "    )",
    "",
    'threshold = positive("close")',
    "FILTERS = [threshold]"
  ].join("\n");

  const localReference = source.indexOf("threshold", source.indexOf("right="));
  const localDefinition = pythonDslDefinition(source, localReference + 1);
  assert.equal(localDefinition.start, source.indexOf("threshold"));

  const keyword = source.indexOf("left=");
  assert.equal(pythonDslDefinition(source, keyword + 1), null);

  const globalReference = source.lastIndexOf("threshold");
  const globalDefinition = pythonDslDefinition(source, globalReference + 1);
  assert.equal(globalDefinition.start, source.indexOf("threshold = positive"));
});
