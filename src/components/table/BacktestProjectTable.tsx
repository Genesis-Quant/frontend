import { MoreHorizontal, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { formatDateTime } from "@/assets/lib/dateTime";
import ProjectDataTable, { type ProjectTableColumn } from "@/components/table/ProjectDataTable";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import type { BacktestProjectListItem, BacktestProjectSortField } from "@/types/backtest";
import type { ProjectSortOrder } from "@/types/project";

type BacktestProjectTableProps = {
  loading: boolean;
  onDelete: (project: BacktestProjectListItem) => void;
  onOpen: (project: BacktestProjectListItem) => void;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
  onSearch: (search: string) => void;
  onSort: (field: BacktestProjectSortField, order: ProjectSortOrder) => void;
  page: number;
  pageSize: number;
  projects: BacktestProjectListItem[];
  search: string;
  sortBy: BacktestProjectSortField;
  sortOrder: ProjectSortOrder;
  total: number;
};

export default function BacktestProjectTable({ loading, onDelete, onOpen, onPage, onPageSize, onSearch, onSort, page, pageSize, projects, search, sortBy, sortOrder, total }: BacktestProjectTableProps) {
  const columns = useMemo<ProjectTableColumn<BacktestProjectListItem, BacktestProjectSortField>[]>(() => [
    { id: "id", label: "ID", size: 80, sortKey: "id", value: (project) => project.id, className: "px-5 font-mono text-xs text-muted-foreground" },
    { id: "title", label: "名称", size: 260, sortKey: "title", value: (project) => project.title, cell: (project) => <span className="block truncate font-medium group-hover:underline" title={project.title}>{project.title}</span> },
    { id: "latest_version", label: "最新版本", size: 112, sortKey: "latest_version", value: (project) => project.latest_version, cell: (project) => <Badge variant="secondary">{project.latest_version ? `v${project.latest_version}` : "—"}</Badge> },
    summaryColumn("totalReturn", "累计收益", true),
    summaryColumn("annualReturn", "年化收益", true),
    summaryColumn("sharpeRatio", "年化 Sharpe"),
    summaryColumn("annualVolatility", "年化波动", true),
    summaryColumn("maxDrawdown", "最大回撤", true),
    summaryColumn("dailyWinningRate", "日胜率", true),
    { id: "updated_at", label: "更新时间", size: 170, sortKey: "updated_at", value: (project) => project.updated_at, cell: (project) => <span className="text-muted-foreground">{formatDateTime(project.updated_at)}</span> },
    { id: "actions", label: "操作", size: 72, value: (project) => project.id, align: "right", cell: (project) => <ProjectActions onDelete={() => onDelete(project)} /> }
  ], [onDelete]);

  return <ProjectDataTable columns={columns} emptyMessage="暂无回测项目" loading={loading} rows={projects} onOpen={onOpen} pagination={{ page, pageSize, total, onPageChange: onPage, onPageSizeChange: onPageSize }} search={{ value: search, onChange: onSearch, placeholder: "搜索项目名称或 ID" }} sorting={{ field: sortBy, order: sortOrder, onChange: onSort }} />;
}

function summaryColumn(id: Exclude<BacktestProjectSortField, "id" | "title" | "latest_version" | "updated_at">, label: string, percent = false): ProjectTableColumn<BacktestProjectListItem, BacktestProjectSortField> {
  return { id, label, size: 128, sortKey: id, value: (project) => project.latest_summary?.[id], align: "right", className: "tabular-nums", cell: (project) => formatSummary(project.latest_summary?.[id], percent) };
}

function ProjectActions({ onDelete }: { onDelete: () => void }) {
  return <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="项目操作" size="icon-sm" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
}

function formatSummary(value: number | null | undefined, percent = false) { if (value === null || value === undefined) return "—"; return percent ? `${(value * 100).toFixed(2)}%` : value.toFixed(3); }
