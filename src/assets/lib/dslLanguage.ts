import type { Monaco } from "@monaco-editor/react";
import { findNodeAtLocation, getLocation, getNodeValue, parseTree, type Node } from "jsonc-parser";

import { jsonDefaults } from "@/assets/lib/monaco";
import type { DerivativeNode, DslCatalog, DslDocument, DslOperator, JsonSchema } from "@/types/factor";

type DslSymbol = { name: string; outputKind: DslOperator["output_kind"] };
type CompletionTarget = { range: import("monaco-editor").IRange; stringValue: boolean; property?: { range: import("monaco-editor").IRange; hasColon: boolean } };
type DerivativeContext = { path: (string | number)[]; operator?: DslOperator; expectedOutput: DslOperator["output_kind"] };

const rootSchema = {
  type: "object",
  additionalProperties: false,
  required: ["factors", "derivatives", "filters"],
  properties: {
    factors: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } },
    derivatives: { type: "object", additionalProperties: { type: "object", additionalProperties: false, required: ["type", "op", "fields", "params"], properties: { type: { enum: ["DIRECT", "TS", "CS"] }, op: { type: "string" }, fields: { type: "object" }, params: { type: "object" }, on: {} } } },
    filters: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } }
  }
};

export function configureDslLanguage() {
  jsonDefaults.setDiagnosticsOptions({ allowComments: false, enableSchemaRequest: false, schemas: [{ uri: "arena://factor-dsl-schema.json", fileMatch: ["factor-dsl://*"], schema: rootSchema }], validate: true });
}

export function registerDslLanguageProviders(monaco: Monaco, uri: string, catalog: DslCatalog) {
  return [
    monaco.languages.registerCompletionItemProvider({ language: "json", scheme: "factor-dsl" }, {
      triggerCharacters: [":", "\""],
      provideCompletionItems(model: import("monaco-editor").editor.ITextModel, position: import("monaco-editor").Position) {
        if (model.uri.toString() !== uri) return { suggestions: [] };
        return { suggestions: completions(monaco, model, position, catalog) };
      }
    }),
    monaco.languages.registerHoverProvider({ language: "json", scheme: "factor-dsl" }, {
      provideHover(model: import("monaco-editor").editor.ITextModel, position: import("monaco-editor").Position) {
        if (model.uri.toString() !== uri) return null;
        const contents = hoverContents(model.getValue(), model.getOffsetAt(position), catalog);
        return contents.length ? { contents: contents.map((text) => ({ value: text })) } : null;
      }
    })
  ];
}

function completions(monaco: Monaco, model: import("monaco-editor").editor.ITextModel, position: import("monaco-editor").Position, catalog: DslCatalog) {
  const source = model.getValue();
  const offset = model.getOffsetAt(position);
  const location = getLocation(source, offset);
  const tree = parseTree(source);
  const target = completionTarget(monaco, model, position, source, offset, location);
  const derivatives = derivativeSymbols(tree, catalog);

  if (location.isAtPropertyKey && location.path.length === 1) return rootPropertyItems(monaco, tree, target);
  const arrayItems = rootArrayItems(monaco, location.path, tree, catalog, derivatives, target);
  if (arrayItems) return arrayItems;
  return derivativeCompletions(monaco, location, tree, catalog, derivatives, target);
}

function derivativeCompletions(monaco: Monaco, location: ReturnType<typeof getLocation>, tree: Node | undefined, catalog: DslCatalog, derivatives: DslSymbol[], target: CompletionTarget) {
  if (location.path[0] !== "derivatives" || typeof location.path[1] !== "string") return [];
  if (location.path.length === 2 && !location.isAtPropertyKey) return operatorItems(monaco, catalog.operators, catalog, target, "ANY");
  const context = derivativeContext(location.path, tree, catalog);
  if (!context) return [];
  const relative = location.path.slice(context.path.length);
  const node = tree ? findNodeAtLocation(tree, context.path) : undefined;
  const current = node ? getNodeValue(node) as Partial<DerivativeNode> : {};
  if (location.isAtPropertyKey && relative.length === 1) return derivativePropertyItems(monaco, current, context.operator, target, catalog);
  const headerItems = derivativeHeaderItems(monaco, location.isAtPropertyKey, relative, current, context, catalog, target);
  if (headerItems) return headerItems;
  if (!context.operator) return [];
  return operatorArgumentItems(monaco, location.isAtPropertyKey, relative, tree, context, context.operator, catalog, derivatives, target);
}

function derivativeHeaderItems(monaco: Monaco, isAtPropertyKey: boolean, relative: (string | number)[], current: Partial<DerivativeNode>, context: DerivativeContext, catalog: DslCatalog, target: CompletionTarget) {
  if (isAtPropertyKey) return undefined;
  if (relative[0] === "type") {
    const types = context.operator ? [context.operator.type] : ["DIRECT", "TS", "CS"];
    return types.map((type) => stringItem(monaco, type, "算符类别", "", target));
  }
  if (relative[0] !== "op") return undefined;
  const operators = catalog.operators.filter((operator) => (!current.type || operator.type === current.type) && (context.expectedOutput === "ANY" || operator.output_kind === context.expectedOutput));
  return operators.map((operator) => operatorNameItem(monaco, operator, target));
}

function operatorArgumentItems(monaco: Monaco, isAtPropertyKey: boolean, relative: (string | number)[], tree: Node | undefined, context: DerivativeContext, operator: DslOperator, catalog: DslCatalog, derivatives: DslSymbol[], target: CompletionTarget) {
  if (isAtPropertyKey && (relative[0] === "fields" || relative[0] === "params") && relative.length === 2) {
    const schema = objectSchema(operator, relative[0]);
    const container = tree ? findNodeAtLocation(tree, [...context.path, relative[0]]) : undefined;
    return schemaPropertyItems(monaco, schema, container ? getNodeValue(container) as Record<string, unknown> : {}, operator.definition, catalog, target);
  }
  const schema = schemaAtPath(operator, relative);
  if (!schema) return [];
  if (relative[0] === "params") return schemaValueItems(monaco, schema, operator.definition, target, operator.op);
  if (relative[0] !== "fields" && relative[0] !== "on") return [];
  return operandItems(monaco, schema, operator.definition, catalog, derivatives, context.path[1] as string, target, expectedOutputKind(operator.definition, schema));
}

function rootArrayItems(monaco: Monaco, path: (string | number)[], tree: Node | undefined, catalog: DslCatalog, derivatives: DslSymbol[], target: CompletionTarget) {
  if (path[0] === "factors" && typeof path[1] === "number") {
    const used = new Set(arrayValue(tree, "factors"));
    return catalog.factors.filter((factor) => !used.has(factor)).map((factor) => stringItem(monaco, factor, "数据字段", "Runtime 可查询字段", target));
  }
  if (path[0] === "filters" && typeof path[1] === "number") {
    const used = new Set(arrayValue(tree, "filters"));
    return derivatives.filter((symbol) => symbol.outputKind === "BOOL" && !used.has(symbol.name)).map((symbol) => stringItem(monaco, symbol.name, "BOOL 派生字段", "仅返回 BOOL 的派生字段可以作为 filter", target));
  }
  return undefined;
}

function operandItems(monaco: Monaco, schema: JsonSchema, root: JsonSchema, catalog: DslCatalog, derivatives: DslSymbol[], currentName: string, target: CompletionTarget, expectedOutput: DslOperator["output_kind"]) {
  const items: import("monaco-editor").languages.CompletionItem[] = [];
  const boolOnly = expectedOutput === "BOOL";
  for (const symbol of derivatives) {
    if (symbol.name === currentName || boolOnly && symbol.outputKind !== "BOOL") continue;
    items.push(stringItem(monaco, symbol.name, `${symbol.outputKind} 派生字段`, "当前 DSL 中已经定义的派生字段", target, "0"));
  }
  for (const factor of catalog.factors) items.push(stringItem(monaco, factor, boolOnly ? "数据字段 · 需返回 BOOL" : "数据字段", "Runtime 可查询字段", target, "1"));
  items.push(...schemaValueItems(monaco, schema, root, target, "常量", "2"));
  if (!target.stringValue && allowsDerivative(root, schema)) items.push(...operatorItems(monaco, catalog.operators, catalog, target, expectedOutput, "3"));
  return uniqueItems(items);
}

function operatorItems(monaco: Monaco, operators: DslOperator[], catalog: DslCatalog, target: CompletionTarget, expectedOutput: DslOperator["output_kind"], sortPrefix = "0") {
  return operators.filter((operator) => expectedOutput === "ANY" || operator.output_kind === expectedOutput).map((operator) => ({
    label: operator.op,
    detail: operatorSummary(operator),
    documentation: operator.description,
    insertText: operatorSnippet(operator, catalog),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    kind: monaco.languages.CompletionItemKind.Snippet,
    range: target.range,
    sortText: `${sortPrefix}-${operator.type}-${operator.op}`
  }));
}

function operatorNameItem(monaco: Monaco, operator: DslOperator, target: CompletionTarget) {
  return { label: operator.op, detail: operatorSummary(operator), documentation: operator.description, insertText: target.stringValue ? operator.op : JSON.stringify(operator.op), kind: monaco.languages.CompletionItemKind.Function, range: target.range, sortText: `${operator.type}-${operator.op}` };
}

function rootPropertyItems(monaco: Monaco, tree: Node | undefined, target: CompletionTarget) {
  const root = tree ? getNodeValue(tree) as Record<string, unknown> : {};
  const definitions: Record<string, string> = { factors: "[\n    ${1}\n  ]", derivatives: "{\n    ${1}\n  }", filters: "[\n    ${1}\n  ]" };
  return Object.entries(definitions).filter(([name]) => !(name in root)).map(([name, value]) => propertyItem(monaco, name, value, name === "derivatives" ? "派生字段定义" : name === "factors" ? "原始字段" : "BOOL 过滤条件", target));
}

function derivativePropertyItems(monaco: Monaco, current: Partial<DerivativeNode>, operator: DslOperator | undefined, target: CompletionTarget, catalog: DslCatalog) {
  const definitions: Array<[string, string, string]> = [
    ["type", `\${1:${JSON.stringify(operator?.type ?? "DIRECT")}}`, "算符类别"],
    ["op", `\${1:${JSON.stringify(operator?.op ?? catalog.operators[0]?.op ?? "")}}`, "算符名称"],
    ["fields", "{\n    ${1}\n  }", "输入字段"],
    ["params", "{\n    ${1}\n  }", "算符参数"]
  ];
  if (operator?.definition.properties?.on) definitions.push(["on", "${1:null}", operator.definition.properties.on.description ?? "可选 BOOL 条件"]);
  return definitions.filter(([name]) => !(name in current)).map(([name, value, detail]) => propertyItem(monaco, name, value, detail, target));
}

function schemaPropertyItems(monaco: Monaco, schema: JsonSchema, current: Record<string, unknown>, root: JsonSchema, catalog: DslCatalog, target: CompletionTarget) {
  return Object.entries(schema.properties ?? {}).filter(([name]) => !(name in current)).map(([name, definition]) => propertyItem(
    monaco,
    name,
    valueSnippet(definition, root, catalog, 1),
    `${schema.required?.includes(name) ? "必填" : "可选"} · ${schemaDescription(definition)}`,
    target,
    definition.description
  ));
}

function schemaValueItems(monaco: Monaco, schema: JsonSchema, root: JsonSchema, target: CompletionTarget, detail: string, sortPrefix = "0") {
  const resolved = schemaVariants(root, schema);
  const values = [
    ...resolved.flatMap((item) => item.enum ?? (item.const === undefined ? [] : [item.const])),
    ...resolved.flatMap((item) => item.default === undefined ? [] : [item.default])
  ];
  if (resolved.some((item) => schemaTypes(item).includes("boolean"))) values.push(true, false);
  if (resolved.some((item) => schemaTypes(item).includes("null"))) values.push(null);
  if (!values.length && resolved.some((item) => schemaTypes(item).some((type) => type === "integer" || type === "number"))) values.push(1);
  return [...new Map(values.map((value) => [JSON.stringify(value), value])).values()].map((value) => ({
    label: value === null ? "null" : String(value),
    detail,
    documentation: schema.description,
    insertText: typeof value === "string" && target.stringValue ? value : JSON.stringify(value),
    kind: monaco.languages.CompletionItemKind.Value,
    range: target.range,
    sortText: `${sortPrefix}-${String(value)}`
  }));
}

function stringItem(monaco: Monaco, label: string, detail: string, documentation: string, target: CompletionTarget, sortPrefix = "0") {
  return { label, detail, documentation, insertText: target.stringValue ? label : JSON.stringify(label), kind: monaco.languages.CompletionItemKind.Value, range: target.range, sortText: `${sortPrefix}-${label}` };
}

function propertyItem(monaco: Monaco, name: string, value: string, detail: string, target: CompletionTarget, documentation = "") {
  const existing = target.property;
  const insertText = existing ? existing.hasColon ? name : `${name}": ${value}` : `"${name}": ${value}`;
  return { label: name, detail, documentation, insertText, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, kind: monaco.languages.CompletionItemKind.Property, range: existing && !existing.hasColon ? existing.range : target.range, sortText: name };
}

function completionTarget(monaco: Monaco, model: import("monaco-editor").editor.ITextModel, position: import("monaco-editor").Position, source: string, offset: number, location: ReturnType<typeof getLocation>): CompletionTarget {
  const previous = location.previousNode;
  if (previous && (previous.type === "string" || previous.type === "property") && offset >= previous.offset + 1 && offset <= previous.offset + previous.length) {
    const contentRange = rangeAt(model, previous.offset + 1, previous.offset + previous.length - 1);
    if (previous.type === "string") return { range: contentRange, stringValue: true };
    let cursor = previous.offset + previous.length;
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    return { range: contentRange, stringValue: false, property: { range: rangeAt(model, previous.offset + 1, previous.offset + previous.length), hasColon: source[cursor] === ":" } };
  }
  const word = model.getWordUntilPosition(position);
  return { range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn), stringValue: false };
}

function rangeAt(model: import("monaco-editor").editor.ITextModel, start: number, end: number) {
  const from = model.getPositionAt(start);
  const to = model.getPositionAt(end);
  return { startLineNumber: from.lineNumber, startColumn: from.column, endLineNumber: to.lineNumber, endColumn: to.column };
}

function derivativeContext(path: (string | number)[], tree: Node | undefined, catalog: DslCatalog): DerivativeContext | undefined {
  if (!tree || path[0] !== "derivatives" || typeof path[1] !== "string") return undefined;
  const contexts: DerivativeContext[] = [];
  for (let length = 2; length <= path.length; length += 1) {
    const candidatePath = path.slice(0, length);
    const node = findNodeAtLocation(tree, candidatePath);
    if (node?.type !== "object") continue;
    if (length === 2) {
      contexts.push(contextFromNode(candidatePath, node, catalog, "ANY"));
      continue;
    }
    const parent = contexts.at(-1);
    const schema = parent?.operator ? schemaAtPath(parent.operator, candidatePath.slice(parent.path.length)) : undefined;
    const value = getNodeValue(node) as Record<string, unknown>;
    if (schema && allowsDerivative(parent?.operator?.definition ?? {}, schema)) contexts.push(contextFromNode(candidatePath, node, catalog, expectedOutputKind(parent?.operator?.definition ?? {}, schema)));
    else if (typeof value?.op === "string") contexts.push(contextFromNode(candidatePath, node, catalog, "ANY"));
  }
  return contexts.at(-1);
}

function contextFromNode(path: (string | number)[], node: Node, catalog: DslCatalog, expectedOutput: DslOperator["output_kind"]): DerivativeContext {
  const value = getNodeValue(node) as Partial<DerivativeNode>;
  return { path, operator: catalog.operators.find((operator) => operator.op === value.op), expectedOutput };
}

function schemaAtPath(operator: DslOperator, relative: (string | number)[]) {
  if (!relative.length) return operator.definition;
  let schema = operator.definition.properties?.[String(relative[0])];
  for (const segment of relative.slice(1)) {
    if (!schema) return undefined;
    const variants = schemaVariants(operator.definition, schema);
    if (typeof segment === "number") {
      const arraySchema = variants.find((item) => item.items);
      schema = arraySchema?.items ? { ...arraySchema.items, description: arraySchema.items.description ?? arraySchema.description } : undefined;
    } else {
      schema = variants.find((item) => item.properties?.[String(segment)])?.properties?.[String(segment)];
    }
  }
  return schema;
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
  return resolved.anyOf?.map((item) => resolveSchema(root, item)) ?? [resolved];
}

function allowsDerivative(root: JsonSchema, schema: JsonSchema) {
  return schemaVariants(root, schema).some((item) => item.$ref === "#/$defs/Derivative" || item.title === "Derivative" || item.description?.includes("DSL"));
}

function expectedOutputKind(root: JsonSchema, schema: JsonSchema): DslOperator["output_kind"] {
  const text = [schema, ...schemaVariants(root, schema)].map(schemaDescription).join(" ").toUpperCase();
  return text.includes("BOOL") ? "BOOL" : "ANY";
}

function valueSnippet(schema: JsonSchema | undefined, root: JsonSchema, catalog: DslCatalog, placeholder: number): string {
  if (!schema) return `\${${placeholder}}`;
  const variants = schemaVariants(root, schema);
  const defined = schemaValue(schema) ?? variants.map(schemaValue).find((value) => value !== undefined);
  if (defined !== undefined) return `\${${placeholder}:${JSON.stringify(defined)}}`;
  const types = new Set(variants.flatMap(schemaTypes));
  return typedValueSnippet(types, catalog, placeholder);
}

function schemaValue(schema: JsonSchema) { return schema.default ?? schema.const ?? schema.enum?.[0]; }

function typedValueSnippet(types: Set<string>, catalog: DslCatalog, placeholder: number) {
  const factor = JSON.stringify(catalog.factors.includes("close") ? "close" : catalog.factors[0] ?? "field");
  if (types.has("string")) return `\${${placeholder}:${factor}}`;
  if (types.has("boolean") && types.size === 1) return `\${${placeholder}:false}`;
  if (types.has("integer") || types.has("number")) return `\${${placeholder}:1}`;
  if (types.has("array")) return `[\${${placeholder}:${factor}}]`;
  if (types.has("object")) return "{}";
  return `\${${placeholder}:${factor}}`;
}

function operatorSnippet(operator: DslOperator, catalog: DslCatalog) {
  let placeholder = 1;
  const object = (key: "fields" | "params") => {
    const schema = objectSchema(operator, key);
    const names = Object.keys(schema.properties ?? {}).filter((name) => schema.required?.includes(name) || schema.properties?.[name].default !== undefined);
    if (!names.length) return "{}";
    return `{\n    ${names.map((name) => `"${name}": ${valueSnippet(schema.properties?.[name], operator.definition, catalog, placeholder++)}`).join(",\n    ")}\n  }`;
  };
  return `{\n  "type": "${operator.type}",\n  "op": "${operator.op}",\n  "fields": ${object("fields")},\n  "params": ${object("params")}\n}`;
}

function operatorSummary(operator: DslOperator) {
  const fields = Object.keys(objectSchema(operator, "fields").properties ?? {}).join(", ") || "无字段";
  const params = Object.keys(objectSchema(operator, "params").properties ?? {}).join(", ") || "无参数";
  return `${operator.type} · ${operator.output_kind} · fields(${fields}) · params(${params})`;
}

function schemaDescription(schema: JsonSchema | undefined) {
  if (!schema) return "";
  const constraints = [schema.minimum === undefined ? "" : `≥ ${schema.minimum}`, schema.maximum === undefined ? "" : `≤ ${schema.maximum}`, schema.default === undefined ? "" : `默认 ${JSON.stringify(schema.default)}`].filter(Boolean).join(" · ");
  return [schema.title, schema.description, constraints].filter(Boolean).join(" · ");
}

function schemaTypes(schema: JsonSchema) { return Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []; }

function hoverContents(source: string, offset: number, catalog: DslCatalog) {
  const location = getLocation(source, offset);
  const tree = parseTree(source);
  const context = derivativeContext(location.path, tree, catalog);
  if (!context) return [];
  const relative = location.path.slice(context.path.length);
  if (relative[0] === "op" && context.operator) return [`**${context.operator.op}** · ${context.operator.type} · ${context.operator.output_kind}`, context.operator.description, `\`${operatorSummary(context.operator)}\``];
  if (!context.operator || !relative.length) return [];
  const schema = schemaAtPath(context.operator, relative);
  if (!schema) return [];
  return [`**${String(relative.at(-1))}** · ${schemaDescription(schema)}`];
}

function derivativeSymbols(tree: Node | undefined, catalog: DslCatalog): DslSymbol[] {
  if (!tree) return [];
  const node = findNodeAtLocation(tree, ["derivatives"]);
  const derivatives = node ? getNodeValue(node) as Record<string, Partial<DerivativeNode>> : {};
  return Object.entries(derivatives ?? {}).filter(([, value]) => value && typeof value === "object").map(([name, value]) => ({ name, outputKind: catalog.operators.find((operator) => operator.op === value.op)?.output_kind ?? "ANY" }));
}

function arrayValue(tree: Node | undefined, key: "factors" | "filters") {
  if (!tree) return [];
  const node = findNodeAtLocation(tree, [key]);
  const value = node ? getNodeValue(node) : [];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function uniqueItems(items: import("monaco-editor").languages.CompletionItem[]) {
  return [...new Map(items.map((item) => [`${item.label}-${item.insertText}`, item])).values()];
}

export function isDslDocument(value: unknown): value is DslDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  return Array.isArray(document.factors) && document.factors.every((item) => typeof item === "string") && Boolean(document.derivatives) && typeof document.derivatives === "object" && !Array.isArray(document.derivatives) && Array.isArray(document.filters) && document.filters.every((item) => typeof item === "string");
}
