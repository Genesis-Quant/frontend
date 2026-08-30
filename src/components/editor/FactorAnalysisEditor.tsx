import { lazy, Suspense } from "react";

import { NumberField, SelectField, TextField } from "@/components/field/FormFields";
import {
  analysisDsl,
  analysisSettings,
  applyAnalysisSettings,
  marketValueFields,
  priceFields,
  stockPools,
  type DslCatalog,
  type DslDocument,
  type DslSource,
  type FactorAnalysisParameters,
  type FactorQuery,
  type MarketValueField,
  type PriceField,
  type StockPoolSelection
} from "@/types/factor";

const DslEditor = lazy(() => import("@/components/editor/DslEditor"));

type FactorAnalysisEditorProps = {
  catalog: DslCatalog;
  parameters: FactorAnalysisParameters;
  projectId: number;
  readOnly?: boolean;
  onChange: (parameters: FactorAnalysisParameters) => void;
  onValidityChange: (valid: boolean) => void;
};

export default function FactorAnalysisEditor({ catalog, onChange, onValidityChange, parameters, projectId, readOnly = false }: FactorAnalysisEditorProps) {
  const dsl = analysisDsl(parameters);
  const settings = analysisSettings(parameters);
  const stockPoolOptions = settings.stockPool === "CUSTOM"
    ? [{ label: "自定义股票池", value: "CUSTOM" }, ...stockPools]
    : stockPools;

  function updateStockPool(stockPool: StockPoolSelection) {
    if (stockPool === "CUSTOM") return;
    onChange(applyAnalysisSettings(parameters, dsl, { ...settings, stockPool }));
  }

  function updateQuery(datasetQuery: FactorQuery) {
    onChange(applyAnalysisSettings({ ...parameters, dataset_query: datasetQuery }, dsl, settings));
  }

  function updateDsl(nextDsl: DslDocument, source: DslSource, valid: boolean) {
    const nextParameters = { ...parameters, dataset_query: { ...parameters.dataset_query, ...nextDsl, dsl_source: source } };
    const userDsl = analysisDsl(nextParameters);
    onChange(applyAnalysisSettings(nextParameters, userDsl, settings));
    onValidityChange(valid && Object.keys(userDsl.derivatives).length > 0);
  }

  return <div className="space-y-5">
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <TextField className="field-block" controlClassName="research-input" labelClassName="field-label" label="开始日期" value={parameters.dataset_query.start_date.replace(/-/g, ".")} disabled={readOnly} onChange={(startDate) => updateQuery({ ...parameters.dataset_query, start_date: startDate.replace(/\./g, "-") })} />
        <TextField className="field-block" controlClassName="research-input" labelClassName="field-label" label="结束日期" value={parameters.dataset_query.end_date.replace(/-/g, ".")} disabled={readOnly} onChange={(endDate) => updateQuery({ ...parameters.dataset_query, end_date: endDate.replace(/\./g, "-") })} />
        <SelectField className="field-block" controlClassName="research-input w-full" labelClassName="field-label" label="股票池" value={settings.stockPool} options={stockPoolOptions} disabled={readOnly} onChange={(value) => updateStockPool(value as StockPoolSelection)} />
        <SelectField className="field-block" controlClassName="research-input w-full" labelClassName="field-label" label="价格字段" value={settings.priceField} options={priceFields} disabled={readOnly} onChange={(priceField) => onChange(applyAnalysisSettings(parameters, dsl, { ...settings, priceField: priceField as PriceField }))} />
        <SelectField className="field-block" controlClassName="research-input w-full" labelClassName="field-label" label="市值字段" value={settings.marketValueField} options={marketValueFields} disabled={readOnly} onChange={(marketValueField) => onChange(applyAnalysisSettings(parameters, dsl, { ...settings, marketValueField: marketValueField as MarketValueField }))} />
        <NumberField className="field-block" controlClassName="research-input" labelClassName="field-label" label="分组数量" value={settings.nGroups} min={2} disabled={readOnly} onChange={(nGroups) => onChange(applyAnalysisSettings(parameters, dsl, { ...settings, nGroups }))} />
        <NumberField className="field-block" controlClassName="research-input" labelClassName="field-label" label="极端股票数" value={settings.nSelect} min={1} disabled={readOnly} onChange={(nSelect) => onChange(applyAnalysisSettings(parameters, dsl, { ...settings, nSelect }))} />
        <NumberField className="field-block" controlClassName="research-input" labelClassName="field-label" label="最大滞后阶数" value={settings.maxLags} min={1} max={60} disabled={readOnly} onChange={(maxLags) => onChange(applyAnalysisSettings(parameters, dsl, { ...settings, maxLags }))} />
        <TextField className="field-block" controlClassName="research-input" labelClassName="field-label" label="回溯周期" value={parameters.dataset_query.lookback} disabled={readOnly} onChange={(lookback) => updateQuery({ ...parameters.dataset_query, lookback })} />
      </div>
    </div>

    <div className="h-[420px]">
      <Suspense fallback={<div className="h-full rounded-md border bg-card" />}>
        <DslEditor
          catalog={catalog}
          compileEndpoint="/factor/dsl/compile"
          modelPath={`factor-dsl://project/${projectId}/dataset.json`}
          onChange={updateDsl}
          onValidityChange={(valid) => onValidityChange(valid && Object.keys(dsl.derivatives).length > 0)}
          readOnly={readOnly}
          source={parameters.dataset_query.dsl_source}
          value={dsl}
        />
      </Suspense>
    </div>
  </div>;
}
