import { Braces, FunctionSquare, Settings2, Wrench } from "lucide-react";
import { useState } from "react";

import { NumberField, SelectField, SwitchField } from "@/components/field/FormFields";
import BacktestCodeModal, { type BacktestCodePanel } from "@/components/modal/BacktestCodeModal";
import { Button } from "@/ui/button";
import { defaultBacktestCodesQuery, type BacktestParameters } from "@/types/backtest";
import type { DslCatalog } from "@/types/factor";

export default function BacktestEditor({ catalog, onChange, onValidityChange, parameters, projectId, readOnly = false }: { catalog: DslCatalog; onChange: (parameters: BacktestParameters) => void; onValidityChange: (valid: boolean) => void; parameters: BacktestParameters; projectId: number; readOnly?: boolean }) {
  const [codePanel, setCodePanel] = useState<BacktestCodePanel | null>(null);

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3">
      <SelectField label="复权方式" value={parameters.adj ?? "none"} options={[{ label: "不复权", value: "none" }, { label: "后复权", value: "hfq" }, { label: "前复权", value: "qfq" }]} disabled={readOnly} onChange={(value) => onChange({ ...parameters, adj: value === "none" ? null : value as "hfq" | "qfq" })} />
      <NumberField label="初始资金" min={1} value={numberConfig(parameters, "cash", 1_000_000)} disabled={readOnly} onChange={(cash) => onChange(updateConfig(parameters, "cash", cash))} />
      <NumberField label="年化交易日" min={1} value={parameters.annual_trading_days} disabled={readOnly} onChange={(annualTradingDays) => onChange({ ...parameters, annual_trading_days: annualTradingDays })} />
      <NumberField label="无风险利率" min={0} step={0.001} value={parameters.risk_free_rate} disabled={readOnly} onChange={(riskFreeRate) => onChange({ ...parameters, risk_free_rate: riskFreeRate })} />
      <NumberField label="手续费率" min={0} step={0.0001} value={numberConfig(parameters, "commission", 0)} disabled={readOnly} onChange={(commission) => onChange(updateConfig(parameters, "commission", commission))} />
      <NumberField label="印花税率" min={0} step={0.0001} value={numberConfig(parameters, "tax", 0)} disabled={readOnly} onChange={(tax) => onChange(updateConfig(parameters, "tax", tax))} />
      <SwitchField checked={booleanConfig(parameters, "enableMinimumPerTransactionFee", true)} checkedText="5元" disabled={readOnly} label="最低手续费" uncheckedText="无" onChange={(enabled) => onChange(updateConfig(parameters, "enableMinimumPerTransactionFee", enabled))} />
      <SwitchField checked={parameters.codes_query !== null} checkedText="动态" disabled={readOnly} label="股票池类型" uncheckedText="静态" onChange={(dynamic) => onChange({ ...parameters, codes_query: dynamic ? defaultBacktestCodesQuery(parameters.dataset_query) : null })} />
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

    <BacktestCodeModal catalog={catalog} panel={codePanel} parameters={parameters} projectId={projectId} readOnly={readOnly} onChange={onChange} onPanelChange={setCodePanel} onValidityChange={onValidityChange} />
  </div>;
}
function numberConfig(parameters: BacktestParameters, name: string, fallback: number) { const value = Number(parameters.config[name]); return Number.isFinite(value) ? value : fallback; }
function booleanConfig(parameters: BacktestParameters, name: string, fallback: boolean) { const value = parameters.config[name]; return typeof value === "boolean" ? value : fallback; }
function updateConfig(parameters: BacktestParameters, name: string, value: boolean | number): BacktestParameters { return { ...parameters, config: { ...parameters.config, [name]: value } }; }
