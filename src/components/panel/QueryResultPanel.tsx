import { CircleX, Clock3, Database, FileQuestion, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BrowserDuckDb } from "@/assets/lib/duckdb";
import { isDuckDbNumericType, readParquetNumericColumnStats } from "@/assets/lib/parquetColumnStats";
import { queryApi } from "@/assets/lib/query";
import { errorMessage } from "@/assets/lib/utils";
import { resolveWorkflowResultPhase, type WorkflowResultPhase } from "@/assets/lib/workflows";
import DateRangeBar from "@/components/bar/DateRangeBar";
import EmptyStatePanel from "@/components/panel/EmptyStatePanel";
import ErrorPanel from "@/components/panel/ErrorPanel";
import ParquetDataTable from "@/components/table/ParquetDataTable";
import { useAppStore } from "@/store";
import { emptyParquetTableQuery, type ParquetNumericColumnStatsMap, type ParquetTableQuery } from "@/types/table";

type QueryDatePoint = { time: string; value: number | null };
type QueryTableSummary = { numericStats: ParquetNumericColumnStatsMap; total: number };
const maximumSummaryCacheEntries = 24;

type QueryResultPanelProps = {
  error: string;
  running: boolean;
  state: string;
  timeColumn?: string;
  workflowError: string | null;
  workflowInstanceId: number | null;
};

export default function QueryResultPanel({ error, running, state, timeColumn = "time", workflowError, workflowInstanceId }: QueryResultPanelProps) {
  const phase = resolveWorkflowResultPhase(running, workflowInstanceId, state);
  const theme = useAppStore((store) => store.theme);
  const database = useRef<BrowserDuckDb | null>(null);
  const request = useRef(0);
  const summaryCache = useRef(new Map<string, Promise<QueryTableSummary>>());
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [numericColumns, setNumericColumns] = useState<string[]>([]);
  const [numericStats, setNumericStats] = useState<ParquetNumericColumnStatsMap>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tableQuery, setTableQuery] = useState<ParquetTableQuery>(emptyParquetTableQuery);
  const [points, setPoints] = useState<QueryDatePoint[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [loadedWorkflow, setLoadedWorkflow] = useState<number | null>(null);

  const loadRawRows = useCallback(async () => {
    const activeDatabase = database.current;
    if (!activeDatabase || loadedWorkflow !== workflowInstanceId) throw new Error("查询结果尚未加载");
    return activeDatabase.rows("SELECT * FROM read_parquet('current.parquet')");
  }, [loadedWorkflow, workflowInstanceId]);

  useEffect(() => {
    if (phase !== "success" || !workflowInstanceId) { resetPreview(); return; }
    if (loadedWorkflow !== workflowInstanceId) loadPreview(workflowInstanceId);
  }, [loadedWorkflow, phase, workflowInstanceId]);

  useEffect(() => {
    const activeDatabase = database.current;
    if (!activeDatabase || !startDate || !endDate || loadedWorkflow !== workflowInstanceId) return undefined;
    let cancelled = false;
    const activeRequest = ++request.current;
    const where = tableWhere(columns, timeColumn, startDate, endDate, tableQuery);
    const orderBy = tableOrderBy(columns, timeColumn, tableQuery);
    const summaryKey = `${workflowInstanceId}\u0000${where}\u0000${numericColumns.join("\u0000")}`;
    let summaryRequest = summaryCache.current.get(summaryKey);
    if (!summaryRequest) {
      summaryRequest = loadTableSummary(activeDatabase, numericColumns, where);
      rememberSummary(summaryCache.current, summaryKey, summaryRequest);
      const currentRequest = summaryRequest;
      summaryRequest.catch(() => { if (summaryCache.current.get(summaryKey) === currentRequest) summaryCache.current.delete(summaryKey); });
    }
    setLoading(true);
    setPreviewError("");
    Promise.all([
      summaryRequest,
      activeDatabase.rows(`SELECT * FROM read_parquet('current.parquet') ${where} ${orderBy} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`)
    ])
      .then(([summary, nextRows]) => {
        if (cancelled || request.current !== activeRequest) return;
        setTotal(summary.total);
        setRows(nextRows);
        setNumericStats(summary.numericStats);
      })
      .catch((reason) => { if (!cancelled && request.current === activeRequest) setPreviewError(errorMessage(reason)); })
      .finally(() => { if (!cancelled && request.current === activeRequest) setLoading(false); });
    return () => { cancelled = true; };
  }, [columns, endDate, loadedWorkflow, numericColumns, page, pageSize, startDate, tableQuery, timeColumn, workflowInstanceId]);

  useEffect(() => () => {
    request.current += 1;
    summaryCache.current.clear();
    const activeDatabase = database.current;
    database.current = null;
    activeDatabase?.close().catch(() => undefined);
  }, []);

  async function loadPreview(nextWorkflowInstanceId: number) {
    setLoading(true);
    setPreviewError("");
    const activeRequest = ++request.current;
    summaryCache.current.clear();
    const previous = database.current;
    database.current = null;
    if (previous) await previous.close().catch(() => undefined);
    let nextDatabase: BrowserDuckDb | null = null;
    try {
      const buffer = await queryApi.output(nextWorkflowInstanceId, "data");
      nextDatabase = await BrowserDuckDb.create({ "current.parquet": buffer });
      const column = identifier(timeColumn);
      const [pointRows, schemaRows] = await Promise.all([
        nextDatabase.rows(`SELECT strftime(CAST(${column} AS DATE), '%Y-%m-%d') AS time, count(*) AS value FROM read_parquet('current.parquet') GROUP BY 1 ORDER BY 1`),
        nextDatabase.rows("DESCRIBE SELECT * FROM read_parquet('current.parquet')")
      ]);
      if (request.current !== activeRequest) { await nextDatabase.close(); return; }
      const nextPoints = pointRows.map((row) => ({ time: String(row.time), value: numberValue(row.value) }));
      database.current = nextDatabase;
      nextDatabase = null;
      setColumns(schemaRows.map((row) => String(row.column_name)));
      setNumericColumns(schemaRows.filter((row) => isDuckDbNumericType(row.column_type)).map((row) => String(row.column_name)));
      setNumericStats({});
      setPoints(nextPoints);
      setStartDate(nextPoints[0]?.time ?? "");
      setEndDate(nextPoints.at(-1)?.time ?? "");
      setPage(1);
      setTableQuery(emptyParquetTableQuery());
      setLoadedWorkflow(nextWorkflowInstanceId);
      if (!nextPoints.length) setLoading(false);
    } catch (reason) {
      if (request.current === activeRequest) { setPreviewError(errorMessage(reason)); setLoading(false); }
    } finally { if (nextDatabase) await nextDatabase.close().catch(() => undefined); }
  }

  function resetPreview() {
    if (!database.current && !rows.length && !points.length && loadedWorkflow === null) return;
    request.current += 1;
    summaryCache.current.clear();
    const activeDatabase = database.current;
    database.current = null;
    activeDatabase?.close().catch(() => undefined);
    setRows([]);
    setColumns([]);
    setNumericColumns([]);
    setNumericStats({});
    setTotal(0);
    setPage(1);
    setTableQuery(emptyParquetTableQuery());
    setPoints([]);
    setStartDate("");
    setEndDate("");
    setLoading(false);
    setPreviewError("");
    setLoadedWorkflow(null);
  }

  const minimumDate = points[0]?.time ?? "";
  const maximumDate = points.at(-1)?.time ?? "";
  const panelError = error || (phase !== "failure" ? workflowError : null);
  const result = <div className="space-y-4">{phase === "success" && points.length ? <DateRangeBar endDate={endDate} label="结果区间" maximumDate={maximumDate} minimumDate={minimumDate} points={points} startDate={startDate} theme={theme} onEndDate={(value) => { setPage(1); setEndDate(value < startDate ? startDate : value); }} onReset={() => { setPage(1); setStartDate(minimumDate); setEndDate(maximumDate); }} onStartDate={(value) => { setPage(1); setStartDate(value > endDate ? endDate : value); }} /> : null}<ResultContent columns={columns} download={{ fileName: `query-${workflowInstanceId}-data.xlsx`, loadRows: loadRawRows }} error={previewError} loading={loading} numericStats={numericStats} page={page} pageSize={pageSize} phase={phase} query={tableQuery} rows={rows} timeColumn={timeColumn} total={total} workflowError={workflowError} onPage={setPage} onPageSize={(value) => { setPage(1); setPageSize(value); }} onQuery={(value) => { setPage(1); setTableQuery(value); }} /></div>;
  return <section className="min-w-0 space-y-5"><h2 className="text-lg font-semibold">查询结果</h2>{panelError ? <ErrorPanel message={panelError} /> : null}{phase === "success" || !panelError ? result : null}</section>;
}

function ResultContent({ columns, download, error, loading, numericStats, onPage, onPageSize, onQuery, page, pageSize, phase, query, rows, timeColumn, total, workflowError }: { columns: string[]; download: { fileName: string; loadRows: () => Promise<Record<string, unknown>[]> }; error: string; loading: boolean; numericStats: ParquetNumericColumnStatsMap; onPage: (page: number) => void; onPageSize: (pageSize: number) => void; onQuery: (query: ParquetTableQuery) => void; page: number; pageSize: number; phase: WorkflowResultPhase; query: ParquetTableQuery; rows: Record<string, unknown>[]; timeColumn: string; total: number; workflowError: string | null }) {
  if (phase === "running") return <EmptyStatePanel description="任务完成后自动读取结果。" icon={Clock3} iconClassName="animate-pulse" title="查询正在运行" />;
  if (phase === "failure") return workflowError ? <ErrorPanel message={workflowError} /> : <EmptyStatePanel description="任务已结束，但没有生成可读取的查询结果。" icon={CircleX} title="查询执行失败" />;
  if (phase === "idle") return <EmptyStatePanel description="完成 DSL 后执行查询。" icon={FileQuestion} title="尚未执行查询" />;
  if (error) return <ErrorPanel message={error} />;
  if (loading && !columns.length) return <EmptyStatePanel description="DuckDB 正在读取查询结果。" icon={Loader2} iconClassName="animate-spin" title="正在读取 Parquet" />;
  return total || rows.length ? <ParquetDataTable columns={columns} download={download} loading={loading} numericStats={numericStats} pagination={{ page, pageSize, total, onPageChange: onPage, onPageSizeChange: onPageSize }} query={{ value: query, onChange: onQuery }} rows={rows} timeColumn={timeColumn} /> : <EmptyStatePanel description="当前条件下没有数据行。" icon={Database} title="查询结果为空" />;
}

function identifier(value: string) { return `"${value.replace(/"/g, "\"\"")}"`; }
function numberValue(value: unknown) { const result = Number(value); return Number.isFinite(result) ? result : null; }
function sqlLiteral(value: string) { return `'${value.replace(/'/g, "''")}'`; }

function tableWhere(columns: string[], timeColumn: string, startDate: string, endDate: string, query: ParquetTableQuery) {
  const available = new Set(columns);
  const predicates = [`CAST(${identifier(timeColumn)} AS DATE) BETWEEN DATE ${sqlLiteral(startDate)} AND DATE ${sqlLiteral(endDate)}`];
  query.filters.forEach((filter) => {
    if (!available.has(filter.id)) return;
    if (isDateFilterColumn(filter.id, timeColumn)) predicates.push(`contains(CAST(${identifier(filter.id)} AS VARCHAR), ${sqlLiteral(String(filter.value))})`);
    else if (typeof filter.value === "string") predicates.push(`contains(lower(CAST(${identifier(filter.id)} AS VARCHAR)), lower(${sqlLiteral(filter.value)}))`);
    else predicates.push(`${identifier(filter.id)} = ${sqlLiteral(String(filter.value))}`);
  });
  return `WHERE ${predicates.join(" AND ")}`;
}

function isDateFilterColumn(column: string, timeColumn: string) {
  const lower = column.toLowerCase();
  return lower === timeColumn.toLowerCase() || lower === "date" || lower.endsWith("date");
}

function tableOrderBy(columns: string[], timeColumn: string, query: ParquetTableQuery) {
  const available = new Set(columns);
  const sorts = query.sorting.flatMap((sort) => available.has(sort.id) ? [`${identifier(sort.id)} ${sort.desc ? "DESC" : "ASC"} NULLS LAST`] : []).slice(0, 3);
  if (!sorts.length) sorts.push(`${identifier(timeColumn)} ASC NULLS LAST`);
  return `ORDER BY ${sorts.join(", ")}`;
}

async function loadTableSummary(database: BrowserDuckDb, numericColumns: string[], where: string): Promise<QueryTableSummary> {
  const [countRows, numericStats] = await Promise.all([
    database.rows(`SELECT count(*) AS total FROM read_parquet('current.parquet') ${where}`),
    readParquetNumericColumnStats(database, "current.parquet", numericColumns, where)
  ]);
  return { numericStats, total: Math.max(0, Math.trunc(numberValue(countRows[0]?.total) ?? 0)) };
}

function rememberSummary<T>(cache: Map<string, Promise<T>>, key: string, value: Promise<T>) {
  cache.set(key, value);
  while (cache.size > maximumSummaryCacheEntries) cache.delete(cache.keys().next().value!);
}
