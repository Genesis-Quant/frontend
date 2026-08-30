import studentTCdf from "@stdlib/stats-base-dists-t-cdf";

import { BrowserDuckDb, duckDbDateValue } from "@/assets/lib/duckdb";
import type { FactorAnalysisParameters, FactorMetricSummary, FactorMetrics } from "@/types/factor";

export type InformationPoint = { time: string; ic: number | null; rankIc: number | null; icCumulative: number | null; rankIcCumulative: number | null };
export type LongShortPoint = { time: string; value: number | null; cumulative: number | null };
export type GroupPoint = { time: string; values: Record<string, number | null> };
export type GroupStatistic = { group: string; mean: number | null; pValue: number | null };
export type DecayPoint = { returnColumn: string; label: string; position: number; icMean: number | null; rankIcMean: number | null };
export type FactorDateRange = { start: string; end: string };
export type FactorDiagnosticSummary = {
  dates: number;
  averageFactorCoverage: number | null;
  averagePairedCoverage: number | null;
  minimumPairedCount: number | null;
  minimumOccupiedGroupCount: number | null;
  minimumGroupSize: number | null;
  groupMinimum: number | null;
  groupMaximum: number | null;
};

export class FactorAnalytics {
  private constructor(
    private readonly database: BrowserDuckDb,
    private readonly informationFile: string,
    private readonly groupsFile: string,
    private readonly diagnosticsFile: string | null,
    private readonly parameters: FactorAnalysisParameters,
    private readonly groupColumns: Set<string>
  ) {}

  static async create(
    workflowInstanceId: number,
    files: { information: ArrayBuffer; groups: ArrayBuffer; diagnostics?: ArrayBuffer | null },
    parameters: FactorAnalysisParameters
  ) {
    const informationFile = `factor-${workflowInstanceId}-information.parquet`;
    const groupsFile = `factor-${workflowInstanceId}-groups.parquet`;
    const diagnosticsFile = files.diagnostics ? `factor-${workflowInstanceId}-diagnostics.parquet` : null;
    const registeredFiles: Record<string, ArrayBuffer> = {
      [informationFile]: files.information,
      [groupsFile]: files.groups
    };
    if (diagnosticsFile && files.diagnostics) registeredFiles[diagnosticsFile] = files.diagnostics;
    const database = await BrowserDuckDb.create(registeredFiles);
    const schema = await database.rows(`DESCRIBE SELECT * FROM read_parquet(${literal(groupsFile)})`);
    const groupColumns = new Set(schema.map((row) => String(row.column_name)));
    return new FactorAnalytics(database, informationFile, groupsFile, diagnosticsFile, parameters, groupColumns);
  }

  async metrics(): Promise<FactorMetrics> {
    const metrics: FactorMetrics = {};
    const rows = await this.rows(factorMetricsSql(
      this.informationFile,
      this.groupsFile,
      this.parameters.factor_columns,
      this.parameters.return_columns,
      this.parameters.return_specs,
      this.parameters.n_groups,
      this.groupColumns
    ));
    for (const row of rows) {
      const factor = String(row.factor_name);
      const returnColumn = String(row.return_column);
      if (!metrics[factor]) metrics[factor] = {};
      metrics[factor][returnColumn] = metricSummary(row, row);
    }
    return metrics;
  }

  async dateRange(factor: string, returnColumn: string): Promise<FactorDateRange> {
    const ic = identifier(`${factor}_${returnColumn}_ic`);
    const rank = identifier(`${factor}_${returnColumn}_rank_ic`);
    const row = (await this.rows(`SELECT min(time) AS start_time, max(time) AS end_time FROM read_parquet(${literal(this.informationFile)}) WHERE ${ic} IS NOT NULL OR ${rank} IS NOT NULL`))[0] ?? {};
    return { start: duckDbDateValue(row.start_time), end: duckDbDateValue(row.end_time) };
  }

  async informationSeries(factor: string, returnColumn: string, range?: FactorDateRange): Promise<InformationPoint[]> {
    const ic = identifier(`${factor}_${returnColumn}_ic`);
    const rank = identifier(`${factor}_${returnColumn}_rank_ic`);
    const rows = await this.rows(`
      SELECT time, ${ic} AS ic, ${rank} AS rank_ic,
        sum(${ic}) OVER (ORDER BY time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ic_cumulative,
        sum(${rank}) OVER (ORDER BY time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rank_ic_cumulative
      FROM read_parquet(${literal(this.informationFile)})
      ${dateFilter(range)}
      ORDER BY time
    `);
    return rows.map((row) => ({
      time: duckDbDateValue(row.time),
      ic: numberValue(row.ic),
      rankIc: numberValue(row.rank_ic),
      icCumulative: numberValue(row.ic_cumulative),
      rankIcCumulative: numberValue(row.rank_ic_cumulative)
    }));
  }

  async longShortSeries(factor: string, returnColumn: string, nGroups: number, range?: FactorDateRange): Promise<LongShortPoint[]> {
    const [lowColumn, highColumn] = endpointColumnNames(this.groupColumns, factor, returnColumn, nGroups);
    const low = identifier(lowColumn);
    const high = identifier(highColumn);
    const spec = this.returnSpec(returnColumn);
    const realized = spec.kind === "log" ? "exp(raw_value) - 1" : "raw_value";
    const cumulative = spec.periods !== 1
      ? "NULL::DOUBLE"
      : spec.kind === "log"
        ? "exp(sum(raw_value) OVER (ORDER BY time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) - 1"
        : "exp(sum(ln(1 + raw_value)) OVER (ORDER BY time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) - 1";
    const rows = await this.rows(`
      WITH daily AS (
        SELECT time, ${high} - ${low} AS raw_value
        FROM read_parquet(${literal(this.groupsFile)})
        ${dateFilter(range)}
      )
      SELECT time, ${realized} AS value,
        ${cumulative} AS cumulative
      FROM daily
      ORDER BY time
    `);
    return rows.map((row) => ({ time: duckDbDateValue(row.time), value: numberValue(row.value), cumulative: numberValue(row.cumulative) }));
  }

  async groupSeries(factor: string, returnColumn: string, nGroups: number, range?: FactorDateRange): Promise<GroupPoint[]> {
    const spec = this.returnSpec(returnColumn);
    const definitions = groupDefinitions(this.groupColumns, factor, returnColumn, nGroups, this.parameters.n_select);
    const columns = definitions.map((definition, index) => {
      const source = identifier(definition.column);
      const cumulative = spec.periods !== 1
        ? "NULL::DOUBLE"
        : spec.kind === "log"
          ? `exp(sum(${source}) OVER (ORDER BY time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW))`
          : `exp(sum(ln(1 + ${source})) OVER (ORDER BY time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW))`;
      return `${cumulative} AS ${identifier(`series_${index}`)}`;
    });
    const rows = await this.rows(`SELECT time, ${columns.join(", ")} FROM read_parquet(${literal(this.groupsFile)}) ${dateFilter(range)} ORDER BY time`);
    return rows.map((row) => ({
      time: duckDbDateValue(row.time),
      values: Object.fromEntries(definitions.map((definition, index) => [definition.label, numberValue(row[`series_${index}`])]))
    }));
  }

  async groupStatistics(factor: string, returnColumn: string, nGroups: number, range?: FactorDateRange): Promise<GroupStatistic[]> {
    const spec = this.returnSpec(returnColumn);
    const definitions = groupDefinitions(this.groupColumns, factor, returnColumn, nGroups, this.parameters.n_select);
    const statements = definitions.map((definition) => {
      const source = identifier(definition.column);
      const realized = spec.kind === "log" ? `exp(${source}) - 1` : source;
      return `SELECT ${literal(definition.label)} AS group_name, count(${source}) AS observations, avg(${realized}) AS mean, stddev_samp(${realized}) AS std FROM read_parquet(${literal(this.groupsFile)}) ${dateFilter(range)}`;
    });
    const rows = await this.rows(statements.join(" UNION ALL "));
    return rows.map((row) => {
      const observations = integerValue(row.observations);
      const mean = numberValue(row.mean);
      const deviation = numberValue(row.std);
      const standardError = deviation === null || observations < 3 ? null : deviation / Math.sqrt(observations);
      const statistic = mean === null || standardError === null || standardError <= 0 ? null : Math.abs(mean / standardError);
      return {
        group: String(row.group_name),
        mean,
        pValue: statistic === null ? null : 2 * (1 - studentTCdf(statistic, observations - 1))
      };
    });
  }

  async decay(factor: string, returnColumns: string[], range?: FactorDateRange): Promise<DecayPoint[]> {
    const columns = returnColumns.flatMap((returnColumn, index) => {
      const ic = identifier(`${factor}_${returnColumn}_ic`);
      const rank = identifier(`${factor}_${returnColumn}_rank_ic`);
      return [`avg(${ic}) AS ${identifier(`ic_${index}`)}`, `avg(${rank}) AS ${identifier(`rank_ic_${index}`)}`];
    });
    const row = (await this.rows(`SELECT ${columns.join(", ")} FROM read_parquet(${literal(this.informationFile)}) ${dateFilter(range)}`))[0] ?? {};
    return returnColumns.map((returnColumn, index) => ({
      returnColumn,
      label: returnColumn,
      position: index,
      icMean: numberValue(row[`ic_${index}`]),
      rankIcMean: numberValue(row[`rank_ic_${index}`])
    }));
  }

  async diagnosticSummary(factor: string, returnColumn: string, range?: FactorDateRange): Promise<FactorDiagnosticSummary | null> {
    if (!this.diagnosticsFile) return null;
    const filters = [
      `factor = ${literal(factor)}`,
      `return_column = ${literal(returnColumn)}`
    ];
    if (range && /^\d{4}-\d{2}-\d{2}$/.test(range.start) && /^\d{4}-\d{2}-\d{2}$/.test(range.end)) {
      filters.push(`time BETWEEN DATE ${literal(range.start)} AND DATE ${literal(range.end)}`);
    }
    const row = (await this.rows(`
      SELECT
        count(*) AS dates,
        avg(CASE WHEN universe_count > 0 THEN factor_valid_count::DOUBLE / universe_count END) AS average_factor_coverage,
        avg(CASE WHEN universe_count > 0 THEN paired_valid_count::DOUBLE / universe_count END) AS average_paired_coverage,
        min(paired_valid_count) AS minimum_paired_count,
        min(occupied_group_count) AS minimum_occupied_group_count,
        min(min_group_size) AS minimum_group_size,
        min(group_min) AS group_minimum,
        max(group_max) AS group_maximum
      FROM read_parquet(${literal(this.diagnosticsFile)})
      WHERE ${filters.join(" AND ")}
    `))[0];
    if (!row || integerValue(row.dates) === 0) return null;
    return {
      dates: integerValue(row.dates),
      averageFactorCoverage: numberValue(row.average_factor_coverage),
      averagePairedCoverage: numberValue(row.average_paired_coverage),
      minimumPairedCount: nullableIntegerValue(row.minimum_paired_count),
      minimumOccupiedGroupCount: nullableIntegerValue(row.minimum_occupied_group_count),
      minimumGroupSize: nullableIntegerValue(row.minimum_group_size),
      groupMinimum: nullableIntegerValue(row.group_minimum),
      groupMaximum: nullableIntegerValue(row.group_maximum)
    };
  }

  async close() {
    await this.database.close();
  }

  private async rows(sql: string): Promise<Record<string, unknown>[]> {
    return this.database.rows(sql);
  }

  private returnSpec(returnColumn: string) {
    return this.parameters.return_specs[returnColumn];
  }
}

function factorMetricsSql(
  informationFile: string,
  groupsFile: string,
  factors: string[],
  returnColumns: string[],
  returnSpecs: FactorAnalysisParameters["return_specs"],
  nGroups: number,
  groupColumns: Set<string>
) {
  const pairs = factors.flatMap((factor) => returnColumns.map((returnColumn) => ({ factor, returnColumn })));
  const information = pairs.map(({ factor, returnColumn }) => `SELECT ${literal(factor)} AS factor_name, ${literal(returnColumn)} AS return_column, ${identifier(`${factor}_${returnColumn}_ic`)} AS ic, ${identifier(`${factor}_${returnColumn}_rank_ic`)} AS rank_ic FROM read_parquet(${literal(informationFile)})`).join(" UNION ALL ");
  const returns = pairs.map(({ factor, returnColumn }) => {
    const [lowColumn, highColumn] = endpointColumnNames(groupColumns, factor, returnColumn, nGroups);
    const low = identifier(lowColumn);
    const high = identifier(highColumn);
    const spec = returnSpecs[returnColumn];
    const spread = `${high} - ${low}`;
    const value = spec.kind === "log" ? `exp(${spread}) - 1` : spread;
    return `SELECT ${literal(factor)} AS factor_name, ${literal(returnColumn)} AS return_column, time, ${value} AS value, ${spec.periods === 1 ? "true" : "false"} AS eligible FROM read_parquet(${literal(groupsFile)}) WHERE ${high} IS NOT NULL AND ${low} IS NOT NULL`;
  }).join(" UNION ALL ");
  return `
    WITH information_values AS (${information}),
    information_metrics AS (
      SELECT factor_name, return_column, count(ic) AS observations, avg(ic) AS ic_mean, stddev_samp(ic) AS ic_std,
        avg(ic) / nullif(stddev_samp(ic), 0) AS ic_ir,
        count_if(ic > 0)::DOUBLE / nullif(count(ic), 0) AS ic_positive_ratio,
        avg(rank_ic) AS rank_ic_mean, stddev_samp(rank_ic) AS rank_ic_std,
        avg(rank_ic) / nullif(stddev_samp(rank_ic), 0) AS rank_ic_ir,
        count_if(rank_ic > 0)::DOUBLE / nullif(count(rank_ic), 0) AS rank_ic_positive_ratio
      FROM information_values GROUP BY factor_name, return_column
    ), nav AS (
      SELECT *, exp(sum(ln(1 + value)) OVER (PARTITION BY factor_name, return_column ORDER BY time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) AS wealth
      FROM (${returns}) WHERE eligible
    ), drawdown AS (
      SELECT *, wealth / nullif(max(wealth) OVER (PARTITION BY factor_name, return_column ORDER BY time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 0) - 1 AS drawdown
      FROM nav
    ), return_summary AS (
      SELECT factor_name, return_column, count(value) AS return_observations, exp(sum(ln(1 + value))) AS growth,
        stddev_pop(value) * sqrt(252.0) AS annual_volatility, abs(min(drawdown)) AS max_drawdown
      FROM drawdown GROUP BY factor_name, return_column
    )
    SELECT information_metrics.*, return_summary.return_observations, return_summary.growth - 1 AS cumulative_return,
      power(return_summary.growth, 252.0 / return_summary.return_observations) - 1 AS annual_return,
      return_summary.annual_volatility,
      CASE WHEN return_summary.annual_volatility > 0 THEN (power(return_summary.growth, 252.0 / return_summary.return_observations) - 1) / return_summary.annual_volatility END AS sharpe,
      return_summary.max_drawdown
    FROM information_metrics LEFT JOIN return_summary USING (factor_name, return_column)
  `;
}

function endpointColumnNames(groupColumns: Set<string>, factor: string, returnColumn: string, nGroups: number): [string, string] {
  const bottom = `${factor}_${returnColumn}_bottom`;
  const top = `${factor}_${returnColumn}_top`;
  return groupColumns.has(bottom) && groupColumns.has(top)
    ? [bottom, top]
    : [`${factor}_${returnColumn}_group0`, `${factor}_${returnColumn}_group${nGroups - 1}`];
}

function groupDefinitions(groupColumns: Set<string>, factor: string, returnColumn: string, nGroups: number, nSelect: number) {
  const groups = Array.from({ length: nGroups }, (_, group) => ({
    column: `${factor}_${returnColumn}_group${group}`,
    label: `Group ${group + 1}`
  }));
  const bottom = `${factor}_${returnColumn}_bottom`;
  const top = `${factor}_${returnColumn}_top`;
  return groupColumns.has(bottom) && groupColumns.has(top)
    ? [
      { column: bottom, label: `最小 ${nSelect} 支` },
      ...groups,
      { column: top, label: `最大 ${nSelect} 支` }
    ]
    : groups;
}

function metricSummary(information: Record<string, unknown>, longShort: Record<string, unknown>): FactorMetricSummary {
  return {
    observations: integerValue(information.observations),
    ic_mean: numberValue(information.ic_mean), ic_std: numberValue(information.ic_std), ic_ir: numberValue(information.ic_ir), ic_positive_ratio: numberValue(information.ic_positive_ratio),
    rank_ic_mean: numberValue(information.rank_ic_mean), rank_ic_std: numberValue(information.rank_ic_std), rank_ic_ir: numberValue(information.rank_ic_ir), rank_ic_positive_ratio: numberValue(information.rank_ic_positive_ratio),
    long_short_cumulative_return: numberValue(longShort.cumulative_return), long_short_annual_return: numberValue(longShort.annual_return),
    long_short_annual_volatility: numberValue(longShort.annual_volatility), long_short_sharpe: numberValue(longShort.sharpe), long_short_max_drawdown: numberValue(longShort.max_drawdown)
  };
}

function identifier(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function literal(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function numberValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerValue(value: unknown) {
  return Math.max(0, Math.trunc(numberValue(value) ?? 0));
}

function nullableIntegerValue(value: unknown) {
  const number = numberValue(value);
  return number === null ? null : Math.trunc(number);
}

function dateFilter(range?: FactorDateRange) {
  if (!range || !/^\d{4}-\d{2}-\d{2}$/.test(range.start) || !/^\d{4}-\d{2}-\d{2}$/.test(range.end)) return "";
  return `WHERE time BETWEEN DATE ${literal(range.start)} AND DATE ${literal(range.end)}`;
}
