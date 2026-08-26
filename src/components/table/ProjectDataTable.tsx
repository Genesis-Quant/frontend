import {
  columnSizingFeature,
  createColumnHelper,
  functionalUpdate,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
  type Updater
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Search, X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/assets/lib/utils";
import { MetricHelp, MetricLabel } from "@/components/mark/MetricLabel";
import { AppPagination } from "@/components/pagination/AppPagination";
import { ProjectTableState } from "@/components/table/ProjectTableState";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import type { ProjectSortOrder } from "@/types/project";

const projectTableFeatures = tableFeatures({ columnSizingFeature, rowSortingFeature });

export type ProjectTableColumn<TData, TSort extends string> = {
  align?: "left" | "right";
  cell?: (row: TData) => ReactNode;
  className?: string;
  description?: string;
  id: TSort | "actions";
  label: string;
  size: number;
  sortKey?: TSort;
  value: (row: TData) => unknown;
};

type ProjectDataTableProps<TData extends { id: number }, TSort extends string> = {
  columns: ProjectTableColumn<TData, TSort>[];
  emptyMessage: string;
  loading: boolean;
  onOpen: (row: TData) => void;
  pagination: {
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    page: number;
    pageSize: number;
    total: number;
  };
  rows: TData[];
  search: {
    onChange: (value: string) => void;
    placeholder: string;
    value: string;
  };
  sorting: {
    field: TSort;
    onChange: (field: TSort, order: ProjectSortOrder) => void;
    order: ProjectSortOrder;
  };
};

export default function ProjectDataTable<TData extends { id: number }, TSort extends string>({ columns, emptyMessage, loading, onOpen, pagination, rows, search, sorting }: ProjectDataTableProps<TData, TSort>) {
  const [searchInput, setSearchInput] = useState(search.value);
  const sortingState = useMemo<SortingState>(() => [{ id: sorting.field, desc: sorting.order === "desc" }], [sorting.field, sorting.order]);
  const columnById = useMemo(() => Object.fromEntries(columns.map((column) => [column.id, column])) as Record<string, ProjectTableColumn<TData, TSort>>, [columns]);
  const helper = useMemo(() => createColumnHelper<typeof projectTableFeatures, TData>(), []);
  const definitions = useMemo(() => helper.columns(columns.map((column) => helper.accessor(column.value, {
    id: column.id,
    header: column.label,
    cell: (context) => column.cell ? column.cell(context.row.original) : renderValue(context.getValue()),
    enableSorting: column.sortKey !== undefined,
    size: column.size
  }))), [columns, helper]);

  useEffect(() => { setSearchInput(search.value); }, [search.value]);
  useEffect(() => {
    const normalized = searchInput.trim();
    if (normalized === search.value) return undefined;
    const timer = window.setTimeout(() => search.onChange(normalized), 300);
    return () => window.clearTimeout(timer);
  }, [search.onChange, search.value, searchInput]);

  const updateSorting = useCallback((updater: Updater<SortingState>) => {
    const next = functionalUpdate(updater, sortingState)[0];
    if (!next) return;
    const sortKey = columnById[next.id]?.sortKey;
    if (sortKey) sorting.onChange(sortKey, next.desc ? "desc" : "asc");
  }, [columnById, sorting, sortingState]);

  const table = useTable({
    columns: definitions,
    data: rows,
    enableSortingRemoval: false,
    features: projectTableFeatures,
    getRowId: (row) => String(row.id),
    manualSorting: true,
    onSortingChange: updateSorting,
    state: { sorting: sortingState }
  });
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const minimumWidth = columns.reduce((total, column) => total + column.size, 0);

  function clearSearch() {
    setSearchInput("");
    search.onChange("");
  }

  function openWithKeyboard(event: KeyboardEvent<HTMLTableRowElement>, row: TData) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onOpen(row);
  }

  return <Card className="overflow-hidden py-0 shadow-sm"><CardContent className="p-0">
    <div className="flex items-center border-b px-4 py-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="搜索项目" className="pr-9 pl-9" placeholder={search.placeholder} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        {searchInput ? <Button aria-label="清空搜索" className="absolute right-1 top-1/2 -translate-y-1/2" size="icon-sm" variant="ghost" onClick={clearSearch}><X /></Button> : null}
      </div>
    </div>
    <Table className="table-fixed" style={{ minWidth: minimumWidth }}>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => {
          const config = columnById[header.column.id];
          const sorted = header.column.getIsSorted();
          let content: ReactNode = null;
          if (!header.isPlaceholder) content = header.column.getCanSort()
            ? <div className={cn("flex w-full items-center gap-1 py-2", config.align === "right" && "justify-end")}>
                <button className="inline-flex min-w-0 items-center gap-1.5 text-left transition-colors hover:text-foreground" title={`按${config.label}排序`} onClick={header.column.getToggleSortingHandler()}><span className="truncate">{config.label}</span>{sortingIcon(sorted)}</button>
                <MetricHelp description={config.description} label={`查看${config.label}说明`} />
              </div>
            : <MetricLabel className={cn("py-2", config.align === "right" && "justify-end text-right")} description={config.description} label={`查看${config.label}说明`}>{config.label}</MetricLabel>;
          return <TableHead aria-sort={ariaSortValue(sorted)} className={cn("px-3", config.align === "right" && "text-right")} key={header.id} style={{ width: header.getSize() }}>{content}</TableHead>;
        })}</TableRow>)}
      </TableHeader>
      <TableBody>
        {loading ? <ProjectTableState colSpan={columns.length}><Loader2 className="animate-spin" />正在加载...</ProjectTableState> : null}
        {!loading && table.getRowModel().rows.map((row) => <TableRow className="group cursor-pointer" key={row.id} tabIndex={0} onClick={() => onOpen(row.original)} onKeyDown={(event) => openWithKeyboard(event, row.original)}>{row.getAllCells().map((cell) => {
          const config = columnById[cell.column.id];
          return <TableCell className={cn("px-3 py-4", config.align === "right" && "text-right", config.className)} key={cell.id} style={{ width: cell.column.getSize() }}><table.FlexRender cell={cell} /></TableCell>;
        })}</TableRow>)}
        {!loading && !rows.length ? <ProjectTableState colSpan={columns.length}>{search.value ? "没有符合搜索条件的项目" : emptyMessage}</ProjectTableState> : null}
      </TableBody>
    </Table>
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-muted-foreground">共 {pagination.total.toLocaleString("zh-CN")} 条</span><AppPagination page={pagination.page} pageSize={pagination.pageSize} totalPages={totalPages} onPageChange={pagination.onPageChange} onPageSizeChange={pagination.onPageSizeChange} /></div>
  </CardContent></Card>;
}

function renderValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  return String(value);
}

function ariaSortValue(sorted: false | "asc" | "desc"): "none" | "ascending" | "descending" {
  if (sorted === "asc") return "ascending";
  if (sorted === "desc") return "descending";
  return "none";
}

function sortingIcon(sorted: false | "asc" | "desc") {
  if (sorted === "asc") return <ArrowUp className="size-3.5 shrink-0" />;
  if (sorted === "desc") return <ArrowDown className="size-3.5 shrink-0" />;
  return <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" />;
}
