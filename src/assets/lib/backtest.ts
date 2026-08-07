import { client } from "@/assets/lib/request";
import { isFactorQuery, type DslCatalog } from "@/types/factor";
import { callbackNames, callbackParameters, type BacktestOutput, type BacktestOutputName, type BacktestParameters, type BacktestProject, type BacktestProjectPage, type BacktestSummary, type BacktestVersion, type BacktestVersionListItem, type BacktestWorkflowSubmitted, type CallbackName } from "@/types/backtest";

export function validCallback(callback: CallbackName, source: string) {
  const match = new RegExp(`\\bdef\\s+${callback}\\s*\\(([^)]*)\\)\\s*\\{`).exec(source);
  if (!match) return false;

  const parameters = match[1].trim()
    ? match[1].split(",").map((parameter) => parameter.trim())
    : [];
  const expectedCount = callbackParameters[callback].split(",").length;
  if (parameters.length !== expectedCount) return false;

  const names: string[] = [];
  for (const parameter of parameters) {
    const parameterMatch = /^(?:(mutable)\s+)?([A-Za-z][A-Za-z0-9_]*)$/.exec(parameter);
    if (!parameterMatch) return false;
    names.push(parameterMatch[2]);
  }

  return parameters[0]?.startsWith("mutable ") === true
    && new Set(names).size === names.length;
}

export function validCallbacks(callbacks: Record<CallbackName, string>) {
  return callbackNames.every((callback) => validCallback(callback, callbacks[callback]));
}

export function utilsCompletions(source: string) {
  const mask = dolphinDbCodeMask(source);
  const functions = new Map<string, { detail: string; documentation: string; insertText: string; label: string }>();
  for (const match of mask.matchAll(/^[\t ]*def\s+([A-Za-z][A-Za-z0-9_]*)\s*\(/gm)) {
    const name = match[1];
    const start = match.index + match[0].lastIndexOf("(");
    const end = closingParenthesis(mask, start);
    if (end < 0) continue;
    const bodyStart = nextCodeCharacter(mask, end + 1);
    if (bodyStart < 0 || mask[bodyStart] !== "{") continue;
    const parameters = functionParameters(source, mask, start + 1, end);
    const signature = `${name}(${source.slice(start + 1, end).trim()})`;
    functions.set(name, { label: name, detail: signature, documentation: `工具函数\n\n\`\`\`dolphindb\n${signature}\n\`\`\``, insertText: `${name}(${parameters.map((parameter, index) => `\${${index + 1}:${parameter}}`).join(", ")})` });
  }
  return [...functions.values()];
}

function dolphinDbCodeMask(source: string) {
  const mask = source.split("");
  let quote = "";
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    if (lineComment) {
      if (source[index] === "\n") lineComment = false;
      else mask[index] = " ";
      continue;
    }
    if (blockComment) {
      if (source.startsWith("*/", index)) { mask[index] = mask[index + 1] = " "; index += 1; blockComment = false; }
      else if (source[index] !== "\n") mask[index] = " ";
      continue;
    }
    if (quote) {
      mask[index] = source[index] === "\n" ? "\n" : " ";
      if (source[index] === "\\") { if (index + 1 < source.length) mask[++index] = " "; }
      else if (source[index] === quote) quote = "";
      continue;
    }
    if (source.startsWith("//", index)) { mask[index] = mask[index + 1] = " "; index += 1; lineComment = true; }
    else if (source.startsWith("/*", index)) { mask[index] = mask[index + 1] = " "; index += 1; blockComment = true; }
    else if (source[index] === "\"" || source[index] === "'") { quote = source[index]; mask[index] = " "; }
  }
  return mask.join("");
}

function closingParenthesis(mask: string, start: number) {
  let depth = 0;
  for (let index = start; index < mask.length; index += 1) {
    if (mask[index] === "(") depth += 1;
    else if (mask[index] === ")" && --depth === 0) return index;
  }
  return -1;
}

function nextCodeCharacter(mask: string, start: number) {
  for (let index = start; index < mask.length; index += 1) if (/\S/.test(mask[index])) return index;
  return -1;
}

function functionParameters(source: string, mask: string, start: number, end: number) {
  const parameters: string[] = [];
  let parameterStart = start;
  let depth = 0;
  for (let index = start; index <= end; index += 1) {
    const character = mask[index];
    if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")" || character === "]" || character === "}") depth -= 1;
    if (character === "," && depth === 0 || index === end) {
      const parameterEnd = topLevelDefault(mask, parameterStart, index);
      const identifiers = source.slice(parameterStart, parameterEnd).match(/[A-Za-z][A-Za-z0-9_]*/g);
      if (identifiers?.length) parameters.push(identifiers.at(-1)!);
      parameterStart = index + 1;
    }
  }
  return parameters;
}

function topLevelDefault(mask: string, start: number, end: number) {
  let depth = 0;
  for (let index = start; index < end; index += 1) {
    const character = mask[index];
    if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")" || character === "]" || character === "}") depth -= 1;
    else if (character === "=" && depth === 0) return index;
  }
  return end;
}

export function validBacktestParameters(parameters: BacktestParameters) {
  return parameters.dataset_query.start_date.length > 0
    && parameters.dataset_query.end_date.length > 0
    && parameters.dataset_query.factors.length + Object.keys(parameters.dataset_query.derivatives).length > 0
    && (parameters.codes_query !== null || parameters.dataset_query.codes.length > 0)
    && validCallbacks(parameters.callbacks);
}

const BACKTEST_PARAMETER_NAMES = new Set([
  "config",
  "codes_query",
  "dataset_query",
  "adj",
  "annual_trading_days",
  "risk_free_rate",
  "utils",
  "callbacks"
]);

export function isBacktestParameters(value: unknown): value is BacktestParameters {
  if (!isRecord(value)) return false;
  if (!Object.keys(value).every((name) => BACKTEST_PARAMETER_NAMES.has(name))) return false;
  const callbacks = value.callbacks;
  if (!isRecord(callbacks)) return false;
  return [
    isRecord(value.config),
    value.codes_query === null || isFactorQuery(value.codes_query),
    isFactorQuery(value.dataset_query),
    value.adj === null || value.adj === "hfq" || value.adj === "qfq",
    typeof value.annual_trading_days === "number" && Number.isFinite(value.annual_trading_days),
    typeof value.risk_free_rate === "number" && Number.isFinite(value.risk_free_rate),
    typeof value.utils === "string",
    callbackNames.every((name) => typeof callbacks[name] === "string")
  ].every(Boolean);
}

export const backtestApi = {
  listProjects: (page = 1, pageSize = 20) => client.get<BacktestProjectPage>("/backtest/projects", { params: { page, page_size: pageSize } }),
  createProject: (title: string) => client.post<BacktestProject>("/backtest/projects", { title }),
  getProject: (projectId: number) => client.get<BacktestProject>(`/backtest/projects/${projectId}`),
  updateProject: (projectId: number, title: string) => client.patch<BacktestProject>(`/backtest/projects/${projectId}`, { title }),
  deleteProject: (projectId: number) => client.delete<{ id: number }>(`/backtest/projects/${projectId}`),
  run: (projectId: number, parameters: BacktestParameters) => client.post<BacktestWorkflowSubmitted>(`/backtest/projects/${projectId}/runs`, parameters, { timeout: 30000 }),
  listVersions: (projectId: number) => client.get<BacktestVersionListItem[]>(`/backtest/projects/${projectId}/versions`),
  getVersion: (projectId: number, version: number) => client.get<BacktestVersion>(`/backtest/projects/${projectId}/versions/${version}`),
  saveVersion: (projectId: number, workflowInstanceId: number, remark: string, summary: BacktestSummary) => client.post<BacktestVersion>(`/backtest/projects/${projectId}/versions`, { workflow_instance_id: workflowInstanceId, remark, summary }),
  catalog: () => client.get<DslCatalog>("/backtest/dsl/catalog", { timeout: 30000 }),
  outputs: (workflowInstanceId: number) => client.get<BacktestOutput[]>(`/backtest/workflows/${workflowInstanceId}/outputs`),
  output: (workflowInstanceId: number, name: BacktestOutputName) => client.getBinary(`/backtest/workflows/${workflowInstanceId}/outputs/${name}`)
};

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
