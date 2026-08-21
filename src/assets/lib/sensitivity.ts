import { BrowserDuckDb } from "@/assets/lib/duckdb";
import type { StrategyParameters } from "@/types/backtest";

export type SensitivityMetrics = {
  totalReturn: number | null;
  cagr: number | null;
  sharpe: number | null;
  sortino: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  calmar: number | null;
  totalFee: number | null;
};

export type SensitivityResultRow = {
  caseIndex: number;
  analysisType: "fee_analysis" | "sensitivity";
  params: StrategyParameters;
  commission: number;
  status: "SUCCESS" | "FAILURE";
  error: string | null;
  metrics: SensitivityMetrics;
};

export class SensitivityAnalytics {
  private constructor(private readonly database: BrowserDuckDb, private readonly file: string) {}

  static async create(researchId: number, buffer: ArrayBuffer) {
    const file = `sensitivity-${researchId}.parquet`;
    return new SensitivityAnalytics(await BrowserDuckDb.create({ [file]: buffer }), file);
  }

  async results(): Promise<SensitivityResultRow[]> {
    const rows = await this.database.rows(`
      SELECT CAST(case_index AS INTEGER) AS case_index,
        CAST(analysis_type AS VARCHAR) AS analysis_type,
        CAST(params AS VARCHAR) AS params,
        CAST(commission AS DOUBLE) AS commission,
        CAST(status AS VARCHAR) AS status,
        CAST(error AS VARCHAR) AS error,
        CAST(total_return AS DOUBLE) AS total_return,
        CAST(cagr AS DOUBLE) AS cagr,
        CAST(sharpe AS DOUBLE) AS sharpe,
        CAST(sortino AS DOUBLE) AS sortino,
        CAST(volatility AS DOUBLE) AS volatility,
        CAST(max_drawdown AS DOUBLE) AS max_drawdown,
        CAST(win_rate AS DOUBLE) AS win_rate,
        CAST(calmar AS DOUBLE) AS calmar,
        CAST(total_fee AS DOUBLE) AS total_fee
      FROM read_parquet(${literal(this.file)})
      ORDER BY case_index
    `);
    return rows.map((row) => ({
      caseIndex: integerValue(row.case_index),
      analysisType: String(row.analysis_type) as SensitivityResultRow["analysisType"],
      params: jsonParameters(row.params),
      commission: numberValue(row.commission) ?? 0,
      status: String(row.status) as SensitivityResultRow["status"],
      error: textValue(row.error),
      metrics: {
        totalReturn: numberValue(row.total_return),
        cagr: numberValue(row.cagr),
        sharpe: numberValue(row.sharpe),
        sortino: numberValue(row.sortino),
        volatility: numberValue(row.volatility),
        maxDrawdown: numberValue(row.max_drawdown),
        winRate: numberValue(row.win_rate),
        calmar: numberValue(row.calmar),
        totalFee: numberValue(row.total_fee)
      }
    }));
  }

  close() {
    return this.database.close();
  }
}

function jsonParameters(value: unknown): StrategyParameters {
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as StrategyParameters : {};
  } catch {
    return {};
  }
}

function numberValue(value: unknown) {
  const number = Number(value);
  return value === null || value === undefined || !Number.isFinite(number) ? null : number;
}

function integerValue(value: unknown) { return Math.trunc(numberValue(value) ?? 0); }
function textValue(value: unknown) { const text = value === null || value === undefined ? "" : String(value); return text || null; }
function literal(value: string) { return `'${value.replace(/'/g, "''")}'`; }
