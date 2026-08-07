import { BrowserDuckDb } from "@/assets/lib/duckdb";
import type { FactorAnalysisParameters, FactorMetricSummary, FactorMetrics } from "@/types/factor";

export type InformationPoint = { time: string; ic: number | null; rankIc: number | null; icCumulative: number | null; rankIcCumulative: number | null };
export type LongShortPoint = { time: string; value: number | null; cumulative: number | null };
export type GroupPoint = { time: string; values: Record<string, number | null> };
export type GroupStatistic = { group: string; mean: number | null; pValue: number | null };
export type DecayPoint = { returnColumn: string; label: string; position: number; icMean: number | null; rankIcMean: number | null };
export type FactorDateRange = { start: string; end: string };

export class FactorAnalytics {
  private constructor(
    private readonly database: BrowserDuckDb,
    private readonly informationFile: string,
    private readonly groupsFile: string
  ) {}

  static async create(workflowInstanceId: number, files: { information: ArrayBuffer; groups: ArrayBuffer }) {
    const informationFile = `factor-${workflowInstanceId}-information.parquet`;
    const groupsFile = `factor-${workflowInstanceId}-groups.parquet`;
    const database = await BrowserDuckDb.create({ [informationFile]: files.information, [groupsFile]: files.groups });
    return new FactorAnalytics(database, informationFile, groupsFile);
  }

  async metrics(parameters: FactorAnalysisParameters): Promise<FactorMetrics> {
    const metrics: FactorMetrics = {};
    const rows = await this.rows(factorMetricsSql(this.informationFile, this.groupsFile, parameters.factor_columns, parameters.return_columns, parameters.n_groups));
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
    return { start: dateValue(row.start_time), end: dateValue(row.end_time) };
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
      time: dateValue(row.time),
      ic: numberValue(row.ic),
      rankIc: numberValue(row.rank_ic),
      icCumulative: numberValue(row.ic_cumulative),
      rankIcCumulative: numberValue(row.rank_ic_cumulative)
    }));
  }

  async longShortSeries(factor: string, returnColumn: string, nGroups: number, range?: FactorDateRange): Promise<LongShortPoint[]> {
    const low = identifier(`${factor}_${returnColumn}_group0`);
    const high = identifier(`${factor}_${returnColumn}_group${nGroups - 1}`);
    const rows = await this.rows(`
      WITH daily AS (
        SELECT time, ${high} - ${low} AS value
        FROM read_parquet(${literal(this.groupsFile)})
        ${dateFilter(range)}
      )
      SELECT time, value,
        exp(sum(ln(1 + value)) OVER (ORDER BY time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) - 1 AS cumulative
      FROM daily
      ORDER BY time
    `);
    return rows.map((row) => ({ time: dateValue(row.time), value: numberValue(row.value), cumulative: numberValue(row.cumulative) }));
  }

  async groupSeries(factor: string, returnColumn: string, nGroups: number, range?: FactorDateRange): Promise<GroupPoint[]> {
    const columns = Array.from({ length: nGroups }, (_, group) => {
      const source = identifier(`${factor}_${returnColumn}_group${group}`);
      return `exp(sum(ln(1 + ${source})) OVER (ORDER BY time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) AS ${identifier(`group_${group + 1}`)}`;
    });
    const rows = await this.rows(`SELECT time, ${columns.join(", ")} FROM read_parquet(${literal(this.groupsFile)}) ${dateFilter(range)} ORDER BY time`);
    return rows.map((row) => ({
      time: dateValue(row.time),
      values: Object.fromEntries(Array.from({ length: nGroups }, (_, group) => [`Group ${group + 1}`, numberValue(row[`group_${group + 1}`])]))
    }));
  }

  async groupStatistics(factor: string, returnColumn: string, nGroups: number, range?: FactorDateRange): Promise<GroupStatistic[]> {
    const statements = Array.from({ length: nGroups }, (_, group) => {
      const source = identifier(`${factor}_${returnColumn}_group${group}`);
      return `SELECT ${literal(`Group ${group + 1}`)} AS group_name, count(${source}) AS observations, avg(${source}) AS mean, stddev_samp(${source}) AS std FROM read_parquet(${literal(this.groupsFile)}) ${dateFilter(range)}`;
    });
    const rows = await this.rows(statements.join(" UNION ALL "));
    return rows.map((row) => {
      const observations = integerValue(row.observations);
      const mean = numberValue(row.mean);
      const deviation = numberValue(row.std);
      const standardError = deviation === null || observations < 3 ? null : deviation / Math.sqrt(observations);
      const statistic = mean === null || standardError === null || standardError <= 0 ? null : Math.abs(mean / standardError);
      return { group: String(row.group_name), mean, pValue: statistic === null ? null : 2 * (1 - normalCdf(statistic)) };
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

  async close() {
    await this.database.close();
  }

  private async rows(sql: string): Promise<Record<string, unknown>[]> {
    return this.database.rows(sql);
  }
}

function factorMetricsSql(informationFile: string, groupsFile: string, factors: string[], returnColumns: string[], nGroups: number) {
  const pairs = factors.flatMap((factor) => returnColumns.map((returnColumn) => ({ factor, returnColumn })));
  const information = pairs.map(({ factor, returnColumn }) => `SELECT ${literal(factor)} AS factor_name, ${literal(returnColumn)} AS return_column, ${identifier(`${factor}_${returnColumn}_ic`)} AS ic, ${identifier(`${factor}_${returnColumn}_rank_ic`)} AS rank_ic FROM read_parquet(${literal(informationFile)})`).join(" UNION ALL ");
  const returns = pairs.map(({ factor, returnColumn }) => {
    const low = identifier(`${factor}_${returnColumn}_group0`);
    const high = identifier(`${factor}_${returnColumn}_group${nGroups - 1}`);
    return `SELECT ${literal(factor)} AS factor_name, ${literal(returnColumn)} AS return_column, time, ${high} - ${low} AS value FROM read_parquet(${literal(groupsFile)}) WHERE ${high} IS NOT NULL AND ${low} IS NOT NULL`;
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
      FROM (${returns})
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
    FROM information_metrics JOIN return_summary USING (factor_name, return_column)
  `;
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

function dateValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" || typeof value === "bigint") {
    const number = Number(value);
    const milliseconds = number > 10_000_000_000_000 ? number / 1000 : number;
    const date = new Date(milliseconds);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return String(value ?? "").slice(0, 10);
}

function dateFilter(range?: FactorDateRange) {
  if (!range || !/^\d{4}-\d{2}-\d{2}$/.test(range.start) || !/^\d{4}-\d{2}-\d{2}$/.test(range.end)) return "";
  return `WHERE time BETWEEN DATE ${literal(range.start)} AND DATE ${literal(range.end)}`;
}

function normalCdf(value: number) {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

function erf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const polynomial = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const y = 1 - polynomial * Math.exp(-x * x);
  return sign * y;
}
