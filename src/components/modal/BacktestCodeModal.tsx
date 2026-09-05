import { Braces, FunctionSquare, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { utilsCompletions, validCallback } from "@/assets/lib/backtest";
import { dslSourceKey } from "@/assets/lib/dslSource";
import { pythonDslDiagnostics } from "@/assets/lib/pythonDslLanguage";
import { client } from "@/assets/lib/request";
import DslEditor from "@/components/editor/DslEditor";
import DolphinDbEditor from "@/components/editor/DolphinDbEditor";
import { TextField } from "@/components/field/FormFields";
import StockCodesField from "@/components/field/StockCodesField";
import { backtestCodesDsl, backtestDatasetDsl, callbackNames, updateBacktestCodesDsl, updateBacktestDatasetDsl, type BacktestParameters, type CallbackName } from "@/types/backtest";
import type { DslCatalog, DslSource, FactorQuery } from "@/types/factor";
import { Badge } from "@/ui/badge";
import { Dialog, LargeDialogContent } from "@/ui/dialog";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";

export type BacktestCodePanel = "callbacks" | "codes" | "dataset" | "utils";

type BacktestCodeModalProps = {
  catalog: DslCatalog;
  editorScope: string;
  onChange: (parameters: BacktestParameters) => void;
  onPanelChange: (panel: BacktestCodePanel | null) => void;
  onValidityChange: (valid: boolean) => void;
  panel: BacktestCodePanel | null;
  parameters: BacktestParameters;
  projectId: number;
  readOnly: boolean;
};

export default function BacktestCodeModal({ catalog, editorScope, onChange, onPanelChange, onValidityChange, panel, parameters, projectId, readOnly }: BacktestCodeModalProps) {
  const [callback, setCallback] = useState<CallbackName>("onSnapshot");
  const hasCodesQuery = parameters.codes_query !== null;
  const codesDsl = backtestCodesDsl(parameters);
  const datasetDsl = backtestDatasetDsl(parameters);
  const codesValidation = useDslValidation(readOnly ? null : parameters.codes_query?.dsl_source ?? null, "/query/dsl/compile");
  const datasetValidation = useDslValidation(readOnly ? null : parameters.dataset_query.dsl_source, "/backtest/dsl/compile");
  const callbackCompletions = useMemo(() => utilsCompletions(parameters.utils), [parameters.utils]);
  useEffect(() => onValidityChange(codesValidation.valid && datasetValidation.valid), [codesValidation.valid, datasetValidation.valid, onValidityChange]);

  function updateCodesQuery(codesQuery: FactorQuery) { onChange({ ...parameters, codes_query: codesQuery }); }
  function updateDatasetQuery(datasetQuery: FactorQuery) { onChange({ ...parameters, dataset_query: datasetQuery }); }
  function updateCallback(source: string) { onChange({ ...parameters, callbacks: { ...parameters.callbacks, [callback]: source } }); }

  return <>
    {codesValidation.error ? <p role="alert" className="text-sm text-destructive">股票池查询 DSL：{codesValidation.error}</p> : null}
    {datasetValidation.error ? <p role="alert" className="text-sm text-destructive">回测数据查询 DSL：{datasetValidation.error}</p> : null}
    <Dialog open={panel !== null} onOpenChange={(open) => { if (!open) onPanelChange(null); }}>
    <LargeDialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:!max-w-[1080px] xl:!w-[min(1080px,calc(100vw-96px))]">
      <Tabs className="flex min-h-0 flex-1 flex-col" value={panel === "codes" && !hasCodesQuery ? "dataset" : panel ?? "dataset"} onValueChange={(value) => onPanelChange(value as BacktestCodePanel)}>
        <div className="px-3 pt-3 pr-10"><TabsList scrollable>{hasCodesQuery && <TabsTrigger value="codes"><Braces />股票池查询 DSL</TabsTrigger>}<TabsTrigger value="dataset"><Braces />回测数据查询 DSL</TabsTrigger><TabsTrigger value="utils"><Wrench />工具函数</TabsTrigger><TabsTrigger value="callbacks"><FunctionSquare />回调函数</TabsTrigger></TabsList></div>
        {parameters.codes_query !== null && <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="codes"><div className="flex h-full min-h-0 flex-col gap-2"><QueryRange query={parameters.codes_query} readOnly={readOnly} onChange={updateCodesQuery} /><div className="min-h-0 flex-1"><DslEditor catalog={catalog} compileEndpoint="/query/dsl/compile" key={`${editorScope}:codes`} modelPath={`factor-dsl://backtest/${projectId}/${editorScope}/codes`} source={parameters.codes_query.dsl_source} onChange={(nextDsl, source) => onChange(updateBacktestCodesDsl(parameters, nextDsl, source))} readOnly={readOnly} value={codesDsl} /></div></div></TabsContent>}
        <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="dataset"><div className="flex h-full min-h-0 flex-col gap-2"><QueryRange codesDisabled={hasCodesQuery} query={parameters.dataset_query} readOnly={readOnly} onChange={updateDatasetQuery} /><div className="min-h-0 flex-1"><DslEditor catalog={catalog} compileEndpoint="/backtest/dsl/compile" key={`${editorScope}:dataset`} modelPath={`factor-dsl://backtest/${projectId}/${editorScope}/dataset`} source={parameters.dataset_query.dsl_source} onChange={(nextDsl, source) => onChange(updateBacktestDatasetDsl(parameters, nextDsl, source))} readOnly={readOnly} value={datasetDsl} /></div></div></TabsContent>
        <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="utils"><DolphinDbEditor modelPath={`dolphindb://backtest/${projectId}/${editorScope}/utils.dos`} onChange={(utils) => onChange({ ...parameters, utils })} readOnly={readOnly} value={parameters.utils} /></TabsContent>
        <TabsContent className="min-h-0 flex-1 overflow-hidden p-3 pt-2" value="callbacks">
          <div className="flex h-full min-h-0 flex-col"><div className="mb-2 flex items-end justify-between gap-2"><div className="space-y-1"><Label>生命周期回调</Label><Select value={callback} onValueChange={(value) => setCallback(value as CallbackName)}><SelectTrigger className="w-56 font-mono"><SelectValue /></SelectTrigger><SelectContent>{callbackNames.map((name) => <SelectItem className="font-mono" key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div><Badge variant={validCallback(callback, parameters.callbacks[callback]) ? "secondary" : "destructive"}>{validCallback(callback, parameters.callbacks[callback]) ? "签名正确" : "签名错误"}</Badge></div>
          <div className="min-h-0 flex-1"><DolphinDbEditor completions={callbackCompletions} modelPath={`dolphindb://backtest/${projectId}/${editorScope}/callbacks/${callback}.dos`} onChange={updateCallback} readOnly={readOnly} value={parameters.callbacks[callback]} /></div></div>
        </TabsContent>
      </Tabs>
    </LargeDialogContent>
    </Dialog>
  </>;
}

function useDslValidation(source: DslSource | null, compileEndpoint: string) {
  const key = source === null ? null : `${compileEndpoint}\u0000${dslSourceKey(source)}`;
  const [validation, setValidation] = useState<{ key: string; error: string | null } | null>(null);

  useEffect(() => {
    if (source === null || key === null) return undefined;
    const diagnostics = source.language === "python" ? pythonDslDiagnostics(source.python_source) : [];
    if (diagnostics.length) {
      setValidation({ key, error: diagnostics.map((diagnostic) => diagnostic.message).join("；") });
      return undefined;
    }

    let disposed = false;
    const timer = setTimeout(() => {
      client.post(compileEndpoint, source, { timeout: 30000 })
        .then(() => {
          if (!disposed) setValidation({ key, error: null });
        })
        .catch((error: unknown) => {
          if (!disposed) setValidation({ key, error: error instanceof Error ? error.message : "DSL 编译失败" });
        });
    }, 350);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [compileEndpoint, key]);

  return {
    valid: source === null || validation?.key === key && validation.error === null,
    error: validation?.key === key ? validation.error : null
  };
}

function QueryRange({ codesDisabled = false, onChange, query, readOnly }: { codesDisabled?: boolean; onChange: (query: FactorQuery) => void; query: FactorQuery; readOnly: boolean }) {
  return <div className="grid gap-2 sm:grid-cols-4"><TextField label="开始日期" value={query.start_date} disabled={readOnly} onChange={(startDate) => onChange({ ...query, start_date: startDate })} /><TextField label="截至日期" value={query.end_date} disabled={readOnly} onChange={(endDate) => onChange({ ...query, end_date: endDate })} /><TextField label="回溯周期" value={query.lookback} disabled={readOnly} onChange={(lookback) => onChange({ ...query, lookback })} /><StockCodesField codes={query.codes} disabled={codesDisabled} readOnly={readOnly} onChange={(codes) => onChange({ ...query, codes })} /></div>;
}
