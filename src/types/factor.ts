export type DerivativeNode = {
  type: "DIRECT" | "TS" | "CS";
  op: string;
  fields: Record<string, unknown>;
  params: Record<string, unknown>;
  on?: string | boolean | DerivativeNode | null;
};

export type DslDocument = {
  factors: string[];
  derivatives: Record<string, DerivativeNode>;
  filters: string[];
};

export type DslLanguage = "json" | "python";

export type DslSource = {
  language: DslLanguage;
  json_source: string;
  python_source: string;
};

export type QueryParameters = {
  start_date: string;
  end_date: string;
  lookback: string;
  codes: string[];
};

export type FactorQuery = QueryParameters & DslDocument & {
  dsl_source?: DslSource;
};

export type FactorReturnSpec = {
  kind: "simple" | "log";
  periods: number;
};

export type FactorAnalysisParameters = {
  codes_query: FactorQuery | null;
  dataset_query: FactorQuery;
  factor_columns: string[];
  return_columns: string[];
  return_specs: Record<string, FactorReturnSpec>;
  n_groups: number;
  n_select: number;
  preprocess: boolean;
  market_value_column: string;
};

export function isFactorQuery(value: unknown): value is FactorQuery {
  if (!isRecord(value)) return false;
  return typeof value.start_date === "string"
    && typeof value.end_date === "string"
    && typeof value.lookback === "string"
    && isStringArray(value.codes)
    && isStringArray(value.factors)
    && isRecord(value.derivatives)
    && isStringArray(value.filters)
    && (value.dsl_source === undefined || isDslSource(value.dsl_source));
}

export function isDslSource(value: unknown): value is DslSource {
  return isRecord(value)
    && (value.language === "json" || value.language === "python")
    && typeof value.json_source === "string"
    && typeof value.python_source === "string";
}

export function isFactorAnalysisParameters(value: unknown): value is FactorAnalysisParameters {
  if (!isRecord(value)) return false;
  return (value.codes_query === null || isFactorQuery(value.codes_query))
    && isFactorQuery(value.dataset_query)
    && isStringArray(value.factor_columns)
    && isStringArray(value.return_columns)
    && isReturnSpecs(value.return_specs, value.return_columns)
    && typeof value.n_groups === "number"
    && Number.isFinite(value.n_groups)
    && typeof value.n_select === "number"
    && Number.isInteger(value.n_select)
    && value.n_select >= 1
    && typeof value.preprocess === "boolean"
    && typeof value.market_value_column === "string";
}

export function canNormalizeFactorAnalysisParameters(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isFactorQuery(value.dataset_query)
    && (value.codes_query === null || isFactorQuery(value.codes_query));
}

export function hasCompleteReturnSpecs(parameters: FactorAnalysisParameters) {
  return isReturnSpecs(parameters.return_specs, parameters.return_columns);
}

export type StockPoolCode = "ALL" | "000016.SH" | "000300.SH" | "000905.SH" | "000852.SH";
type IndexStockPoolCode = Exclude<StockPoolCode, "ALL">;
export type StockPoolSelection = StockPoolCode | "CUSTOM";
export type PriceField = "close" | "close_hfq";
export type MarketValueField = "circ_mv" | "total_mv";

export type FactorAnalysisSettings = {
  stockPool: StockPoolSelection;
  priceField: PriceField;
  marketValueField: MarketValueField;
  nGroups: number;
  nSelect: number;
  maxLags: number;
};

export const stockPools: { label: string; value: StockPoolCode; factor: string | null }[] = [
  { label: "全市场", value: "ALL", factor: null },
  { label: "上证 50", value: "000016.SH", factor: "weight_000016SH" },
  { label: "沪深 300", value: "000300.SH", factor: "weight_000300SH" },
  { label: "中证 500", value: "000905.SH", factor: "weight_000905SH" },
  { label: "中证 1000", value: "000852.SH", factor: "weight_000852SH" }
];

export const priceFields: { label: string; value: PriceField }[] = [
  { label: "收盘价", value: "close" },
  { label: "后复权收盘价", value: "close_hfq" }
];

export const marketValueFields: { label: string; value: MarketValueField }[] = [
  { label: "流通市值", value: "circ_mv" },
  { label: "总市值", value: "total_mv" }
];

export const analysisReturnColumns = (maxLags: number) => Array.from({ length: maxLags }, (_, lag) => `ret${lag}`);
export const analysisManagedFactors = ["circ_mv", "total_mv"];

const oneDayLogReturnSpecs = (columns: string[]): Record<string, FactorReturnSpec> => Object.fromEntries(
  columns.map((column) => [column, { kind: "log", periods: 1 }])
);

export type FactorWorkflowSummary = {
  id: number;
  version: number;
  saved: boolean;
  workspace_id: number;
  workflow_instance_id: number | null;
  state: string;
  error: string | null;
  parameters: FactorAnalysisParameters;
  updated_at: string;
};

export type FactorMetricSummary = {
  return_kind?: "simple" | "log" | null;
  return_periods?: number | null;
  compoundable?: boolean | null;
  observations: number;
  ic_mean: number | null;
  ic_std: number | null;
  ic_ir: number | null;
  ic_positive_ratio: number | null;
  rank_ic_mean: number | null;
  rank_ic_std: number | null;
  rank_ic_ir: number | null;
  rank_ic_positive_ratio: number | null;
  long_short_cumulative_return: number | null;
  long_short_annual_return: number | null;
  long_short_annual_volatility: number | null;
  long_short_sharpe: number | null;
  long_short_max_drawdown: number | null;
};

export type FactorMetrics = Record<string, Record<string, FactorMetricSummary>>;

export type FactorProject = {
  id: number;
  title: string;
  latest_version: number | null;
  draft: FactorWorkflowSummary;
  created_at: string;
  updated_at: string;
};

export type FactorProjectListItem = {
  id: number;
  title: string;
  latest_version: number | null;
  latest_metric: FactorMetricSummary | null;
  updated_at: string;
};

export type FactorProjectSortField = "id" | "title" | "latest_version" | "ic_mean" | "rank_ic_mean" | "ic_ir" | "long_short_cumulative_return" | "long_short_annual_return" | "long_short_sharpe" | "updated_at";

export type FactorProjectPage = {
  all_total: number;
  items: FactorProjectListItem[];
  page: number;
  page_size: number;
  total: number;
};

export type FactorWorkflowSubmitted = {
  workspace_id: number;
  workflow_instance_id: number;
};

export type FactorVersion = {
  id: number;
  project_id: number;
  workflow_workspace_id: number;
  workflow_instance_id: number | null;
  version: number;
  saved: boolean;
  is_current: boolean;
  remark: string;
  parameters: FactorAnalysisParameters;
  metrics: FactorMetrics | null;
  created_at: string;
  updated_at: string;
};

export type FactorVersionListItem = Pick<FactorVersion, "id" | "version" | "saved" | "is_current" | "remark" | "workflow_instance_id" | "created_at">;

export type JsonSchema = {
  $defs?: Record<string, JsonSchema>;
  $ref?: string;
  anyOf?: JsonSchema[];
  const?: unknown;
  default?: unknown;
  description?: string;
  enum?: unknown[];
  items?: JsonSchema;
  maximum?: number;
  minimum?: number;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  title?: string;
  type?: string | string[];
};

export type DslOperator = {
  op: string;
  type: "DIRECT" | "TS" | "CS";
  output_kind: "BOOL" | "NUMBER" | "ANY";
  description: string;
  definition: JsonSchema;
};

export type DslCatalog = {
  factors: string[];
  operators: DslOperator[];
};

export type FactorOutput = {
  name: "processed_data" | "information_coefficient" | "group_returns";
  filename: string;
  size: number;
  modified_at: string;
};

export const stockPoolQuery = (stockPool: IndexStockPoolCode, startDate: string, endDate: string): FactorQuery => {
  const factor = stockPools.find((item) => item.value === stockPool)?.factor;
  if (!factor) throw new Error(`不支持的指数股票池：${stockPool}`);
  return {
    start_date: startDate,
    end_date: endDate,
    lookback: "P0D",
    codes: [],
    factors: [],
    derivatives: {
      stock_pool_member: {
        type: "DIRECT",
        op: "binary.gt",
        fields: { left: factor, right: 0 },
        params: {}
      }
    },
    filters: ["stock_pool_member"]
  };
};

export const stockPoolCode = (parameters: FactorAnalysisParameters): StockPoolSelection => {
  if (parameters.codes_query !== null && validAnalysisCodesQuery(parameters.codes_query)) {
    const codesFactor = managedStockPoolFactor(parameters.codes_query);
    const configured = stockPools.find((item) => item.factor !== null && item.factor === codesFactor)?.value;
    if (
      configured
      && parameters.codes_query.start_date === parameters.dataset_query.start_date
      && parameters.codes_query.end_date === parameters.dataset_query.end_date
      && parameters.dataset_query.codes.length === 0
    ) return configured;
  }
  if (
    parameters.codes_query === null
    && parameters.dataset_query.codes.length === 0
    && !("stock_pool_member" in parameters.dataset_query.derivatives)
    && !parameters.dataset_query.factors.includes("stock_pool_member")
    && !parameters.dataset_query.filters.includes("stock_pool_member")
  ) return "ALL";
  return "CUSTOM";
};

export const stockPoolLabel = (parameters: FactorAnalysisParameters): string => {
  const code = stockPoolCode(parameters);
  return code === "CUSTOM"
    ? "自定义股票池"
    : stockPools.find((item) => item.value === code)?.label ?? code;
};

export const analysisSettings = (parameters: FactorAnalysisParameters): FactorAnalysisSettings => ({
  stockPool: stockPoolCode(parameters),
  priceField: returnPriceField(parameters),
  marketValueField: parameters.market_value_column === "total_mv" ? "total_mv" : "circ_mv",
  nGroups: parameters.n_groups,
  nSelect: parameters.n_select,
  maxLags: Math.max(1, parameters.return_columns.filter((column) => /^ret\d+$/.test(column)).length || 10)
});

export const analysisDsl = (parameters: FactorAnalysisParameters): DslDocument => ({
  factors: parameters.dataset_query.factors.filter((factor) => !analysisManagedFactors.includes(factor) && !stockPools.some((pool) => pool.factor === factor)),
  derivatives: Object.fromEntries(Object.entries(parameters.dataset_query.derivatives).filter(([name]) => name !== "stock_pool_member" && !/^ret\d+$/.test(name) && !parameters.return_columns.includes(name))),
  filters: parameters.dataset_query.filters.filter((filter) => filter !== "stock_pool_member")
});

export const applyAnalysisSettings = (parameters: FactorAnalysisParameters, dsl: DslDocument, settings = analysisSettings(parameters)): FactorAnalysisParameters => {
  const configuredFactor = parameters.factor_columns.length === 1 ? parameters.factor_columns[0] : "";
  const outputs = new Set([...dsl.factors, ...Object.keys(dsl.derivatives)]);
  const factor = outputs.has(configuredFactor) ? configuredFactor : Object.keys(dsl.derivatives).at(-1) ?? dsl.factors.at(-1) ?? "";
  const customPool = settings.stockPool === "CUSTOM";
  const returnColumns = analysisReturnColumns(settings.maxLags);
  const datasetQuery = {
    ...parameters.dataset_query,
    codes: customPool ? parameters.dataset_query.codes : [],
    factors: [...dsl.factors],
    derivatives: {
      ...dsl.derivatives,
      ...forwardReturnDerivatives(settings.priceField, settings.maxLags)
    },
    filters: [...dsl.filters]
  };
  return {
    codes_query: settings.stockPool === "CUSTOM"
      ? parameters.codes_query
      : settings.stockPool === "ALL"
        ? null
        : stockPoolQuery(settings.stockPool, datasetQuery.start_date, datasetQuery.end_date),
    dataset_query: datasetQuery,
    factor_columns: factor ? [factor] : [],
    return_columns: returnColumns,
    return_specs: oneDayLogReturnSpecs(returnColumns),
    n_groups: settings.nGroups,
    n_select: settings.nSelect,
    preprocess: parameters.preprocess,
    market_value_column: settings.marketValueField
  };
};

export const defaultCodesQuery = (): FactorQuery => stockPoolQuery("000300.SH", "2020-01-01", "2026-01-01");

export const defaultAnalysisParameters = (): FactorAnalysisParameters => {
  const parameters: FactorAnalysisParameters = {
    codes_query: defaultCodesQuery(),
    dataset_query: {
      start_date: "2020-01-01",
      end_date: "2026-01-01",
      lookback: "P30D",
      codes: [],
      factors: [],
      derivatives: {
        momentum_20d: {
          type: "TS",
          op: "unary.pct_change",
          fields: { col: "close_hfq" },
          params: { periods: 20 }
        }
      },
      filters: []
    },
    factor_columns: [],
    return_columns: [],
    return_specs: {},
    n_groups: 5,
    n_select: 10,
    preprocess: true,
    market_value_column: "circ_mv"
  };
  return applyAnalysisSettings(parameters, analysisDsl(parameters), { stockPool: "000300.SH", priceField: "close_hfq", marketValueField: "circ_mv", nGroups: 5, nSelect: 10, maxLags: 10 });
};

export function normalizeAnalysisParameters(value: unknown): FactorAnalysisParameters {
  const defaults = defaultAnalysisParameters();
  if (isFactorAnalysisParameters(value)) {
    return structuredClone(value);
  }
  if (!canNormalizeFactorAnalysisParameters(value)) return defaults;

  const input = value as Record<string, unknown>;
  const datasetQuery = structuredClone(input.dataset_query as FactorQuery);
  const returnColumns = isStringArray(input.return_columns)
    ? [...input.return_columns]
    : [];
  const factorColumns = isStringArray(input.factor_columns)
    ? [...input.factor_columns]
    : [];
  const storedReturnSpecs = isRecord(input.return_specs)
    ? Object.fromEntries(Object.entries(input.return_specs).filter((entry): entry is [string, FactorReturnSpec] => isReturnSpec(entry[1])))
    : {};
  return {
    codes_query: input.codes_query === null
      ? null
      : structuredClone(input.codes_query as FactorQuery),
    dataset_query: datasetQuery,
    factor_columns: factorColumns,
    return_columns: returnColumns,
    return_specs: storedReturnSpecs,
    n_groups: typeof input.n_groups === "number" && Number.isFinite(input.n_groups) && input.n_groups >= 2
      ? input.n_groups
      : defaults.n_groups,
    n_select: validSelectionCount(input.n_select)
      ? input.n_select
      : defaults.n_select,
    preprocess: typeof input.preprocess === "boolean"
      ? input.preprocess
      : defaults.preprocess,
    market_value_column: typeof input.market_value_column === "string" && input.market_value_column.length > 0
      ? input.market_value_column
      : defaults.market_value_column
  };
}

function validSelectionCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function forwardReturnDerivatives(priceField: PriceField, maxLags: number): Record<string, DerivativeNode> {
  return Object.fromEntries(analysisReturnColumns(maxLags).map((name, lag) => [name, {
    type: "DIRECT",
    op: "unary.log",
    fields: {
      col: {
        type: "DIRECT",
        op: "binary.div",
        fields: { left: shift(priceField, -lag - 1), right: shift(priceField, -lag) },
        params: {}
      }
    },
    params: {}
  }]));
}

function shift(column: string, periods: number): DerivativeNode {
  return { type: "TS", op: "unary.shift", fields: { col: column }, params: { periods } };
}

function returnPriceField(parameters: FactorAnalysisParameters): PriceField {
  const returnNode = parameters.dataset_query.derivatives.ret0;
  const division = isRecord(returnNode) && isRecord(returnNode.fields) ? returnNode.fields.col : undefined;
  const shiftedPrice = isRecord(division) && isRecord(division.fields) ? division.fields.left : undefined;
  return isRecord(shiftedPrice) && isRecord(shiftedPrice.fields) && shiftedPrice.fields.col === "close" ? "close" : "close_hfq";
}

function isReturnSpecs(value: unknown, returnColumns: string[]): value is Record<string, FactorReturnSpec> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== returnColumns.length || keys.some((key) => !returnColumns.includes(key))) return false;
  return keys.every((key) => isReturnSpec(value[key]));
}

function isReturnSpec(value: unknown): value is FactorReturnSpec {
  return isRecord(value)
    && (value.kind === "simple" || value.kind === "log")
    && typeof value.periods === "number"
    && Number.isInteger(value.periods)
    && value.periods >= 1;
}

function validAnalysisCodesQuery(value: unknown): value is FactorQuery {
  if (!isFactorQuery(value)) return false;
  const derivativeNames = Object.keys(value.derivatives);
  return [
    isZeroLookback(value.lookback),
    value.codes.length === 0,
    value.factors.length === 0,
    derivativeNames.length === 1,
    derivativeNames[0] === "stock_pool_member",
    value.filters.length === 1,
    value.filters[0] === "stock_pool_member",
    managedStockPoolFactor(value) !== null
  ].every(Boolean);
}

function managedStockPoolFactor(query: FactorQuery): string | null {
  const member = query.derivatives.stock_pool_member;
  if (!isRecord(member) || !isRecord(member.fields) || !isRecord(member.params)) return null;
  const fieldNames = Object.keys(member.fields);
  const factor = member.fields.left;
  return member.type === "DIRECT"
    && member.op === "binary.gt"
    && fieldNames.length === 2
    && fieldNames.includes("left")
    && fieldNames.includes("right")
    && member.fields.right === 0
    && Object.keys(member.params).length === 0
    && typeof factor === "string"
    && stockPools.some((pool) => pool.factor === factor)
    ? factor
    : null;
}

function isZeroLookback(value: string) {
  return value === "P0D" || value === "PT0S";
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isStringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
