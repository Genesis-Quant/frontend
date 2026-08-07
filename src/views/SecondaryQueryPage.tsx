import { useEffect, useMemo, useState } from "react";

import { BrowserDuckDb } from "@/assets/lib/duckdb";
import { queryApi, queryResultTableName } from "@/assets/lib/query";
import { errorMessage } from "@/assets/lib/utils";
import AnalysisWorkspace from "@/components/layout/AnalysisWorkspace";
import SecondaryQueryControlsPanel from "@/components/panel/SecondaryQueryControlsPanel";
import SecondaryQueryResultsPanel from "@/components/panel/SecondaryQueryResultsPanel";
import type { QueryProjectListItem } from "@/types/query";

const PREVIEW_LIMIT = 200;

export default function SecondaryQueryPage() {
  const [sources, setSources] = useState<QueryProjectListItem[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<number>>(new Set());
  const [sql, setSql] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => sources.filter((source) => selectedSources.has(source.id)), [selectedSources, sources]);

  useEffect(() => { loadSources(); }, []);

  async function loadSources() {
    setLoading(true);
    setError("");
    try {
      const page = await queryApi.listProjects(1, 100);
      const successful = page.items.filter((source) => source.current?.state === "SUCCESS" && source.current.workflow_instance_id !== null);
      setSources(successful);
      setSelectedSources((current) => {
        const available = new Set(successful.map((source) => source.id));
        const retained = new Set([...current].filter((id) => available.has(id)));
        if (!retained.size && successful[0]) retained.add(successful[0].id);
        return retained;
      });
      if (!sql.trim() && successful[0]) setSql(`SELECT *\nFROM ${queryResultTableName(successful[0].id)}\nLIMIT ${PREVIEW_LIMIT};`);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }

  async function runSql() {
    if (!sql.trim() || !selected.length || running) return;
    setRunning(true);
    setRows([]);
    setError("");
    try {
      const files = await Promise.all(selected.map(async (source) => {
        const workflowInstanceId = source.current?.workflow_instance_id;
        if (!workflowInstanceId) throw new Error(`查询项目“${source.title}”没有可用结果`);
        return [`query-${source.id}.parquet`, await queryApi.output(workflowInstanceId, "data")] as const;
      }));
      const database = await BrowserDuckDb.create(Object.fromEntries(files));
      try {
        for (const source of selected) await database.rows(`CREATE VIEW ${queryResultTableName(source.id)} AS SELECT * FROM read_parquet('query-${source.id}.parquet')`);
        setRows(await database.rows(sql));
      } finally { await database.close(); }
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setRunning(false); }
  }

  function toggleSource(id: number, enabled: boolean) {
    setSelectedSources((current) => {
      const next = new Set(current);
      if (enabled) next.add(id); else next.delete(id);
      return next;
    });
  }

  return <AnalysisWorkspace backTo="/query" sidebar={<SecondaryQueryControlsPanel loading={loading} running={running} selectedIds={selectedSources} sources={sources} sql={sql} onRefresh={loadSources} onRun={runSql} onSql={setSql} onToggle={toggleSource} />} sidebarLabel="查询参数">
    <SecondaryQueryResultsPanel error={error} hasSources={selected.length > 0} rows={rows} running={running} />
  </AnalysisWorkspace>;
}
