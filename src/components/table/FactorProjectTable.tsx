import { MoreHorizontal, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { formatDateTime } from "@/assets/lib/dateTime";
import { annualizeFactorInformationRatio, factorMetricDescription } from "@/assets/lib/metricDefinitions";
import { MetricLabel } from "@/components/mark/MetricLabel";
import ProjectDataTable, { type ProjectTableColumn } from "@/components/table/ProjectDataTable";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import type { FactorProjectListItem, FactorProjectSortField } from "@/types/factor";
import type { ProjectSortOrder } from "@/types/project";

type FactorProjectTableProps = {
  loading: boolean;
  onDelete: (project: FactorProjectListItem) => void;
  onOpen: (project: FactorProjectListItem) => void;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
  onSearch: (search: string) => void;
  onSort: (field: FactorProjectSortField, order: ProjectSortOrder) => void;
  page: number;
  pageSize: number;
  projects: FactorProjectListItem[];
  search: string;
  sortBy: FactorProjectSortField;
  sortOrder: ProjectSortOrder;
  total: number;
};

export default function FactorProjectTable({ loading, onDelete, onOpen, onPage, onPageSize, onSearch, onSort, page, pageSize, projects, search, sortBy, sortOrder, total }: FactorProjectTableProps) {
  const columns = useMemo<ProjectTableColumn<FactorProjectListItem, FactorProjectSortField>[]>(() => [
    { id: "id", label: "ID", size: 80, sortKey: "id", value: (project) => project.id, className: "px-5 font-mono text-xs text-muted-foreground" },
    { id: "title", label: "名称", size: 260, sortKey: "title", value: (project) => project.title, cell: (project) => <span className="block truncate font-medium group-hover:underline" title={project.title}>{project.title}</span> },
    { id: "latest_version", label: "最新版本", size: 112, sortKey: "latest_version", value: (project) => project.latest_version, cell: (project) => <Badge className="tabular-nums" variant="secondary">{project.latest_version ? `v${project.latest_version}` : "—"}</Badge> },
    metricColumn("ic_mean", "IC 均值"),
    metricColumn("rank_ic_mean", "Rank IC 均值"),
    informationRatioColumn(),
    metricColumn("long_short_annual_return", "多空年化收益", true),
    metricColumn("long_short_sharpe", "多空年化 Sharpe"),
    { id: "updated_at", label: "更新时间", size: 170, sortKey: "updated_at", value: (project) => project.updated_at, cell: (project) => <span className="text-muted-foreground">{formatDateTime(project.updated_at)}</span> },
    { id: "actions", label: "操作", size: 72, value: (project) => project.id, align: "right", cell: (project) => <ProjectActions onDelete={() => onDelete(project)} /> }
  ], [onDelete]);

  return <ProjectDataTable columns={columns} emptyMessage="暂无研究项目" loading={loading} rows={projects} onOpen={onOpen} pagination={{ page, pageSize, total, onPageChange: onPage, onPageSizeChange: onPageSize }} search={{ value: search, onChange: onSearch, placeholder: "搜索项目名称或 ID" }} sorting={{ field: sortBy, order: sortOrder, onChange: onSort }} />;
}

function metricColumn(id: Exclude<FactorProjectSortField, "id" | "title" | "latest_version" | "updated_at">, label: string, percent = false): ProjectTableColumn<FactorProjectListItem, FactorProjectSortField> {
  return { id, label, size: 132, sortKey: id, value: (project) => project.latest_metric?.[id], align: "right", className: "tabular-nums", cell: (project) => formatMetric(project.latest_metric?.[id], percent) };
}

function informationRatioColumn(): ProjectTableColumn<FactorProjectListItem, FactorProjectSortField> {
  return {
    id: "ic_ir",
    label: "年化 ICIR",
    size: 132,
    sortKey: "ic_ir",
    value: (project) => annualizeFactorInformationRatio(project.latest_metric?.ic_ir, project.latest_return_spec),
    align: "right",
    className: "tabular-nums",
    cell: (project) => {
      const rawValue = project.latest_metric?.ic_ir;
      const value = annualizeFactorInformationRatio(rawValue, project.latest_return_spec);
      return <MetricValue description={factorMetricDescription("icIr", project.latest_return_spec?.periods, rawValue ?? null)} value={value} />;
    }
  };
}

function MetricValue({ description, value }: { description: string; value: number | null }) {
  return <MetricLabel className="justify-end" description={description}>{formatMetric(value)}</MetricLabel>;
}

function ProjectActions({ onDelete }: { onDelete: () => void }) {
  return <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="项目操作" size="icon-sm" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
}

function formatMetric(value: number | null | undefined, percent = false) { if (value === null || value === undefined) return "—"; return percent ? `${(value * 100).toFixed(2)}%` : value.toFixed(4); }
