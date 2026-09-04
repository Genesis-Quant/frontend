import type { DerivativeNode, DslDocument, DslSource } from "@/types/factor";

const pythonKeywords = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "case", "class", "continue", "def", "del", "elif", "else", "except", "finally",
  "for", "from", "global", "if", "import", "in", "is", "lambda", "match",
  "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with",
  "yield"
]);

export function jsonDslSource(document: DslDocument): DslSource {
  return {
    language: "json",
    json_source: JSON.stringify(document, null, 2),
    python_source: dslToPython(document)
  };
}

export function dslSourceText(source: DslSource, language = source.language): string {
  return language === "python" ? source.python_source : source.json_source;
}

export function updateDslSourceText(source: DslSource, language: DslSource["language"], text: string): DslSource {
  return {
    ...source,
    language,
    [language === "python" ? "python_source" : "json_source"]: text
  };
}

export function dslToPython(document: DslDocument): string {
  const variables = new Map(Object.keys(document.derivatives).map((name, index) => [name, `_dsl_${index}`]));
  const entries = orderedDerivatives(document.derivatives);
  const declarations = entries.map(([name, node]) => `${variables.get(name)} = ${renderOperation(node, name, variables)}`);
  const filters = document.filters.map((name) => {
    const variable = variables.get(name);
    if (!variable) throw new Error(`过滤器 ${JSON.stringify(name)} 没有对应派生算符`);
    return variable;
  });
  return [
    ...declarations,
    `FACTORS = ${pythonLiteral(document.factors)}`,
    `FILTERS = [${filters.join(", ")}]`
  ].join("\n\n");
}

function renderOperation(node: DerivativeNode, name: string | null, variables: Map<string, string>): string {
  const [category, member] = node.op.split(".", 2);
  const pythonMember = pythonKeywords.has(member) ? `${member}_` : member;
  const operator = `${node.type}.${category}.${pythonMember}`;
  const argumentsList = name === null ? [] : [pythonLiteral(name)];
  for (const [field, value] of Object.entries(node.fields)) {
    argumentsList.push(`${field}=${renderValue(value, variables, true)}`);
  }
  for (const [parameter, value] of Object.entries(node.params)) {
    argumentsList.push(`${parameter}=${renderValue(value, variables, false)}`);
  }
  if (node.on !== undefined) argumentsList.push(`on=${renderValue(node.on, variables, true)}`);
  return `${operator}(${argumentsList.join(", ")})`;
}

function renderValue(value: unknown, variables: Map<string, string>, resolveReference: boolean): string {
  if (resolveReference && typeof value === "string" && variables.has(value)) return variables.get(value)!;
  if (isDerivativeNode(value)) return renderOperation(value, null, variables);
  if (Array.isArray(value)) return `[${value.map((item) => renderValue(item, variables, resolveReference)).join(", ")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value).map(([key, item]) => `${pythonLiteral(key)}: ${renderValue(item, variables, resolveReference)}`).join(", ")}}`;
  }
  return pythonLiteral(value);
}

function orderedDerivatives(derivatives: Record<string, DerivativeNode>): Array<[string, DerivativeNode]> {
  const names = new Set(Object.keys(derivatives));
  const states = new Map<string, "visiting" | "done">();
  const result: Array<[string, DerivativeNode]> = [];

  const visit = (name: string) => {
    if (states.get(name) === "done") return;
    if (states.get(name) === "visiting") throw new Error(`DSL 派生算符存在循环引用：${name}`);
    states.set(name, "visiting");
    for (const dependency of derivativeReferences(derivatives[name], names)) visit(dependency);
    states.set(name, "done");
    result.push([name, derivatives[name]]);
  };

  for (const name of names) visit(name);
  return result;
}

function derivativeReferences(node: DerivativeNode, names: Set<string>): Set<string> {
  const result = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "string") {
      if (names.has(value)) result.add(value);
    } else if (isDerivativeNode(value)) {
      Object.values(value.fields).forEach(collect);
      if (value.on !== undefined) collect(value.on);
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (isRecord(value)) {
      Object.values(value).forEach(collect);
    }
  };
  Object.values(node.fields).forEach(collect);
  if (node.on !== undefined) collect(node.on);
  return result;
}

function pythonLiteral(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(pythonLiteral).join(", ")}]`;
  if (isRecord(value)) return `{${Object.entries(value).map(([key, item]) => `${pythonLiteral(key)}: ${pythonLiteral(item)}`).join(", ")}}`;
  throw new Error("DSL 包含无法转换为 Python 的值");
}

function isDerivativeNode(value: unknown): value is DerivativeNode {
  return isRecord(value)
    && (value.type === "DIRECT" || value.type === "TS" || value.type === "CS")
    && typeof value.op === "string"
    && isRecord(value.fields)
    && isRecord(value.params);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
