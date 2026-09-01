import type { Monaco } from "@monaco-editor/react";

import { formatPythonDslSource } from "@/assets/lib/dslFormatting";
import type { DslCatalog, DslOperator, JsonSchema } from "@/types/factor";

type OutputKind = DslOperator["output_kind"];
type OperatorType = DslOperator["type"];
type TextModel = import("monaco-editor").editor.ITextModel;
type Position = import("monaco-editor").Position;
type CompletionItem = import("monaco-editor").languages.CompletionItem;
type CompletionTarget = { insideString: boolean; range: import("monaco-editor").IRange };
type SemanticRole = "class" | "function" | "method" | "parameter" | "property" | "variable";
type SemanticSpan = { end: number; role: SemanticRole; start: number };
type SemanticContext = {
  classNames: Set<string>;
  functionNames: Set<string>;
  parameterDeclarations: Map<number, number>;
  parameterNames: Set<string>;
};
type PythonParameter = {
  name: string;
  role: "name" | "field" | "parameter" | "on";
  schema: JsonSchema;
  required: boolean;
};
type PythonSymbol = {
  name: string;
  kind: "function" | "operation" | "operation-list" | "variable";
  outputKind: OutputKind;
  operator?: DslOperator;
  signature?: string;
};
type LexicalSource = {
  comments: Array<{ end: number; start: number }>;
  masked: string;
  strings: Array<{ contentEnd: number; contentStart: number; end: number; start: number }>;
};
type CallContext = {
  alias: string;
  candidates: DslOperator[];
  category: string;
  currentKeyword?: string;
  namespace: OperatorType;
  positionalIndex: number;
  typingKeyword: boolean;
  usedKeywords: Set<string>;
};

const namespaces: OperatorType[] = ["DIRECT", "TS", "CS"];
const resultVariables = ["FACTORS", "DERIVATIVES", "FILTERS"] as const;
const semanticTokenTypes = ["type", "annotation", "constant", "variable.parameter", "key", "variable"];
const semanticTokenTypeByRole: Record<SemanticRole, number> = {
  class: 0,
  function: 1,
  method: 2,
  parameter: 3,
  property: 4,
  variable: 5
};
const pythonBuiltinTypes = new Set(["bool", "bytes", "dict", "float", "frozenset", "int", "list", "object", "set", "str", "tuple", "type"]);
const pythonKeywords = new Set([
  "and", "as", "assert", "async", "await", "break", "case", "class", "continue", "def", "del", "elif", "else", "except", "False", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "match", "None", "nonlocal", "not", "or", "pass", "raise", "return", "True", "try", "while", "with", "yield"
]);

export function registerPythonDslLanguageProviders(monaco: Monaco, uri: string, catalog: DslCatalog) {
  const selector = { language: "python", scheme: "factor-dsl" };
  return [
    monaco.languages.registerCompletionItemProvider(selector, {
      triggerCharacters: [".", "(", ",", "=", "[", "\"", "'", "*"],
      provideCompletionItems(model: TextModel, position: Position) {
        if (model.uri.toString() !== uri) return { suggestions: [] };
        return { suggestions: pythonCompletions(monaco, model, position, catalog) };
      }
    }),
    monaco.languages.registerSignatureHelpProvider(selector, {
      signatureHelpTriggerCharacters: ["(", ","],
      signatureHelpRetriggerCharacters: [","],
      provideSignatureHelp(model: TextModel, position: Position) {
        if (model.uri.toString() !== uri) return null;
        const value = pythonDslSignatureHelp(model.getValue(), model.getOffsetAt(position), catalog);
        if (!value) return null;
        return {
          dispose() {},
          value
        };
      }
    }),
    monaco.languages.registerHoverProvider(selector, {
      provideHover(model: TextModel, position: Position) {
        if (model.uri.toString() !== uri) return null;
        return pythonHover(model, position, catalog);
      }
    }),
    monaco.languages.registerDocumentSemanticTokensProvider(selector, {
      getLegend() {
        return { tokenModifiers: [], tokenTypes: semanticTokenTypes };
      },
      provideDocumentSemanticTokens(model: TextModel) {
        if (model.uri.toString() !== uri) return { data: new Uint32Array() };
        return { data: encodeSemanticTokens(model, pythonSemanticSpans(model.getValue())) };
      },
      releaseDocumentSemanticTokens() {}
    }),
    monaco.languages.registerDocumentFormattingEditProvider(selector, {
      displayName: "Arena Python DSL",
      provideDocumentFormattingEdits(model: TextModel) {
        if (model.uri.toString() !== uri) return [];
        const formatted = formatPythonDslSource(model.getValue());
        return formatted === model.getValue() ? [] : [{ range: model.getFullModelRange(), text: formatted }];
      }
    })
  ];
}

export function pythonDslSignatureHelp(source: string, offset: number, catalog: DslCatalog) {
  const context = callContext(source, offset, catalog);
  if (!context || !context.candidates.length) return null;
  const activeSignature = bestCandidateIndex(context);
  const operator = context.candidates[activeSignature];
  const parameters = operatorParameters(operator);
  return {
    activeParameter: activeParameterIndex(context, parameters),
    activeSignature,
    signatures: context.candidates.map((candidate) => operatorSignature(candidate, context.namespace, context.category, context.alias))
  };
}

function pythonSemanticSpans(source: string): SemanticSpan[] {
  const masked = lexPython(source).masked;
  const context = collectSemanticContext(masked);
  return [...masked.matchAll(/\b[A-Za-z_]\w*\b/g)].flatMap((match) => {
    const name = match[0];
    const start = match.index ?? 0;
    if (pythonKeywords.has(name)) return [];
    const end = start + name.length;
    return [{ end, role: semanticRole(masked, name, start, end, context), start }];
  });
}

function collectSemanticContext(masked: string): SemanticContext {
  const classNames = new Set<string>([...namespaces, ...pythonBuiltinTypes]);
  const functionNames = new Set<string>();
  const parameterNames = new Set<string>();
  const parameterDeclarations = new Map<number, number>();

  for (const match of masked.matchAll(/\bclass\s+([A-Za-z_]\w*)/g)) classNames.add(match[1]);
  for (const match of masked.matchAll(/\bdef\s+([A-Za-z_]\w*)\s*\(/g)) {
    functionNames.add(match[1]);
    const open = (match.index ?? 0) + match[0].lastIndexOf("(");
    const close = matchingDelimiter(masked, open, "(", ")");
    if (close < 0) continue;
    for (const segment of topLevelSegmentRanges(masked, open + 1, close)) {
      const parameter = /^\s*\*{0,2}\s*([A-Za-z_]\w*)/.exec(masked.slice(segment.start, segment.end));
      if (!parameter) continue;
      const start = segment.start + (parameter.index ?? 0) + parameter[0].lastIndexOf(parameter[1]);
      parameterNames.add(parameter[1]);
      parameterDeclarations.set(start, start + parameter[1].length);
    }
  }
  return { classNames, functionNames, parameterDeclarations, parameterNames };
}

function semanticRole(source: string, name: string, start: number, end: number, context: SemanticContext): SemanticRole {
  const previousWord = /([A-Za-z_]\w*)\s*$/.exec(source.slice(0, start))?.[1];
  const previous = previousNonWhitespace(source, start);
  const next = nextNonWhitespace(source, end);
  if (previousWord === "class" || context.classNames.has(name)) return "class";
  if (previousWord === "def" || context.functionNames.has(name) && next?.char === "(") return "function";
  if (context.parameterDeclarations.get(start) === end || context.parameterNames.has(name) || isKeywordArgument(source, start, end)) return "parameter";
  if (previous?.char === ".") return next?.char === "(" ? "method" : "property";
  return next?.char === "(" ? "function" : "variable";
}

function encodeSemanticTokens(model: TextModel, spans: SemanticSpan[]) {
  const data: number[] = [];
  let previousLine = 0;
  let previousColumn = 0;
  for (const span of spans) {
    const position = model.getPositionAt(span.start);
    const line = position.lineNumber - 1;
    const column = position.column - 1;
    data.push(
      line - previousLine,
      line === previousLine ? column - previousColumn : column,
      span.end - span.start,
      semanticTokenTypeByRole[span.role],
      0
    );
    previousLine = line;
    previousColumn = column;
  }
  return new Uint32Array(data);
}

function topLevelSegmentRanges(source: string, start: number, end: number) {
  const result: Array<{ end: number; start: number }> = [];
  const stack: string[] = [];
  const matching: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let segmentStart = start;
  for (let index = start; index < end; index += 1) {
    const char = source[index];
    if (char === "(" || char === "[" || char === "{") stack.push(char);
    else if (matching[char] && stack.at(-1) === matching[char]) stack.pop();
    else if (char === "," && stack.length === 0) {
      result.push({ end: index, start: segmentStart });
      segmentStart = index + 1;
    }
  }
  result.push({ end, start: segmentStart });
  return result;
}

function previousNonWhitespace(source: string, offset: number) {
  let index = offset - 1;
  while (index >= 0 && /\s/.test(source[index])) index -= 1;
  return index < 0 ? undefined : { char: source[index], index };
}

function nextNonWhitespace(source: string, offset: number) {
  let index = offset;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index >= source.length ? undefined : { char: source[index], index };
}

function isKeywordArgument(source: string, start: number, end: number) {
  const next = nextNonWhitespace(source, end);
  if (!next || next.char !== "=" || source[next.index + 1] === "=") return false;
  const stack: Array<{ char: string; index: number }> = [];
  const matching: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (let index = 0; index < start; index += 1) {
    const char = source[index];
    if (char === "(" || char === "[" || char === "{") stack.push({ char, index });
    else if (matching[char] && stack.at(-1)?.char === matching[char]) stack.pop();
  }
  const open = [...stack].reverse().find((entry) => entry.char === "(");
  if (!open) return false;
  return /(?:[A-Za-z_]\w*|\))\s*$/.test(source.slice(Math.max(0, open.index - 160), open.index));
}

function pythonCompletions(monaco: Monaco, model: TextModel, position: Position, catalog: DslCatalog): CompletionItem[] {
  const source = model.getValue();
  const offset = model.getOffsetAt(position);
  const lexical = lexPython(source);
  if (lexical.comments.some((comment) => offset >= comment.start && offset <= comment.end)) return [];
  const target = completionTarget(monaco, model, position, lexical, offset);
  const maskedPrefix = lexical.masked.slice(0, offset);
  const symbols = collectSymbols(lexical.masked.slice(0, offset), catalog);
  const resultList = enclosingResultList(lexical.masked, offset);
  const operatorMember = /\b(DIRECT|TS|CS)\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/.exec(maskedPrefix);
  if (operatorMember) {
    if (resultList === "FACTORS") return [];
    return operatorCompletionItems(
      monaco,
      model,
      position,
      operatorMember[1] as OperatorType,
      operatorMember[2],
      operatorMember[3] ?? "",
      catalog,
      target,
      resultList
    );
  }
  const categoryMember = /\b(DIRECT|TS|CS)\.([A-Za-z_]\w*)?$/.exec(maskedPrefix);
  if (categoryMember) {
    if (resultList === "FACTORS") return [];
    return operatorCategoryItems(
      monaco,
      categoryMember[1] as OperatorType,
      categoryMember[2] ?? "",
      catalog,
      target,
      resultList
    );
  }

  if (resultList) return resultListItems(monaco, resultList, catalog, symbols, target);

  const context = callContextFromLexical(source, lexical, offset, catalog);
  if (context) {
    const values = callValueItems(monaco, model, position, context, catalog, symbols, target);
    if (context.currentKeyword || !context.typingKeyword) return values;
    return uniqueItems([
      ...operatorKeywordItems(monaco, context, catalog, target),
      ...values
    ]);
  }

  if (target.insideString) return [];
  return topLevelItems(monaco, source.slice(0, offset), symbols, catalog, target);
}

function operatorCategoryItems(monaco: Monaco, namespace: OperatorType, partial: string, catalog: DslCatalog, target: CompletionTarget, resultList?: typeof resultVariables[number]): CompletionItem[] {
  const operators = catalog.operators.filter(
    (operator) => operator.type === namespace && (resultList !== "FILTERS" || operator.output_kind === "BOOL")
  );
  const categories = [...new Set(operators
    .map((operator) => operator.op.split(".", 1)[0]))]
    .filter((category) => category.startsWith(partial))
    .sort();
  return categories.map((category) => ({
    label: category,
    detail: `${namespace} 算子类别`,
    documentation: `${namespace}.${category} 下包含 ${operators.filter((operator) => operator.op.startsWith(`${category}.`)).length} 个算子。`,
    insertText: `${category}.`,
    command: { id: "editor.action.triggerSuggest", title: "显示该类别的 DSL 算子" },
    kind: monaco.languages.CompletionItemKind.Module,
    range: target.range,
    sortText: `0-${category}`
  }));
}

function operatorCompletionItems(monaco: Monaco, model: TextModel, position: Position, namespace: OperatorType, category: string, partial: string, catalog: DslCatalog, target: CompletionTarget, resultList?: typeof resultVariables[number]): CompletionItem[] {
  const operators = catalog.operators.filter(
    (operator) => operator.type === namespace
      && operator.op.startsWith(`${category}.`)
      && (resultList !== "FILTERS" || operator.output_kind === "BOOL")
  );
  const assignment = assignmentName(model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column
  }));
  const outputName = assignment ?? (
    resultList === "FILTERS"
      ? "filter_name"
      : resultList === "DERIVATIVES"
        ? "factor_name"
        : undefined
  );
  const items = operators.map((operator): CompletionItem => {
    const alias = shortAlias(operator.op);
    return {
      label: alias,
      detail: `${operator.op} · ${operator.output_kind}`,
      documentation: { value: operatorDocumentation(operator, namespace, category, alias) },
      filterText: `${alias} ${operator.op}`,
      insertText: operatorCallSnippet(operator, alias, outputName),
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      kind: monaco.languages.CompletionItemKind.Function,
      range: target.range,
      sortText: `0-${alias}`
    };
  });
  return items.filter((item) => completionLabel(item).startsWith(partial) || String(item.filterText ?? "").includes(partial));
}

function operatorCallSnippet(operator: DslOperator, alias: string, outputName?: string) {
  let placeholder = 1;
  const argumentsList = outputName
    ? [`"\${${placeholder++}:${escapeSnippet(outputName)}}"`]
    : [];
  for (const parameter of operatorParameters(operator).slice(1)) {
    if (!parameter.required && schemaDefault(parameter.schema) === undefined) continue;
    argumentsList.push(`${parameter.name}=\${${placeholder++}:${escapeSnippet(parameterDefault(parameter))}}`);
  }
  if (argumentsList.length === 1) return `${alias}(${argumentsList[0]})`;
  return `${alias}(\n    ${argumentsList.join(",\n    ")},\n)`;
}

function operatorKeywordItems(monaco: Monaco, context: CallContext, catalog: DslCatalog, target: CompletionTarget): CompletionItem[] {
  const parameters = uniqueParameters(context.candidates).filter((parameter) => parameter.role !== "name" && !context.usedKeywords.has(parameter.name));
  return parameters.map((parameter) => ({
    label: `${parameter.name}=`,
    detail: `${parameter.required ? "必填" : "可选"} · ${parameter.role === "field" ? "输入字段" : parameter.role === "on" ? "BOOL 条件" : "算符参数"} · ${schemaTypeLabel(parameter.schema, context.candidates[0]?.definition ?? {})}`,
    documentation: { value: parameterDocumentation(parameter) },
    insertText: `${parameter.name}=\${1:${escapeSnippet(parameterDefault(parameter, catalog))}}`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    kind: monaco.languages.CompletionItemKind.Field,
    range: target.range,
    sortText: `${parameter.required ? "0" : "1"}-${parameter.name}`
  }));
}

function callValueItems(monaco: Monaco, model: TextModel, position: Position, context: CallContext, catalog: DslCatalog, symbols: PythonSymbol[], target: CompletionTarget): CompletionItem[] {
  const selected = context.candidates[bestCandidateIndex(context)];
  if (!selected) return [];
  const parameter = activeCallParameter(context, selected);
  if (!parameter) return [];
  const items: CompletionItem[] = [];
  if (parameter.role === "name") {
    const name = assignmentName(model.getLineContent(position.lineNumber).slice(0, position.column - 1)) ?? "factor_name";
    items.push(pythonValueItem(monaco, name, "输出名称", "有名称的 OP 可以被其它算符引用", target, "0"));
  }
  if (parameter.role === "field" || parameter.role === "on") {
    items.push(...operandValueItems(monaco, parameter, selected, catalog, symbols, target));
  }
  items.push(...schemaValueItems(monaco, parameter.schema, selected.definition, target));
  return uniqueItems(items);
}

function activeCallParameter(context: CallContext, operator: DslOperator) {
  const parameters = operatorParameters(operator);
  if (context.currentKeyword) return parameters.find((candidate) => candidate.name === context.currentKeyword);
  return parameters
    .filter((candidate) => candidate.role === "name" || candidate.role === "field")
    .slice(context.positionalIndex)
    .find((candidate) => !context.usedKeywords.has(candidate.name));
}

function operandValueItems(monaco: Monaco, parameter: PythonParameter, operator: DslOperator, catalog: DslCatalog, symbols: PythonSymbol[], target: CompletionTarget) {
  const boolOnly = parameter.role === "on" || expectedOutputKind(operator.definition, parameter.schema) === "BOOL";
  const items = symbols
    .filter((symbol) => validOperandSymbol(symbol, boolOnly))
    .map((symbol) => identifierItem(monaco, symbol.name, symbol.kind === "operation" ? `${symbol.outputKind} OP` : "Python 变量", target, "0"));
  items.push(...catalog.factors.map((factor) => pythonValueItem(monaco, factor, boolOnly ? "数据字段 · 需要 BOOL" : "数据字段", "Runtime 可查询字段", target, "1")));
  items.push(...namespaces.map((namespace) => namespaceItem(monaco, namespace, target, "3")));
  return items;
}

function validOperandSymbol(symbol: PythonSymbol, boolOnly: boolean) {
  if (symbol.kind === "function" || symbol.kind === "operation-list") return false;
  return !boolOnly || symbol.kind !== "operation" || symbol.outputKind === "BOOL";
}

function resultListItems(monaco: Monaco, result: typeof resultVariables[number], catalog: DslCatalog, symbols: PythonSymbol[], target: CompletionTarget): CompletionItem[] {
  if (result === "FACTORS") {
    return catalog.factors.map((factor) => pythonValueItem(monaco, factor, "数据字段", "加入 FACTORS", target, "0"));
  }
  const operations = symbols.filter((symbol) => symbol.kind === "operation" || symbol.kind === "operation-list");
  return operations
    .filter((symbol) => result !== "FILTERS" || symbol.outputKind === "BOOL")
    .map((symbol) => ({
      label: symbol.kind === "operation-list" ? `*${symbol.name}` : symbol.name,
      detail: symbol.kind === "operation-list" ? `${symbol.outputKind} OP 列表` : `${symbol.outputKind} OP`,
      documentation: result === "FILTERS" ? "仅返回 BOOL 的算符可以加入 FILTERS" : "加入 DERIVATIVES",
      insertText: symbol.kind === "operation-list" ? `*${symbol.name}` : symbol.name,
      kind: symbol.kind === "operation-list" ? monaco.languages.CompletionItemKind.Variable : monaco.languages.CompletionItemKind.Reference,
      range: target.range,
      sortText: `${symbol.kind === "operation" ? "0" : "1"}-${symbol.name}`
    }));
}

function topLevelItems(monaco: Monaco, source: string, symbols: PythonSymbol[], catalog: DslCatalog, target: CompletionTarget): CompletionItem[] {
  const items: CompletionItem[] = [];
  const missing = resultVariables.filter((name) => !new RegExp(`^\\s*${name}\\b[^=\\n]*=`, "m").test(source));
  if (missing.length === resultVariables.length) {
    const factor = catalog.factors.includes("close") ? "close" : catalog.factors[0] ?? "field";
    items.push({
      label: "DSL 完整声明",
      detail: "创建 FACTORS、DERIVATIVES、FILTERS",
      documentation: "Python DSL 必须定义这三个结果变量。",
      insertText: `FACTORS = ["\${1:${escapeSnippet(factor)}}"]\nDERIVATIVES = [\${2}]\nFILTERS = [\${3}]`,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      kind: monaco.languages.CompletionItemKind.Snippet,
      range: target.range,
      sortText: "0-template"
    });
  }
  for (const name of missing) {
    items.push({
      label: name,
      detail: resultVariableDescription(name),
      insertText: `${name} = [\${1}]`,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      kind: monaco.languages.CompletionItemKind.Constant,
      range: target.range,
      sortText: `0-${name}`
    });
  }
  for (const namespace of namespaces) items.push(namespaceItem(monaco, namespace, target, "1"));
  for (const symbol of symbols) {
    items.push(identifierItem(monaco, symbol.name, symbolDetail(symbol), target, "2", symbol.signature));
  }
  items.push({
    label: "def",
    detail: "DSL 辅助函数",
    documentation: "Backend 支持无装饰器、无默认值且函数体只有一个 return 的辅助函数。",
    insertText: "def ${1:build_factor}(${2:name}, ${3:col}):\n    return ${4:TS.unary.rolling_mean(name, col=col, window=20)}",
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    kind: monaco.languages.CompletionItemKind.Snippet,
    range: target.range,
    sortText: "3-def"
  });
  for (const builtin of ["range", "zip"]) {
    items.push({ label: builtin, detail: "允许的安全内置函数", insertText: builtin, kind: monaco.languages.CompletionItemKind.Function, range: target.range, sortText: `4-${builtin}` });
  }
  for (const keyword of ["True", "False", "None", "return", "for", "in", "if", "list", "str", "int", "float", "bool", "OP"]) {
    items.push({ label: keyword, detail: "Python DSL 关键字", insertText: keyword, kind: monaco.languages.CompletionItemKind.Keyword, range: target.range, sortText: `5-${keyword}` });
  }
  return uniqueItems(items);
}

function pythonHover(model: TextModel, position: Position, catalog: DslCatalog) {
  const source = model.getValue();
  const offset = model.getOffsetAt(position);
  const lexical = lexPython(source);
  const operator = operatorReferenceAt(lexical.masked, offset, catalog);
  if (operator) {
    return {
      range: rangeFromOffsets(model, operator.start, operator.end),
      contents: operator.candidates.map((candidate) => ({ value: operatorDocumentation(candidate, operator.namespace, operator.category, operator.alias) }))
    };
  }
  const word = model.getWordAtPosition(position);
  if (!word) return null;
  const name = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: word.startColumn, endLineNumber: position.lineNumber, endColumn: word.endColumn });
  if ((resultVariables as readonly string[]).includes(name)) {
    return {
      range: rangeFromLineWord(position.lineNumber, word.startColumn, word.endColumn),
      contents: [{ value: `**${name}**\n\n${resultVariableDescription(name as typeof resultVariables[number])}` }]
    };
  }
  const context = callContextFromLexical(source, lexical, model.getOffsetAt({ lineNumber: position.lineNumber, column: word.endColumn }), catalog);
  if (context) {
    const parameters = uniqueParameters(context.candidates);
    const parameter = parameters.find((candidate) => candidate.name === name);
    if (parameter) {
      return {
        range: rangeFromLineWord(position.lineNumber, word.startColumn, word.endColumn),
        contents: [{ value: `**${name}** · ${parameter.role === "field" ? "输入字段" : parameter.role === "on" ? "BOOL 条件" : "算符参数"}\n\n${parameterDocumentation(parameter)}` }]
      };
    }
  }
  const symbol = collectSymbols(lexical.masked.slice(0, offset + 1), catalog).find((candidate) => candidate.name === name);
  if (!symbol) return null;
  return {
    range: rangeFromLineWord(position.lineNumber, word.startColumn, word.endColumn),
    contents: [{ value: `**${symbol.name}** · ${symbolDetail(symbol)}${symbol.operator ? `\n\n${symbol.operator.description}` : ""}${symbol.signature ? `\n\n\`${symbol.signature}\`` : ""}` }]
  };
}

function operatorSignature(operator: DslOperator, namespace: OperatorType, category: string, alias: string) {
  const parameters = operatorParameters(operator);
  const labels = parameters.map((parameter) => parameterSignature(parameter, operator.definition));
  return {
    label: `${namespace}.${category}.${alias}(${labels.join(", ")}) -> OP[${operator.output_kind}]`,
    documentation: { value: `${operator.description}\n\n底层算符：\`${operator.op}\`` },
    parameters: parameters.map((parameter) => ({
      label: parameterSignature(parameter, operator.definition),
      documentation: parameterDocumentation(parameter)
    }))
  };
}

function operatorParameters(operator: DslOperator): PythonParameter[] {
  const fields = objectSchema(operator, "fields");
  const params = objectSchema(operator, "params");
  const result: PythonParameter[] = [{ name: "name", role: "name", schema: { anyOf: [{ type: "string" }, { type: "null" }] }, required: false }];
  for (const [name, schema] of Object.entries(fields.properties ?? {})) {
    result.push({ name, role: "field", schema, required: fields.required?.includes(name) ?? false });
  }
  for (const [name, schema] of Object.entries(params.properties ?? {})) {
    result.push({ name, role: "parameter", schema, required: params.required?.includes(name) ?? false });
  }
  const on = operator.definition.properties?.on;
  if (on) result.push({ name: "on", role: "on", schema: on, required: operator.definition.required?.includes("on") ?? false });
  return result;
}

function callContext(source: string, offset: number, catalog: DslCatalog) {
  return callContextFromLexical(source, lexPython(source), offset, catalog);
}

function callContextFromLexical(source: string, lexical: LexicalSource, offset: number, catalog: DslCatalog): CallContext | undefined {
  const open = enclosingOperatorCall(lexical.masked, offset);
  if (!open) return undefined;
  const candidates = operatorCandidates(open.namespace, open.category, open.alias, catalog);
  if (!candidates.length) return undefined;
  const argumentsStructure = lexical.masked.slice(open.open + 1, offset);
  const argumentsSource = source.slice(open.open + 1, offset);
  const segments = topLevelSegments(argumentsStructure, argumentsSource);
  const previous = segments.slice(0, -1);
  const currentSegment = segments.at(-1) ?? "";
  const usedKeywords = new Set(previous.flatMap((segment) => keywordName(segment) ? [keywordName(segment) as string] : []));
  const currentKeyword = keywordName(currentSegment);
  if (currentKeyword) usedKeywords.add(currentKeyword);
  const positionalIndex = previous.filter((segment) => segment.trim() && !keywordName(segment)).length;
  const typingKeyword = !currentKeyword && /^\s*[A-Za-z_]\w*\s*$/.test(currentSegment) || currentSegment.trim() === "";
  return { ...open, candidates, currentKeyword, positionalIndex, typingKeyword, usedKeywords };
}

function enclosingOperatorCall(masked: string, offset: number): { alias: string; category: string; namespace: OperatorType; open: number } | undefined {
  const stack: Array<{ char: string; index: number }> = [];
  const matching: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (let index = 0; index < offset; index += 1) {
    const char = masked[index];
    if (char === "(" || char === "[" || char === "{") stack.push({ char, index });
    else if (matching[char] && stack.at(-1)?.char === matching[char]) stack.pop();
  }
  for (const entry of [...stack].reverse()) {
    if (entry.char !== "(") continue;
    const prefix = masked.slice(Math.max(0, entry.index - 160), entry.index);
    const match = /\b(DIRECT|TS|CS)\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*$/.exec(prefix);
    if (match) return { namespace: match[1] as OperatorType, category: match[2], alias: match[3], open: entry.index };
  }
  return undefined;
}

function topLevelSegments(structure: string, source = structure) {
  const segments: string[] = [];
  let start = 0;
  const stack: string[] = [];
  const matching: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (let index = 0; index < structure.length; index += 1) {
    const char = structure[index];
    if (char === "(" || char === "[" || char === "{") stack.push(char);
    else if (matching[char] && stack.at(-1) === matching[char]) stack.pop();
    else if (char === "," && stack.length === 0) {
      segments.push(source.slice(start, index));
      start = index + 1;
    }
  }
  segments.push(source.slice(start));
  return segments;
}

function keywordName(segment: string) {
  return /^\s*([A-Za-z_]\w*)\s*=/.exec(segment)?.[1];
}

function bestCandidateIndex(context: CallContext) {
  const index = context.candidates.findIndex((operator) => {
    const names = new Set(operatorParameters(operator).map((parameter) => parameter.name));
    return [...context.usedKeywords].every((name) => names.has(name));
  });
  return Math.max(0, index);
}

function activeParameterIndex(context: CallContext, parameters: PythonParameter[]) {
  if (context.currentKeyword) {
    const index = parameters.findIndex((parameter) => parameter.name === context.currentKeyword);
    if (index >= 0) return index;
  }
  const parameter = parameters
    .filter((candidate) => candidate.role === "name" || candidate.role === "field")
    .slice(context.positionalIndex)
    .find((candidate) => !context.usedKeywords.has(candidate.name));
  const index = parameter ? parameters.findIndex((candidate) => candidate.name === parameter.name) : parameters.length - 1;
  return Math.max(0, index);
}

function collectSymbols(masked: string, catalog: DslCatalog): PythonSymbol[] {
  const symbols = new Map<string, PythonSymbol>();
  const assignmentPattern = /^([A-Za-z_]\w*)\s*(?::[^=\n]+)?=\s*/gm;
  for (const match of masked.matchAll(assignmentPattern)) {
    if ((resultVariables as readonly string[]).includes(match[1]) || namespaces.includes(match[1] as OperatorType)) continue;
    symbols.set(match[1], { name: match[1], kind: "variable", outputKind: "ANY" });
  }
  const operationPattern = /^([A-Za-z_]\w*)\s*(?::[^=\n]+)?=\s*(DIRECT|TS|CS)\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(/gm;
  for (const match of masked.matchAll(operationPattern)) {
    const candidates = operatorCandidates(match[2] as OperatorType, match[3], match[4], catalog);
    const outputKind = commonOutputKind(candidates);
    symbols.set(match[1], { name: match[1], kind: "operation", outputKind, operator: candidates[0] });
  }
  const functionPattern = /^def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/gm;
  for (const match of masked.matchAll(functionPattern)) {
    const parameters = match[2].split(",").map((name) => name.trim()).filter(Boolean);
    const returned = helperReturnOperator(masked, match, catalog);
    symbols.set(match[1], { name: match[1], kind: "function", outputKind: returned?.output_kind ?? "ANY", operator: returned, signature: `${match[1]}(${parameters.join(", ")})` });
    for (const parameter of parameters) {
      if (/^[A-Za-z_]\w*$/.test(parameter) && !symbols.has(parameter)) symbols.set(parameter, { name: parameter, kind: "variable", outputKind: "ANY" });
    }
  }
  const helperCallPattern = /^([A-Za-z_]\w*)\s*(?::[^=\n]+)?=\s*([A-Za-z_]\w*)\s*\(/gm;
  for (const match of masked.matchAll(helperCallPattern)) {
    const helper = symbols.get(match[2]);
    if (helper?.kind === "function") symbols.set(match[1], { name: match[1], kind: "operation", outputKind: helper.outputKind, operator: helper.operator });
  }
  collectOperationLists(masked, catalog, symbols);
  for (const match of masked.matchAll(/\bfor\s+([A-Za-z_]\w*)\s+in\b/g)) {
    if (!symbols.has(match[1])) symbols.set(match[1], { name: match[1], kind: "variable", outputKind: "ANY" });
  }
  return [...symbols.values()];
}

function helperReturnOperator(masked: string, match: RegExpMatchArray, catalog: DslCatalog) {
  const start = (match.index ?? 0) + match[0].length;
  const remainder = masked.slice(start);
  const nextTopLevel = /\n(?=\S)/.exec(remainder)?.index ?? remainder.length;
  const returned = /\breturn\s+(DIRECT|TS|CS)\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(/.exec(remainder.slice(0, nextTopLevel));
  return returned ? operatorCandidates(returned[1] as OperatorType, returned[2], returned[3], catalog)[0] : undefined;
}

function collectOperationLists(masked: string, catalog: DslCatalog, symbols: Map<string, PythonSymbol>) {
  const listPattern = /^([A-Za-z_]\w*)\s*(?::[^=\n]+)?=\s*\[/gm;
  for (const match of masked.matchAll(listPattern)) {
    const open = (match.index ?? 0) + match[0].lastIndexOf("[");
    const close = matchingDelimiter(masked, open, "[", "]");
    const body = masked.slice(open + 1, close < 0 ? masked.length : close);
    const calls = [...body.matchAll(/\b(DIRECT|TS|CS)\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(/g)].flatMap((call) => operatorCandidates(call[1] as OperatorType, call[2], call[3], catalog));
    const referenced = [...body.matchAll(/\b([A-Za-z_]\w*)\b/g)]
      .map((reference) => symbols.get(reference[1]))
      .filter((symbol): symbol is PythonSymbol => symbol?.kind === "operation" || symbol?.kind === "function");
    const kinds = [...calls.map((operator) => operator.output_kind), ...referenced.map((symbol) => symbol.outputKind)];
    if (kinds.length) symbols.set(match[1], { name: match[1], kind: "operation-list", outputKind: commonKinds(kinds), operator: calls[0] ?? referenced[0]?.operator });
  }
}

function enclosingResultList(masked: string, offset: number): typeof resultVariables[number] | undefined {
  const stack: Array<{ char: string; index: number }> = [];
  const matching: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (let index = 0; index < offset; index += 1) {
    const char = masked[index];
    if (char === "(" || char === "[" || char === "{") stack.push({ char, index });
    else if (matching[char] && stack.at(-1)?.char === matching[char]) stack.pop();
  }
  const open = stack.at(-1);
  if (open?.char !== "[") return undefined;
  const prefix = masked.slice(Math.max(0, open.index - 160), open.index);
  const match = /\b(FACTORS|DERIVATIVES|FILTERS)\s*(?::[^=\n]+)?=\s*$/.exec(prefix);
  return match?.[1] as typeof resultVariables[number] | undefined;
}

function operatorReferenceAt(masked: string, offset: number, catalog: DslCatalog) {
  const pattern = /\b(DIRECT|TS|CS)\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g;
  for (const match of masked.matchAll(pattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (offset < start || offset > end) continue;
    return {
      start,
      end,
      namespace: match[1] as OperatorType,
      category: match[2],
      alias: match[3],
      candidates: operatorCandidates(match[1] as OperatorType, match[2], match[3], catalog)
    };
  }
  return undefined;
}

function operatorCandidates(namespace: OperatorType, category: string, alias: string, catalog: DslCatalog) {
  const keyword = alias.endsWith("_") ? alias.slice(0, -1) : "";
  const normalized = keyword && pythonKeywords.has(keyword) ? keyword : alias;
  return catalog.operators.filter(
    (operator) => operator.type === namespace && operator.op === `${category}.${normalized}`
  );
}

function shortAlias(operation: string) {
  const alias = operation.split(".").at(-1) ?? operation;
  return pythonKeywords.has(alias) ? `${alias}_` : alias;
}

function commonOutputKind(operators: DslOperator[]): OutputKind {
  return commonKinds(operators.map((operator) => operator.output_kind));
}

function commonKinds(values: OutputKind[]): OutputKind {
  const kinds = new Set(values);
  return kinds.size === 1 ? values[0] ?? "ANY" : "ANY";
}

function uniqueParameters(operators: DslOperator[]) {
  const parameters = new Map<string, PythonParameter>();
  for (const operator of operators) {
    for (const parameter of operatorParameters(operator)) {
      const current = parameters.get(parameter.name);
      parameters.set(parameter.name, current ? { ...current, required: current.required && parameter.required } : parameter);
    }
  }
  return [...parameters.values()];
}

function objectSchema(operator: DslOperator, key: "fields" | "params") {
  return resolveSchema(operator.definition, operator.definition.properties?.[key]);
}

function resolveSchema(root: JsonSchema, schema: JsonSchema | undefined): JsonSchema {
  if (!schema?.$ref?.startsWith("#/$defs/")) return schema ?? {};
  return root.$defs?.[schema.$ref.slice("#/$defs/".length)] ?? schema;
}

function schemaVariants(root: JsonSchema, schema: JsonSchema) {
  const resolved = resolveSchema(root, schema);
  return resolved.anyOf?.map((variant) => resolveSchema(root, variant)) ?? [resolved];
}

function schemaTypes(root: JsonSchema, schema: JsonSchema) {
  return [...new Set(schemaVariants(root, schema).flatMap((variant) => Array.isArray(variant.type) ? variant.type : variant.type ? [variant.type] : variant.title === "Derivative" ? ["OP"] : []))];
}

function schemaTypeLabel(schema: JsonSchema, root: JsonSchema) {
  const labels: Record<string, string> = { string: "str", integer: "int", number: "float", boolean: "bool", array: "list", object: "dict", null: "None", OP: "OP" };
  const types = schemaTypes(root, schema).map((type) => labels[type] ?? type);
  if (allowsDerivative(root, schema) && !types.includes("OP")) types.push("OP");
  return types.join(" | ") || "Any";
}

function allowsDerivative(root: JsonSchema, schema: JsonSchema) {
  const variants = resolveSchema(root, schema).anyOf ?? [schema];
  return variants.some((variant) => variant.$ref === "#/$defs/Derivative" || resolveSchema(root, variant).title === "Derivative" || variant.description?.includes("DSL"));
}

function expectedOutputKind(root: JsonSchema, schema: JsonSchema): OutputKind {
  const description = [schema, ...schemaVariants(root, schema)].map((item) => `${item.title ?? ""} ${item.description ?? ""}`).join(" ").toUpperCase();
  return description.includes("BOOL") ? "BOOL" : "ANY";
}

function schemaDefault(schema: JsonSchema) {
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;
  return schema.enum?.[0];
}

function parameterDefault(parameter: PythonParameter, catalog?: DslCatalog) {
  const defined = schemaDefault(parameter.schema);
  if (defined !== undefined) return pythonLiteral(defined);
  const root = parameter.schema;
  const types = schemaTypes(root, parameter.schema);
  if (parameter.role === "field") return JSON.stringify(catalog?.factors.includes("close") ? "close" : catalog?.factors[0] ?? "close");
  if (types.includes("boolean")) return "False";
  if (types.includes("integer") || types.includes("number")) return String(parameter.schema.minimum ?? 1);
  if (types.includes("array")) return "[]";
  if (types.includes("object")) return "{}";
  if (types.includes("null")) return "None";
  return JSON.stringify(parameter.name);
}

function schemaValueItems(monaco: Monaco, schema: JsonSchema, root: JsonSchema, target: CompletionTarget): CompletionItem[] {
  const variants = schemaVariants(root, schema);
  const values = [
    ...variants.flatMap((variant) => variant.enum ?? (variant.const === undefined ? [] : [variant.const])),
    ...variants.flatMap((variant) => variant.default === undefined ? [] : [variant.default])
  ];
  const types = new Set(schemaTypes(root, schema));
  if (types.has("boolean")) values.push(true, false);
  if (types.has("null")) values.push(null);
  if (!values.length && (types.has("integer") || types.has("number"))) values.push(schema.minimum ?? 1);
  return [...new Map(values.map((value) => [pythonLiteral(value), value])).values()].map((value) => ({
    label: pythonLiteral(value),
    detail: "允许值",
    documentation: schema.description,
    insertText: target.insideString && typeof value === "string" ? value : pythonLiteral(value),
    kind: monaco.languages.CompletionItemKind.Value,
    range: target.range,
    sortText: `2-${pythonLiteral(value)}`
  }));
}

function parameterSignature(parameter: PythonParameter, root: JsonSchema) {
  const type = schemaTypeLabel(parameter.schema, root);
  if (parameter.role === "name") return "name: str | None = None";
  const value = schemaDefault(parameter.schema);
  return `${parameter.name}: ${type}${parameter.required && value === undefined ? "" : ` = ${pythonLiteral(value ?? null)}`}`;
}

function parameterDocumentation(parameter: PythonParameter) {
  const constraints = [
    parameter.schema.minimum === undefined ? "" : `最小值：${parameter.schema.minimum}`,
    parameter.schema.maximum === undefined ? "" : `最大值：${parameter.schema.maximum}`,
    parameter.schema.default === undefined ? "" : `默认值：${pythonLiteral(parameter.schema.default)}`
  ].filter(Boolean).join("；");
  return [parameter.schema.description, constraints, parameter.required ? "必填" : "可选"].filter(Boolean).join("\n\n");
}

function operatorDocumentation(operator: DslOperator, namespace: OperatorType, category: string, alias: string) {
  const signature = operatorSignature(operator, namespace, category, alias).label;
  const parameters = operatorParameters(operator).slice(1).map((parameter) => `- \`${parameter.name}\`：${parameterDocumentation(parameter).replace(/\n+/g, "；")}`).join("\n");
  return `**${namespace}.${category}.${alias}** · ${operator.output_kind}\n\n\`${signature}\`\n\n${operator.description}\n\n底层算符：\`${operator.op}\`${parameters ? `\n\n${parameters}` : ""}`;
}

function resultVariableDescription(name: typeof resultVariables[number]) {
  if (name === "FACTORS") return "原始数据字段列表，类型必须为 list[str]。";
  if (name === "DERIVATIVES") return "需要输出的命名 OP 列表；被引用的依赖会自动加入 JSON。";
  return "过滤条件的命名 BOOL OP 列表。";
}

function symbolDetail(symbol: PythonSymbol) {
  if (symbol.kind === "operation") return `${symbol.outputKind} OP`;
  if (symbol.kind === "operation-list") return `${symbol.outputKind} OP 列表`;
  if (symbol.kind === "function") return "DSL 辅助函数";
  return "Python 变量";
}

function namespaceItem(monaco: Monaco, namespace: OperatorType, target: CompletionTarget, sortPrefix: string): CompletionItem {
  return {
    label: namespace,
    detail: namespace === "DIRECT" ? "直接计算算符" : namespace === "TS" ? "时序算符" : "截面算符",
    documentation: `输入 ${namespace}. 后先选择算子类别，再查看该类别下的算子。`,
    insertText: `${namespace}.`,
    command: { id: "editor.action.triggerSuggest", title: "显示 DSL 算符" },
    kind: monaco.languages.CompletionItemKind.Module,
    range: target.range,
    sortText: `${sortPrefix}-${namespace}`
  };
}

function identifierItem(monaco: Monaco, name: string, detail: string, target: CompletionTarget, sortPrefix: string, signature?: string): CompletionItem {
  return {
    label: name,
    detail,
    documentation: signature,
    insertText: name,
    kind: detail.includes("函数") ? monaco.languages.CompletionItemKind.Function : monaco.languages.CompletionItemKind.Variable,
    range: target.range,
    sortText: `${sortPrefix}-${name}`
  };
}

function pythonValueItem(monaco: Monaco, value: string, detail: string, documentation: string, target: CompletionTarget, sortPrefix: string): CompletionItem {
  return {
    label: value,
    detail,
    documentation,
    insertText: target.insideString ? value : JSON.stringify(value),
    kind: monaco.languages.CompletionItemKind.Value,
    range: target.range,
    sortText: `${sortPrefix}-${value}`
  };
}

function completionTarget(monaco: Monaco, model: TextModel, position: Position, lexical: LexicalSource, offset: number): CompletionTarget {
  const string = lexical.strings.find((candidate) => offset >= candidate.contentStart && offset <= candidate.contentEnd);
  if (string) {
    const content = model.getValue().slice(string.contentStart, offset);
    const partial = /[A-Za-z0-9_.]*$/.exec(content)?.[0] ?? "";
    return { insideString: true, range: rangeFromOffsets(model, offset - partial.length, offset) };
  }
  const word = model.getWordUntilPosition(position);
  return { insideString: false, range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn) };
}

function lexPython(source: string): LexicalSource {
  const masked = source.split("");
  const strings: LexicalSource["strings"] = [];
  const comments: LexicalSource["comments"] = [];
  let index = 0;
  while (index < source.length) {
    if (source[index] === "#") {
      const comment = maskComment(source, masked, index);
      comments.push({ start: index, end: comment });
      index = comment;
      continue;
    }
    if (source[index] !== "\"" && source[index] !== "'") {
      index += 1;
      continue;
    }
    const string = maskString(source, masked, index);
    strings.push(string);
    index = string.end;
  }
  return { comments, masked: masked.join(""), strings };
}

function maskComment(source: string, masked: string[], start: number) {
  let end = start;
  while (end < source.length && source[end] !== "\n") masked[end++] = " ";
  return end;
}

function maskString(source: string, masked: string[], start: number) {
  const quote = source[start];
  const width = source.slice(start, start + 3) === quote.repeat(3) ? 3 : 1;
  let end = start + width;
  const contentStart = end;
  let closed = false;
  while (end < source.length) {
    if (source[end] === "\\") {
      masked[end++] = " ";
      if (end < source.length) masked[end++] = source[end - 1] === "\n" ? "\n" : " ";
      continue;
    }
    if (source.slice(end, end + width) === quote.repeat(width)) {
      closed = true;
      break;
    }
    if (width === 1 && source[end] === "\n") break;
    masked[end] = source[end] === "\n" ? "\n" : " ";
    end += 1;
  }
  const contentEnd = end;
  if (closed) end += width;
  for (let cursor = start; cursor < end; cursor += 1) if (masked[cursor] !== "\n") masked[cursor] = " ";
  return { start, end, contentStart, contentEnd };
}

function matchingDelimiter(source: string, open: number, left: string, right: string) {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === left) depth += 1;
    else if (source[index] === right && --depth === 0) return index;
  }
  return -1;
}

function assignmentName(linePrefix: string) {
  return /\b([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(?:DIRECT|TS|CS)(?:\.[A-Za-z_]\w*)?\.[A-Za-z_]*$/.exec(linePrefix)?.[1]
    ?? /\b([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*$/.exec(linePrefix)?.[1];
}

function pythonLiteral(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.map(pythonLiteral).join(", ")}]`;
  return JSON.stringify(value);
}

function escapeSnippet(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\$/g, "\\$").replace(/}/g, "\\}");
}

function completionLabel(item: CompletionItem) {
  return typeof item.label === "string" ? item.label : item.label.label;
}

function uniqueItems(items: CompletionItem[]) {
  return [...new Map(items.map((item) => [`${completionLabel(item)}\u0000${item.insertText}`, item])).values()];
}

function rangeFromOffsets(model: TextModel, start: number, end: number) {
  const from = model.getPositionAt(start);
  const to = model.getPositionAt(end);
  return rangeFromLineWord(from.lineNumber, from.column, to.column, to.lineNumber);
}

function rangeFromLineWord(line: number, startColumn: number, endColumn: number, endLine = line) {
  return { startLineNumber: line, startColumn, endLineNumber: endLine, endColumn };
}
