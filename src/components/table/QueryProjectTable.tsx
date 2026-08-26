import { MoreHorizontal, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { formatDateTime } from "@/assets/lib/dateTime";
import SchedulerState from "@/components/status/SchedulerState";
import ProjectDataTable, { type ProjectTableColumn } from "@/components/table/ProjectDataTable";
import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import type { ProjectSortOrder } from "@/types/project";
import type { QueryProjectListItem, QueryProjectSortField } from "@/types/query";

type QueryProjectTableProps = {
  loading: boolean;
  onDelete: (project: QueryProjectListItem) => void;
  onOpen: (project: QueryProjectListItem) => void;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
  onSearch: (search: string) => void;
  onSort: (field: QueryProjectSortField, order: ProjectSortOrder) => void;
  page: number;
  pageSize: number;
  projects: QueryProjectListItem[];
  search: string;
  sortBy: QueryProjectSortField;
  sortOrder: ProjectSortOrder;
  total: number;
};

export default function QueryProjectTable({ loading, onDelete, onOpen, onPage, onPageSize, onSearch, onSort, page, pageSize, projects, search, sortBy, sortOrder, total }: QueryProjectTableProps) {
  const columns = useMemo<ProjectTableColumn<QueryProjectListItem, QueryProjectSortField>[]>(() => [
    { id: "id", label: "ID", size: 80, sortKey: "id", value: (project) => project.id, className: "px-5 font-mono text-xs text-muted-foreground" },
    { id: "title", label: "名称", size: 320, sortKey: "title", value: (project) => project.title, cell: (project) => <span className="font-medium group-hover:underline">{project.title}</span> },
    { id: "state", label: "状态", size: 160, sortKey: "state", value: (project) => project.current?.state ?? "IDLE", cell: (project) => <SchedulerState state={project.current?.state ?? "IDLE"} /> },
    { id: "workflow_instance_id", label: "Workflow ID", size: 150, sortKey: "workflow_instance_id", value: (project) => project.current?.workflow_instance_id, className: "font-mono text-sm text-muted-foreground" },
    { id: "updated_at", label: "更新时间", size: 190, sortKey: "updated_at", value: (project) => project.updated_at, cell: (project) => <span className="text-muted-foreground">{formatDateTime(project.updated_at)}</span> },
    { id: "actions", label: "操作", size: 72, value: (project) => project.id, align: "right", cell: (project) => <ProjectActions onDelete={() => onDelete(project)} /> }
  ], [onDelete]);

  return <ProjectDataTable columns={columns} emptyMessage="暂无查询项目" loading={loading} rows={projects} onOpen={onOpen} pagination={{ page, pageSize, total, onPageChange: onPage, onPageSizeChange: onPageSize }} search={{ value: search, onChange: onSearch, placeholder: "搜索项目名称或 ID" }} sorting={{ field: sortBy, order: sortOrder, onChange: onSort }} />;
}

function ProjectActions({ onDelete }: { onDelete: () => void }) {
  return <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="项目操作" size="icon-sm" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
}
