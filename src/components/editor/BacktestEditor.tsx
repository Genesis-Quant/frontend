import { Braces, FunctionSquare, Settings2, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { NumberField, SelectField, SwitchField } from "@/components/field/FormFields";
import BacktestCodeModal, { type BacktestCodePanel } from "@/components/modal/BacktestCodeModal";
import { Button } from "@/ui/button";
import { setBacktestStockPoolType, type BacktestCatalog, type BacktestParameters, type StrategyParameters } from "@/types/backtest";
import { stockPools } from "@/types/factor";

export default function BacktestEditor({ catalog, onChange, onValidityChange, parameters, projectId, readOnly = false }: { catalog: BacktestCatalog; onChange: (parameters: BacktestParameters) => void; onValidityChange: (valid: boolean) => void; parameters: BacktestParameters; projectId: number; readOnly?: boolean }) {
  const [codePanel, setCodePanel] = useState<BacktestCodePanel | null>(null);
  const [codeValid, setCodeValid] = useState(true);
  const [strategyParametersValid, setStrategyParametersValid] = useState(true);
  const selectedBenchmark = stringConfig(parameters, "benchmark", "none");
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
      <NumberField label="初始资金" min={1} value={numberConfig(parameters, "cash", 1_000_000)} disabled={readOnly} onChange={(cash) => onChange(updateConfig(parameters, "cash", cash))} />
      <NumberField label="年化交易日" min={1} value={parameters.annual_trading_days} disabled={readOnly} onChange={(annualTradingDays) => onChange({ ...parameters, annual_trading_days: annualTradingDays })} />
      <NumberField label="无风险利率" min={0} step={0.001} value={parameters.risk_free_rate} disabled={readOnly} onChange={(riskFreeRate) => onChange({ ...parameters, risk_free_rate: riskFreeRate })} />
      <NumberField label="手续费率" min={0} step={0.0001} value={numberConfig(parameters, "commission", 0)} disabled={readOnly} onChange={(commission) => onChange(updateConfig(parameters, "commission", commission))} />
      <NumberField label="印花税率" min={0} step={0.0001} value={numberConfig(parameters, "tax", 0)} disabled={readOnly} onChange={(tax) => onChange(updateConfig(parameters, "tax", tax))} />
      <SwitchField checked={booleanConfig(parameters, "enableMinimumPerTransactionFee", true)} checkedText="5元" disabled={readOnly} label="最低手续费" uncheckedText="无" onChange={(enabled) => onChange(updateConfig(parameters, "enableMinimumPerTransactionFee", enabled))} />
      <SwitchField checked={parameters.codes_query !== null} checkedText="动态" disabled={readOnly} label="股票池类型" uncheckedText="静态" onChange={(dynamic) => onChange(setBacktestStockPoolType(parameters, dynamic))} />
      <SelectField className="col-span-2 space-y-2" label="基准指数" value={selectedBenchmark} options={benchmarkOptions} disabled={readOnly} onChange={(benchmark) => onChange(benchmark === "none" ? removeConfig(parameters, "benchmark") : updateConfig(parameters, "benchmark", benchmark))} />
      <StrategyParameterField parameters={parameters.params} readOnly={readOnly} onChange={(params) => onChange({ ...parameters, params })} onValidityChange={setStrategyParametersValid} />
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

    <BacktestCodeModal catalog={catalog} panel={codePanel} parameters={parameters} projectId={projectId} readOnly={readOnly} onChange={onChange} onPanelChange={setCodePanel} onValidityChange={setCodeValid} />
  </div>;
}

function StrategyParameterField({ onChange, onValidityChange, parameters, readOnly }: { onChange: (parameters: StrategyParameters) => void; onValidityChange: (valid: boolean) => void; parameters: StrategyParameters; readOnly: boolean }) {
  const [source, setSource] = useState(() => serialize(parameters));
  const [invalid, setInvalid] = useState(false);
  const emittedSource = useRef<string | null>(null);

  useEffect(() => {
    const next = serialize(parameters);
    if (emittedSource.current === next) {
      emittedSource.current = null;
      return;
    }
    setSource((current) => current === next ? current : next);
    setInvalid(false);
    onValidityChange(true);
  }, [onValidityChange, parameters]);

  function update(value: string) {
    setSource(value);
    const next = parse(value);
    setInvalid(next === null);
    onValidityChange(next !== null);
    if (next !== null) {
      emittedSource.current = serialize(next);
      onChange(next);
    }
  }

  return <div className="col-span-2 space-y-2"><label className="text-sm font-medium">策略参数</label><textarea aria-label="策略参数" className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={readOnly} value={source} onChange={(event) => update(event.target.value)} />{invalid ? <p className="text-xs text-destructive">每行必须使用 key=value。</p> : null}</div>;
}

function parse(source: string): StrategyParameters | null {
  const result: StrategyParameters = {};
  for (const line of source.split(/\r?\n/)) {
    const value = line.trim();
    if (!value) continue;
    const separator = value.indexOf("=");
    if (separator <= 0) return null;
    const key = value.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
    result[key] = parseValue(value.slice(separator + 1).trim());
  }
  return result;
}

function parseValue(value: string): string | number | boolean | null {
  if (value === "null") return null;
  if (value === "true" || value === "false") return value === "true";
  const number = Number(value);
  if (value && Number.isFinite(number)) return number;
  if (value.startsWith('"') && value.endsWith('"')) {
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

function numberConfig(parameters: BacktestParameters, name: string, fallback: number) { const value = Number(parameters.config[name]); return Number.isFinite(value) ? value : fallback; }
function booleanConfig(parameters: BacktestParameters, name: string, fallback: boolean) { const value = parameters.config[name]; return typeof value === "boolean" ? value : fallback; }
function stringConfig(parameters: BacktestParameters, name: string, fallback: string) { const value = parameters.config[name]; return typeof value === "string" ? value : fallback; }
function updateConfig(parameters: BacktestParameters, name: string, value: boolean | number | string): BacktestParameters { return { ...parameters, config: { ...parameters.config, [name]: value } }; }
function removeConfig(parameters: BacktestParameters, name: string): BacktestParameters { const config = { ...parameters.config }; delete config[name]; return { ...parameters, config }; }
