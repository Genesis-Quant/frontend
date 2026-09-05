import { lazy, Suspense } from "react";

import { NumberField, SelectField, TextField } from "@/components/field/FormFields";
import {
  analysisDsl,
  analysisSettings,
  industryFields,
  marketValueFields,
  priceFields,
  setAnalysisDsl,
  setAnalysisReturns,
  setAnalysisStockPool,
  stockPools,
  type DslCatalog,
  type DslCompilation,
  type DslDocument,
  type DslSource,
  type FactorAnalysisParameters,
  type FactorQuery,
  type IndustryField,
  type MarketValueField,
  type PriceField,
  type StockPoolSelection
} from "@/types/factor";

const DslEditor = lazy(() => import("@/components/editor/DslEditor"));

type FactorAnalysisEditorProps = {
  catalog: DslCatalog;
  editorScope: string;
  parameters: FactorAnalysisParameters;
  projectId: number;
  readOnly?: boolean;
  onChange: (parameters: FactorAnalysisParameters) => void;
  onValidityChange: (valid: boolean, compilation?: DslCompilation) => void;
};

export default function FactorAnalysisEditor({ catalog, editorScope, onChange, onValidityChange, parameters, projectId, readOnly = false }: FactorAnalysisEditorProps) {
  const dsl = analysisDsl(parameters);
  const settings = analysisSettings(parameters);
  const stockPoolOptions = settings.stockPool === "CUSTOM"
    ? [{ label: "自定义股票池", value: "CUSTOM" }, ...stockPools]
    : stockPools;

  function updateStockPool(stockPool: StockPoolSelection) {
    if (stockPool === "CUSTOM") return;
    onChange(setAnalysisStockPool(parameters, stockPool));
  }

  function updateQuery(datasetQuery: FactorQuery) {
    const codesQuery = settings.stockPool !== "ALL" && settings.stockPool !== "CUSTOM" && parameters.codes_query !== null
      ? { ...parameters.codes_query, start_date: datasetQuery.start_date, end_date: datasetQuery.end_date }
      : parameters.codes_query;
    onChange({ ...parameters, codes_query: codesQuery, dataset_query: datasetQuery });
  }

  function updateDsl(nextDsl: DslDocument, source: DslSource) {
    onChange(setAnalysisDsl(parameters, nextDsl, source));
  }

  return <div className="space-y-5">
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <TextField className="field-block" controlClassName="research-input" labelClassName="field-label" label="开始日期" value={parameters.dataset_query.start_date.replace(/-/g, ".")} disabled={readOnly} onChange={(startDate) => updateQuery({ ...parameters.dataset_query, start_date: startDate.replace(/\./g, "-") })} />
        <TextField className="field-block" controlClassName="research-input" labelClassName="field-label" label="结束日期" value={parameters.dataset_query.end_date.replace(/-/g, ".")} disabled={readOnly} onChange={(endDate) => updateQuery({ ...parameters.dataset_query, end_date: endDate.replace(/\./g, "-") })} />
        <SelectField className="field-block" controlClassName="research-input w-full" labelClassName="field-label" label="股票池" value={settings.stockPool} options={stockPoolOptions} disabled={readOnly} onChange={(value) => updateStockPool(value as StockPoolSelection)} />
        <SelectField className="field-block" controlClassName="research-input w-full" labelClassName="field-label" label="价格字段" value={settings.priceField} options={priceFields} disabled={readOnly} onChange={(priceField) => onChange(setAnalysisReturns(parameters, priceField as PriceField, settings.maxLags))} />
        <SelectField className="field-block" controlClassName="research-input w-full" labelClassName="field-label" label="市值字段" value={settings.marketValueField} options={marketValueFields} disabled={readOnly} onChange={(marketValueField) => onChange({ ...parameters, market_value_column: marketValueField as MarketValueField })} />
        <SelectField className="field-block" controlClassName="research-input w-full" labelClassName="field-label" label="行业字段" value={settings.industryField} options={industryFields} disabled={readOnly} onChange={(industryField) => onChange({ ...parameters, industry_column: industryField as IndustryField })} />
        <NumberField className="field-block" controlClassName="research-input" labelClassName="field-label" label="分组数量" value={settings.nGroups} min={2} disabled={readOnly} onChange={(nGroups) => onChange({ ...parameters, n_groups: nGroups })} />
        <NumberField className="field-block" controlClassName="research-input" labelClassName="field-label" label="极端股票数" value={settings.nSelect} min={1} disabled={readOnly} onChange={(nSelect) => onChange({ ...parameters, n_select: nSelect })} />
        <NumberField className="field-block" controlClassName="research-input" labelClassName="field-label" label="最大滞后阶数" value={settings.maxLags} min={1} max={60} disabled={readOnly} onChange={(maxLags) => onChange(setAnalysisReturns(parameters, settings.priceField, maxLags))} />
        <TextField className="field-block" controlClassName="research-input" labelClassName="field-label" label="回溯周期" value={parameters.dataset_query.lookback} disabled={readOnly} onChange={(lookback) => updateQuery({ ...parameters.dataset_query, lookback })} />
      </div>
    </div>

    <div className="h-[420px]">
      <Suspense fallback={<div className="h-full rounded-md border bg-card" />}>
        <DslEditor
          catalog={catalog}
          compileEndpoint="/factor/dsl/compile"
          key={editorScope}
          modelPath={`factor-dsl://factor/${projectId}/${editorScope}/dataset`}
          onChange={updateDsl}
          onValidityChange={onValidityChange}
          readOnly={readOnly}
          source={parameters.dataset_query.dsl_source}
          value={dsl}
        />
      </Suspense>
    </div>
  </div>;
}
