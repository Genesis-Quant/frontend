import { Braces, FunctionSquare, Settings2, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import CodeEditor from "@/components/editor/CodeEditor";
import { NumberField, SelectField, SwitchField } from "@/components/field/FormFields";
import BacktestCodeModal, { type BacktestCodePanel } from "@/components/modal/BacktestCodeModal";
import { Button } from "@/ui/button";
import { setBacktestStockPoolType, type BacktestCatalog, type BacktestParameters, type StrategyParameters } from "@/types/backtest";
import { stockPools } from "@/types/factor";

export default function BacktestEditor({ catalog, editorScope, onChange, onValidityChange, parameters, projectId, readOnly = false }: { catalog: BacktestCatalog; editorScope: string; onChange: (parameters: BacktestParameters) => void; onValidityChange: (valid: boolean) => void; parameters: BacktestParameters; projectId: number; readOnly?: boolean }) {
  const [codePanel, setCodePanel] = useState<BacktestCodePanel | null>(null);
  const [codeValid, setCodeValid] = useState(true);
  const [strategyParametersValid, setStrategyParametersValid] = useState(true);
  const selectedBenchmark = optionalStringConfig(parameters, "benchmark") ?? "none";
  const benchmarkCodes = selectedBenchmark === "none" || catalog.benchmark_codes.includes(selectedBenchmark)
    ? catalog.benchmark_codes
    : [...catalog.benchmark_codes, selectedBenchmark];
  const benchmarkOptions = [
    { label: "不使用基准", value: "none" },
    ...benchmarkCodes.map((code) => ({
      label: stockPools.find((stockPool) => stockPool.value === code)?.label ?? code,
      value: code
    }))
  ];

  useEffect(() => onValidityChange(codeValid && strategyParametersValid), [codeValid, onValidityChange, strategyParametersValid]);

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3">
      <SelectField label="复权方式" value={parameters.adj ?? "none"} options={[{ label: "不复权", value: "none" }, { label: "后复权", value: "hfq" }, { label: "前复权", value: "qfq" }]} disabled={readOnly} onChange={(value) => onChange({ ...parameters, adj: value === "none" ? null : value as "hfq" | "qfq" })} />
      <NumberField label="初始资金" min={1} value={numberConfig(parameters, "cash")} disabled={readOnly} onChange={(cash) => onChange(updateConfig(parameters, "cash", cash))} />
      <NumberField label="年化交易日" min={1} value={parameters.annual_trading_days} disabled={readOnly} onChange={(annualTradingDays) => onChange({ ...parameters, annual_trading_days: annualTradingDays })} />
      <NumberField label="无风险利率" min={0} step={0.001} value={parameters.risk_free_rate} disabled={readOnly} onChange={(riskFreeRate) => onChange({ ...parameters, risk_free_rate: riskFreeRate })} />
      <NumberField label="手续费率" min={0} step={0.0001} value={numberConfig(parameters, "commission")} disabled={readOnly} onChange={(commission) => onChange(updateConfig(parameters, "commission", commission))} />
      <NumberField label="印花税率" min={0} step={0.0001} value={numberConfig(parameters, "tax")} disabled={readOnly} onChange={(tax) => onChange(updateConfig(parameters, "tax", tax))} />
      <SwitchField checked={booleanConfig(parameters, "enableMinimumPerTransactionFee")} checkedText="5元" disabled={readOnly} label="最低手续费" uncheckedText="无" onChange={(enabled) => onChange(updateConfig(parameters, "enableMinimumPerTransactionFee", enabled))} />
      <SwitchField checked={parameters.codes_query !== null} checkedText="动态" disabled={readOnly} label="股票池类型" uncheckedText="静态" onChange={(dynamic) => onChange(setBacktestStockPoolType(parameters, dynamic))} />
      <SelectField className="col-span-2 space-y-2" label="基准指数" value={selectedBenchmark} options={benchmarkOptions} disabled={readOnly} onChange={(benchmark) => onChange(benchmark === "none" ? removeConfig(parameters, "benchmark") : updateConfig(parameters, "benchmark", benchmark))} />
      <StrategyParameterField modelPath={`ini://backtest/${projectId}/${editorScope}/strategy-parameters.ini`} parameters={parameters.params} readOnly={readOnly} onChange={(params) => onChange({ ...parameters, params })} onValidityChange={setStrategyParametersValid} />
    </div>

    <div className="rounded-md border bg-muted/15 p-4">
      <div className="flex items-center gap-2"><Settings2 className="size-4" /><h3 className="text-sm font-medium">策略代码</h3></div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {parameters.codes_query !== null && <Button variant="outline" onClick={() => setCodePanel("codes")}><Braces />股票池查询</Button>}
        <Button variant="outline" onClick={() => setCodePanel("dataset")}><Braces />回测数据查询</Button>
        <Button variant="outline" onClick={() => setCodePanel("utils")}><Wrench />工具函数</Button>
        <Button variant="outline" onClick={() => setCodePanel("callbacks")}><FunctionSquare />回调函数</Button>
      </div>
    </div>

    <BacktestCodeModal catalog={catalog} editorScope={editorScope} key={editorScope} panel={codePanel} parameters={parameters} projectId={projectId} readOnly={readOnly} onChange={onChange} onPanelChange={setCodePanel} onValidityChange={setCodeValid} />
  </div>;
}

function StrategyParameterField({ modelPath, onChange, onValidityChange, parameters, readOnly }: { modelPath: string; onChange: (parameters: StrategyParameters) => void; onValidityChange: (valid: boolean) => void; parameters: StrategyParameters; readOnly: boolean }) {
  const [source, setSource] = useState(() => serialize(parameters));
  const [validationError, setValidationError] = useState<string | null>(null);
  const emittedSource = useRef<string | null>(null);

  useEffect(() => {
    const next = serialize(parameters);
    if (emittedSource.current === next) {
      emittedSource.current = null;
      return;
    }
    setSource((current) => current === next ? current : next);
    setValidationError(null);
    onValidityChange(true);
  }, [onValidityChange, parameters]);

  function update(value: string) {
    setSource(value);
    const parsed = parse(value);
    setValidationError(parsed.error);
    onValidityChange(parsed.error === null);
    if (parsed.parameters !== null) {
      emittedSource.current = serialize(parsed.parameters);
      onChange(parsed.parameters);
    }
  }

  return <div className="col-span-2 space-y-2"><label className="text-sm font-medium">策略参数</label><CodeEditor ariaLabel="策略参数" className="h-36" language="ini" modelPath={modelPath} readOnly={readOnly} value={source} onChange={update} />{validationError ? <p className="text-xs text-destructive">{validationError}</p> : null}</div>;
}

function parse(source: string): { error: string | null; parameters: StrategyParameters | null } {
  const entries = new Map<string, StrategyParameters[string]>();
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const value = line.trim();
    if (!value) continue;
    const separator = value.indexOf("=");
    if (separator <= 0) return { error: `第 ${index + 1} 行必须使用 key=value。`, parameters: null };
    const key = value.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return { error: `第 ${index + 1} 行的参数名无效。`, parameters: null };
    if (entries.has(key)) return { error: `第 ${index + 1} 行的参数名 ${key} 重复。`, parameters: null };
    entries.set(key, parseValue(value.slice(separator + 1).trim()));
  }
  return { error: null, parameters: Object.fromEntries(entries) };
}

function parseValue(value: string): string | number | boolean | null {
  if (value === "null") return null;
  if (value === "true" || value === "false") return value === "true";
  const number = Number(value);
  if (value && Number.isFinite(number)) return number;
  if (value.startsWith("\"") && value.endsWith("\"")) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") return parsed;
    } catch {
      return value;
    }
  }
  return value;
}

function serialize(parameters: StrategyParameters) {
  return Object.entries(parameters).map(([key, value]) => `${key}=${typeof value === "string" ? JSON.stringify(value) : String(value)}`).join("\n");
}

function numberConfig(parameters: BacktestParameters, name: string) {
  const value = parameters.config[name];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`回测配置 ${name} 必须是有限数值。`);
  return value;
}
function booleanConfig(parameters: BacktestParameters, name: string) {
  const value = parameters.config[name];
  if (typeof value !== "boolean") throw new Error(`回测配置 ${name} 必须是布尔值。`);
  return value;
}
function optionalStringConfig(parameters: BacktestParameters, name: string) {
  const value = parameters.config[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) throw new Error(`回测配置 ${name} 必须是非空字符串。`);
  return value;
}
function updateConfig(parameters: BacktestParameters, name: string, value: boolean | number | string): BacktestParameters { return { ...parameters, config: { ...parameters.config, [name]: value } }; }
function removeConfig(parameters: BacktestParameters, name: string): BacktestParameters { const config = { ...parameters.config }; delete config[name]; return { ...parameters, config }; }
