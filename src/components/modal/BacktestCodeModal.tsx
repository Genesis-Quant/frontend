import { Braces, FunctionSquare, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { utilsCompletions, validCallback } from "@/assets/lib/backtest";
import DslEditor from "@/components/editor/DslEditor";
import DolphinDbEditor from "@/components/editor/DolphinDbEditor";
import { TextField } from "@/components/field/FormFields";
import StockCodesField from "@/components/field/StockCodesField";
import { backtestCodesDsl, backtestDatasetDsl, callbackNames, updateBacktestCodesDsl, updateBacktestDatasetDsl, type BacktestParameters, type CallbackName } from "@/types/backtest";
import type { DslCatalog, FactorQuery } from "@/types/factor";
import { Badge } from "@/ui/badge";
import { Dialog, LargeDialogContent } from "@/ui/dialog";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";

export type BacktestCodePanel = "callbacks" | "codes" | "dataset" | "utils";

type BacktestCodeModalProps = {
  catalog: DslCatalog;
  onChange: (parameters: BacktestParameters) => void;
  onPanelChange: (panel: BacktestCodePanel | null) => void;
  onValidityChange: (valid: boolean) => void;
  panel: BacktestCodePanel | null;
  parameters: BacktestParameters;
  projectId: number;
  readOnly: boolean;
};

export default function BacktestCodeModal({ catalog, onChange, onPanelChange, onValidityChange, panel, parameters, projectId, readOnly }: BacktestCodeModalProps) {
  const [callback, setCallback] = useState<CallbackName>("onBar");
  const [codesDslValid, setCodesDslValid] = useState(true);
  const [datasetDslValid, setDatasetDslValid] = useState(true);
  const hasCodesQuery = parameters.codes_query !== null;
  const codesDsl = backtestCodesDsl(parameters);
  const datasetDsl = backtestDatasetDsl(parameters);
  const callbackCompletions = useMemo(() => utilsCompletions(parameters.utils), [parameters.utils]);
  useEffect(() => { setCodesDslValid(true); setDatasetDslValid(true); }, [parameters.codes_query, parameters.dataset_query]);
  useEffect(() => onValidityChange((!hasCodesQuery || codesDslValid) && datasetDslValid), [codesDslValid, datasetDslValid, hasCodesQuery, onValidityChange]);

  function updateCodesQuery(codesQuery: FactorQuery) { onChange({ ...parameters, codes_query: codesQuery }); }
  function updateDatasetQuery(datasetQuery: FactorQuery) { onChange({ ...parameters, dataset_query: datasetQuery }); }
  function updateCallback(source: string) { onChange({ ...parameters, callbacks: { ...parameters.callbacks, [callback]: source } }); }

  return <Dialog open={panel !== null} onOpenChange={(open) => { if (!open) onPanelChange(null); }}>
    <LargeDialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:!max-w-[1080px] xl:!w-[min(1080px,calc(100vw-96px))]">
      <Tabs className="flex min-h-0 flex-1 flex-col" value={panel === "codes" && !hasCodesQuery ? "dataset" : panel ?? "dataset"} onValueChange={(value) => onPanelChange(value as BacktestCodePanel)}>
        <div className="px-3 pt-3 pr-10"><TabsList>{hasCodesQuery && <TabsTrigger value="codes"><Braces />股票池查询 DSL</TabsTrigger>}<TabsTrigger value="dataset"><Braces />回测数据查询 DSL</TabsTrigger><TabsTrigger value="utils"><Wrench />工具函数</TabsTrigger><TabsTrigger value="callbacks"><FunctionSquare />回调函数</TabsTrigger></TabsList></div>
        {parameters.codes_query !== null && <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="codes"><div className="flex h-full min-h-0 flex-col gap-2"><QueryRange query={parameters.codes_query} readOnly={readOnly} onChange={updateCodesQuery} /><div className="min-h-0 flex-1"><DslEditor catalog={catalog} modelPath={`factor-dsl://backtest/${projectId}/codes.json`} onChange={(nextDsl) => onChange(updateBacktestCodesDsl(parameters, nextDsl))} onValidityChange={setCodesDslValid} readOnly={readOnly} value={codesDsl} /></div></div></TabsContent>}
        <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="dataset"><div className="flex h-full min-h-0 flex-col gap-2"><QueryRange codesDisabled={hasCodesQuery} query={parameters.dataset_query} readOnly={readOnly} onChange={updateDatasetQuery} /><div className="min-h-0 flex-1"><DslEditor catalog={catalog} modelPath={`factor-dsl://backtest/${projectId}/dataset.json`} onChange={(nextDsl) => onChange(updateBacktestDatasetDsl(parameters, nextDsl))} onValidityChange={setDatasetDslValid} readOnly={readOnly} value={datasetDsl} /></div></div></TabsContent>
        <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="utils"><DolphinDbEditor modelPath={`dolphindb://backtest/${projectId}/utils.dos`} onChange={(utils) => onChange({ ...parameters, utils })} readOnly={readOnly} value={parameters.utils} /></TabsContent>
        <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="callbacks">
          <div className="flex h-full min-h-0 flex-col"><div className="mb-2 flex items-end justify-between gap-2"><div className="space-y-1"><Label>生命周期回调</Label><Select value={callback} onValueChange={(value) => setCallback(value as CallbackName)}><SelectTrigger className="w-56 font-mono"><SelectValue /></SelectTrigger><SelectContent>{callbackNames.map((name) => <SelectItem className="font-mono" key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div><Badge variant={validCallback(callback, parameters.callbacks[callback]) ? "secondary" : "destructive"}>{validCallback(callback, parameters.callbacks[callback]) ? "签名正确" : "签名错误"}</Badge></div>
          <div className="min-h-0 flex-1"><DolphinDbEditor completions={callbackCompletions} modelPath={`dolphindb://backtest/${projectId}/callbacks/${callback}.dos`} onChange={updateCallback} readOnly={readOnly} value={parameters.callbacks[callback]} /></div></div>
        </TabsContent>
      </Tabs>
    </LargeDialogContent>
  </Dialog>;
}

function QueryRange({ codesDisabled = false, onChange, query, readOnly }: { codesDisabled?: boolean; onChange: (query: FactorQuery) => void; query: FactorQuery; readOnly: boolean }) {
  return <div className="grid gap-2 sm:grid-cols-4"><TextField label="开始日期" value={query.start_date} disabled={readOnly} onChange={(startDate) => onChange({ ...query, start_date: startDate })} /><TextField label="截至日期" value={query.end_date} disabled={readOnly} onChange={(endDate) => onChange({ ...query, end_date: endDate })} /><TextField label="回溯周期" value={query.lookback} disabled={readOnly} onChange={(lookback) => onChange({ ...query, lookback })} /><StockCodesField codes={query.codes} disabled={codesDisabled} readOnly={readOnly} onChange={(codes) => onChange({ ...query, codes })} /></div>;
}
