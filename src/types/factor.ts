import { initialDslSource } from "@/assets/lib/dslSource";

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

export type DslCompilation = {
  sourceKey: string;
  document: DslDocument;
};

export type QueryParameters = {
  start_date: string;
  end_date: string;
  lookback: string;
  codes: string[];
};

export type FactorQuery = QueryParameters & DslDocument & {
  dsl_source: DslSource;
};

export type FactorReturnSpec = {
  kind: "simple" | "log";
  periods: number;
};

export type IndustryField = "industry" | "industry_l0" | "industry_l1" | "industry_l2" | "industry_l3";

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
  industry_column: IndustryField;
};

export type FactorReportParameters = Pick<
  FactorAnalysisParameters,
  "factor_columns" | "return_columns" | "return_specs" | "n_groups" | "n_select"
>;

export function isFactorQuery(value: unknown): value is FactorQuery {
  if (!isRecord(value)) return false;
  return typeof value.start_date === "string"
    && typeof value.end_date === "string"
    && typeof value.lookback === "string"
    && isStringArray(value.codes)
    && isStringArray(value.factors)
    && isRecord(value.derivatives)
    && isStringArray(value.filters)
    && isDslSource(value.dsl_source);
}

function isDslSource(value: unknown): value is DslSource {
  return isRecord(value)
    && (value.language === "json" || value.language === "python")
    && typeof value.json_source === "string"
    && typeof value.python_source === "string";
}

export function isFactorAnalysisParameters(value: unknown): value is FactorAnalysisParameters {
  return isFactorAnalysisDraftParameters(value)
    && isNonEmptyUniqueStringArray(value.factor_columns)
    && isNonEmptyUniqueStringArray(value.return_columns)
    && isReturnSpecs(value.return_specs, value.return_columns);
}

export function isFactorAnalysisDraftParameters(value: unknown): value is FactorAnalysisParameters {
  if (!isRecord(value)) return false;
  return (value.codes_query === null || isFactorQuery(value.codes_query))
    && isFactorQuery(value.dataset_query)
    && isStringArray(value.factor_columns)
    && isStringArray(value.return_columns)
    && isReturnSpecs(value.return_specs, value.return_columns)
    && isIntegerAtLeast(value.n_groups, 2)
    && isIntegerAtLeast(value.n_select, 1)
    && typeof value.preprocess === "boolean"
    && isNonEmptyString(value.market_value_column)
    && isIndustryField(value.industry_column);
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
  industryField: IndustryField;
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

export const industryFields: { label: string; value: IndustryField }[] = [
  { label: "静态行业（industry）", value: "industry" },
  { label: "自定义 11 类（industry_l0）", value: "industry_l0" },
  { label: "申万一级（industry_l1）", value: "industry_l1" },
  { label: "申万二级（industry_l2）", value: "industry_l2" },
  { label: "申万三级（industry_l3）", value: "industry_l3" }
];

const analysisReturnColumns = (maxLags: number) => Array.from({ length: maxLags }, (_, lag) => `ret${lag}`);
const analysisManagedFactors = [
  "circ_mv",
  "total_mv",
  ...industryFields.map((field) => field.value)
];

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
  parameters: unknown;
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
  average_turnover?: number | null;
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

export type FactorProjectSortField = "id" | "title" | "latest_version" | "ic_mean" | "rank_ic_mean" | "ic_ir" | "rank_ic_ir" | "long_short_cumulative_return" | "long_short_annual_return" | "long_short_sharpe" | "average_turnover" | "updated_at";

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
  parameters: unknown;
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
  name: "processed_data" | "execution_statistics" | "information_coefficient" | "group_returns" | "group_turnover";
  filename: string;
  size: number;
  modified_at: string;
};

const stockPoolQuery = (stockPool: IndexStockPoolCode, startDate: string, endDate: string): FactorQuery => {
  const factor = stockPools.find((item) => item.value === stockPool)?.factor;
  if (!factor) throw new Error(`不支持的指数股票池：${stockPool}`);
  const dsl: DslDocument = {
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
  return {
    start_date: startDate,
    end_date: endDate,
    lookback: "P0D",
    codes: [],
    ...dsl,
    dsl_source: initialDslSource(dsl)
  };
};

const stockPoolCode = (parameters: FactorAnalysisParameters): StockPoolSelection => {
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
  industryField: parameters.industry_column,
  nGroups: parameters.n_groups,
  nSelect: parameters.n_select,
  maxLags: Math.max(1, parameters.return_columns.filter((column) => /^ret\d+$/.test(column)).length || 10)
});

export const analysisDsl = (parameters: FactorAnalysisParameters): DslDocument => ({
  factors: parameters.dataset_query.factors.filter((factor) => !analysisManagedFactors.includes(factor) && !stockPools.some((pool) => pool.factor === factor)),
  derivatives: Object.fromEntries(Object.entries(parameters.dataset_query.derivatives).filter(([name]) => name !== "stock_pool_member" && !/^ret\d+$/.test(name) && !parameters.return_columns.includes(name))),
  filters: parameters.dataset_query.filters.filter((filter) => filter !== "stock_pool_member")
});

export const setAnalysisStockPool = (parameters: FactorAnalysisParameters, stockPool: StockPoolCode): FactorAnalysisParameters => ({
  ...parameters,
  codes_query: stockPool === "ALL"
    ? null
    : stockPoolQuery(stockPool, parameters.dataset_query.start_date, parameters.dataset_query.end_date),
  dataset_query: { ...parameters.dataset_query, codes: [] }
});

export const setAnalysisReturns = (parameters: FactorAnalysisParameters, priceField: PriceField, maxLags: number): FactorAnalysisParameters => {
  const previousReturns = new Set(parameters.return_columns);
  const derivatives = Object.fromEntries(
    Object.entries(parameters.dataset_query.derivatives).filter(([name]) => !previousReturns.has(name))
  );
  const returnColumns = analysisReturnColumns(maxLags);
  return {
    ...parameters,
    dataset_query: {
      ...parameters.dataset_query,
      derivatives: {
        ...derivatives,
        ...forwardReturnDerivatives(priceField, maxLags)
      }
    },
    return_columns: returnColumns,
    return_specs: oneDayLogReturnSpecs(returnColumns)
  };
};

export const setAnalysisDsl = (parameters: FactorAnalysisParameters, dsl: DslDocument, source: DslSource): FactorAnalysisParameters => {
  const returnDerivatives = Object.fromEntries(
    parameters.return_columns.flatMap((name) => {
      const derivative = parameters.dataset_query.derivatives[name];
      return derivative === undefined ? [] : [[name, derivative]];
    })
  );
  return {
    ...parameters,
    dataset_query: {
      ...parameters.dataset_query,
      factors: [...dsl.factors],
      derivatives: { ...returnDerivatives, ...dsl.derivatives },
      filters: [...dsl.filters],
      dsl_source: source
    },
    factor_columns: Object.keys(dsl.derivatives).slice(-1)
  };
};

export const analysisExecutionParameters = (parameters: FactorAnalysisParameters, document: DslDocument): FactorAnalysisParameters => {
  if (parameters.factor_columns.length > 0) return parameters;
  const factor = Object.keys(document.derivatives).at(-1);
  return factor === undefined ? parameters : { ...parameters, factor_columns: [factor] };
};

const defaultCodesQuery = (): FactorQuery => stockPoolQuery("000300.SH", "2020-01-01", "2026-01-01");

export const defaultAnalysisParameters = (): FactorAnalysisParameters => {
  const dsl: DslDocument = {
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
  };
  const parameters: FactorAnalysisParameters = {
    codes_query: defaultCodesQuery(),
    dataset_query: {
      start_date: "2020-01-01",
      end_date: "2026-01-01",
      lookback: "P30D",
      codes: [],
      factors: [...dsl.factors],
      derivatives: {
        ...dsl.derivatives,
        ...forwardReturnDerivatives("close_hfq", 10)
      },
      filters: [...dsl.filters],
      dsl_source: initialDslSource(dsl)
    },
    factor_columns: ["momentum_20d"],
    return_columns: analysisReturnColumns(10),
    return_specs: oneDayLogReturnSpecs(analysisReturnColumns(10)),
    n_groups: 5,
    n_select: 10,
    preprocess: true,
    market_value_column: "circ_mv",
    industry_column: "industry"
  };
  return parameters;
};

export function requireFactorAnalysisParameters(value: unknown): FactorAnalysisParameters {
  const issues = factorAnalysisParameterIssues(value);
  if (issues.length || !isFactorAnalysisParameters(value)) throw new Error(`因子分析参数不可执行：${issues.join("；")}`);
  return structuredClone(value);
}

export function factorReportParameters(value: unknown): FactorReportParameters | null {
  if (factorReportParameterIssues(value).length || !isRecord(value)) return null;
  return structuredClone({
    factor_columns: value.factor_columns,
    return_columns: value.return_columns,
    return_specs: value.return_specs,
    n_groups: value.n_groups,
    n_select: value.n_select
  }) as FactorReportParameters;
}

export function requireFactorReportParameters(value: unknown): FactorReportParameters {
  const issues = factorReportParameterIssues(value);
  if (issues.length) throw new Error(`因子分析结果参数不完整：${issues.join("；")}`);
  return factorReportParameters(value)!;
}

export function factorAnalysisParameterIssues(value: unknown): string[] {
  if (!isRecord(value)) return ["参数必须是对象"];
  const issues = [
    ...factorQueryIssues(value.codes_query, "codes_query", true),
    ...factorQueryIssues(value.dataset_query, "dataset_query", false),
    ...factorReportParameterIssues(value)
  ];
  if (typeof value.preprocess !== "boolean") issues.push("preprocess 必须是布尔值");
  if (!isNonEmptyString(value.market_value_column)) issues.push("market_value_column 必须是非空字符串");
  if (!isIndustryField(value.industry_column)) issues.push("industry_column 缺失或不受支持");
  return issues;
}

export function factorAnalysisParameterError(value: unknown): string | null {
  const issues = factorAnalysisParameterIssues(value);
  return issues.length ? `该记录的参数不可再次执行：${issues.join("；")}。原始参数和历史结果未被修改。` : null;
}

export function factorReportParameterIssues(value: unknown): string[] {
  if (!isRecord(value)) return ["参数必须是对象"];
  const issues: string[] = [];
  if (!isNonEmptyUniqueStringArray(value.factor_columns)) issues.push("factor_columns 必须是非空且不重复的字符串数组");
  if (!isNonEmptyUniqueStringArray(value.return_columns)) {
    issues.push("return_columns 必须是非空且不重复的字符串数组");
  } else if (!isReturnSpecs(value.return_specs, value.return_columns)) {
    issues.push("return_specs 必须完整对应 return_columns");
  }
  if (!isIntegerAtLeast(value.n_groups, 2)) issues.push("n_groups 必须是至少为 2 的整数");
  if (!isIntegerAtLeast(value.n_select, 1)) issues.push("n_select 必须是至少为 1 的整数");
  return issues;
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
function isNonEmptyString(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function isIntegerAtLeast(value: unknown, minimum: number): value is number { return typeof value === "number" && Number.isInteger(value) && value >= minimum; }
function isStringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
function isNonEmptyUniqueStringArray(value: unknown): value is string[] {
  return isStringArray(value)
    && value.length > 0
    && value.every((item) => item.length > 0)
    && new Set(value).size === value.length;
}

function factorQueryIssues(value: unknown, path: string, nullable: boolean): string[] {
  if (nullable && value === null) return [];
  if (!isRecord(value)) return [`${path} 必须是${nullable ? " null 或" : ""}完整查询对象`];
  const issues: string[] = [];
  if (typeof value.start_date !== "string") issues.push(`${path}.start_date 必须是字符串`);
  if (typeof value.end_date !== "string") issues.push(`${path}.end_date 必须是字符串`);
  if (typeof value.lookback !== "string") issues.push(`${path}.lookback 必须是字符串`);
  if (!isStringArray(value.codes)) issues.push(`${path}.codes 必须是字符串数组`);
  if (!isStringArray(value.factors)) issues.push(`${path}.factors 必须是字符串数组`);
  if (!isRecord(value.derivatives)) issues.push(`${path}.derivatives 必须是对象`);
  if (!isStringArray(value.filters)) issues.push(`${path}.filters 必须是字符串数组`);
  if (!isDslSource(value.dsl_source)) issues.push(`${path}.dsl_source 缺少完整 JSON/Python 双源码`);
  return issues;
}
function isIndustryField(value: unknown): value is IndustryField { return industryFields.some((field) => field.value === value); }
