import { Loader2, MoreHorizontal, Trash2 } from "lucide-react";

import { formatDateTime } from "@/assets/lib/dateTime";
import SchedulerStateBadge from "@/components/badge/SchedulerStateBadge";
import { ProjectTableState } from "@/components/table/ProjectTableState";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import type { QueryProjectListItem } from "@/types/query";

type QueryProjectTableProps = { loading: boolean; projects: QueryProjectListItem[]; onDelete: (project: QueryProjectListItem) => void; onOpen: (project: QueryProjectListItem) => void };

export default function QueryProjectTable({ loading, projects, onDelete, onOpen }: QueryProjectTableProps) {
  return <Card className="overflow-hidden py-0 shadow-sm"><CardContent className="p-0"><Table className="min-w-[840px] table-fixed"><TableHeader><TableRow><TableHead className="w-20 px-5">ID</TableHead><TableHead className="w-[38%] px-4">名称</TableHead><TableHead className="w-40 px-4">状态</TableHead><TableHead className="w-32 px-3">Workflow ID</TableHead><TableHead className="w-48 px-3">更新时间</TableHead><TableHead className="w-16 px-3 text-right">操作</TableHead></TableRow></TableHeader><TableBody>{projects.map((project) => <QueryProjectRow key={project.id} project={project} onOpen={() => onOpen(project)} onDelete={() => onDelete(project)} />)}{loading ? <ProjectTableState colSpan={6}><Loader2 className="animate-spin" />正在加载...</ProjectTableState> : null}{!loading && !projects.length ? <ProjectTableState colSpan={6}>暂无查询项目</ProjectTableState> : null}</TableBody></Table></CardContent></Card>;
}

function QueryProjectRow({ onDelete, onOpen, project }: { onDelete: () => void; onOpen: () => void; project: QueryProjectListItem }) {
  return <TableRow className="group cursor-pointer" onClick={onOpen}><TableCell className="px-5 py-4 font-mono text-xs text-muted-foreground">{project.id}</TableCell><TableCell className="px-4 py-4 font-medium group-hover:underline">{project.title}</TableCell><TableCell className="px-4 py-4"><SchedulerStateBadge state={project.current?.state ?? "IDLE"} /></TableCell><TableCell className="px-3 py-4 font-mono text-sm text-muted-foreground">{project.current?.workflow_instance_id ?? "—"}</TableCell><TableCell className="px-3 py-4 text-muted-foreground">{formatDateTime(project.updated_at)}</TableCell><TableCell className="px-3 py-4 text-right" onClick={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="项目操作" size="icon-sm" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>;
}
