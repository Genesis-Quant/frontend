import { Loader2, Play, RefreshCw, Terminal } from "lucide-react";

import { queryResultTableName } from "@/assets/lib/query";
import SchedulerStateBadge from "@/components/badge/SchedulerStateBadge";
import SqlEditor from "@/components/editor/SqlEditor";
import { Button } from "@/ui/button";
import { Switch } from "@/ui/switch";
import type { QueryProjectListItem } from "@/types/query";

type SecondaryQueryControlsPanelProps = {
  loading: boolean;
  running: boolean;
  selectedIds: Set<number>;
  sources: QueryProjectListItem[];
  sql: string;
  onRefresh: () => void;
  onRun: () => void;
  onSql: (sql: string) => void;
  onToggle: (id: number, enabled: boolean) => void;
};

export default function SecondaryQueryControlsPanel({ loading, running, selectedIds, sources, sql, onRefresh, onRun, onSql, onToggle }: SecondaryQueryControlsPanelProps) {
  const selected = sources.filter((source) => selectedIds.has(source.id));
  return <section className="h-full min-h-0 min-w-0"><div className="h-full overflow-y-auto">
    <div className="flex items-start justify-between gap-3 border-b px-5 py-5"><div className="min-w-0"><h1 className="flex items-center gap-2 text-lg font-semibold"><Terminal className="size-4 text-primary" />SQL 二次查询</h1><p className="mt-1 text-xs text-muted-foreground">选择数据源并在浏览器中执行 DuckDB SQL</p></div><Button aria-label="刷新数据源" title="刷新数据源" size="icon-sm" variant="ghost" disabled={loading} onClick={onRefresh}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}</Button></div>
    <div className="space-y-5 p-5"><div><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-medium">数据源</span><span className="text-xs text-muted-foreground">已选 {selected.length}/{sources.length}</span></div><div className="max-h-52 divide-y overflow-y-auto rounded-md border">{sources.length ? sources.map((source) => <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5" key={source.id}><Switch checked={selectedIds.has(source.id)} onCheckedChange={(checked) => onToggle(source.id, checked)} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{source.title}</span><SchedulerStateBadge state={source.current?.state ?? "IDLE"} /><code className="text-[11px] text-muted-foreground">{queryResultTableName(source.id)}</code></label>) : <div className="px-4 py-8 text-center text-sm text-muted-foreground">{loading ? "正在加载查询项目…" : "暂无成功的查询结果"}</div>}</div></div><div className="h-[360px]"><SqlEditor modelPath="sql://query/secondary.sql" tables={selected.map((source) => queryResultTableName(source.id))} value={sql} onChange={onSql} /></div><Button className="w-full" disabled={running || !sql.trim() || !selected.length} onClick={onRun}>{running ? <Loader2 className="animate-spin" /> : <Play />}执行 SQL</Button></div>
  </div></section>;
}
