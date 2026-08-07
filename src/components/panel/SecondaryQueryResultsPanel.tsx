import { Database, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import EmptyStatePanel from "@/components/panel/EmptyStatePanel";
import ErrorPanel from "@/components/panel/ErrorPanel";
import ParquetDataTable from "@/components/table/ParquetDataTable";

type SecondaryQueryResultsPanelProps = { error: string; hasSources: boolean; rows: Record<string, unknown>[]; running: boolean };

export default function SecondaryQueryResultsPanel({ error, hasSources, rows, running }: SecondaryQueryResultsPanelProps) {
  let content: ReactNode;
  if (error) content = <ErrorPanel message={error} />;
  else if (running) content = <EmptyStatePanel className="min-h-64" description="查询完成后将在这里展示结果。" icon={Loader2} iconClassName="animate-spin" title="正在执行 SQL" />;
  else if (rows.length) content = <ParquetDataTable containerClassName="max-h-[calc(100vh-7rem)]" download={{ fileName: "secondary-query.xlsx" }} rows={rows} timeColumn="time" />;
  else content = <EmptyStatePanel className="min-h-64" description={hasSources ? "执行 SQL 后将在这里展示结果。" : "请先选择至少一个成功的查询项目。"} icon={Database} title="暂无查询结果" />;
  return <section className="min-w-0">{content}</section>;
}
