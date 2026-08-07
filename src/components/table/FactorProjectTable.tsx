import { Loader2, MoreHorizontal, Trash2 } from "lucide-react";

import { formatDateTime } from "@/assets/lib/dateTime";
import { ProjectTableState } from "@/components/table/ProjectTableState";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import type { FactorProjectListItem } from "@/types/factor";

type FactorProjectTableProps = { loading: boolean; projects: FactorProjectListItem[]; onDelete: (project: FactorProjectListItem) => void; onOpen: (project: FactorProjectListItem) => void };

export default function FactorProjectTable({ loading, projects, onDelete, onOpen }: FactorProjectTableProps) {
  return <Card className="overflow-hidden py-0 shadow-sm"><CardContent className="p-0"><Table className="min-w-[1200px] table-fixed"><TableHeader><TableRow><TableHead className="w-20 px-5">ID</TableHead><TableHead className="w-[260px] px-4">名称</TableHead><TableHead className="w-28 px-4">最新版本</TableHead><TableHead className="w-28 px-3 text-right">IC 均值</TableHead><TableHead className="w-28 px-3 text-right">RankIC 均值</TableHead><TableHead className="w-24 px-3 text-right">ICIR</TableHead><TableHead className="w-28 px-3 text-right">多空收益</TableHead><TableHead className="w-24 px-3 text-right">多空夏普</TableHead><TableHead className="w-40 px-3">更新时间</TableHead><TableHead className="w-16 px-3 text-right">操作</TableHead></TableRow></TableHeader><TableBody>{projects.map((project) => <FactorProjectRow key={project.id} project={project} onOpen={() => onOpen(project)} onDelete={() => onDelete(project)} />)}{loading ? <ProjectTableState colSpan={10}><Loader2 className="animate-spin" />正在加载...</ProjectTableState> : null}{!loading && !projects.length ? <ProjectTableState colSpan={10}>暂无研究项目</ProjectTableState> : null}</TableBody></Table></CardContent></Card>;
}

function FactorProjectRow({ onDelete, onOpen, project }: { onDelete: () => void; onOpen: () => void; project: FactorProjectListItem }) {
  const metric = project.latest_metric;
  return <TableRow className="group cursor-pointer" onClick={onOpen}><TableCell className="px-5 py-4 font-mono text-xs text-muted-foreground">{project.id}</TableCell><TableCell className="px-4 py-4 font-medium group-hover:underline">{project.title}</TableCell><TableCell className="px-4 py-4"><Badge variant="secondary" className="tabular-nums">{project.latest_version ? `v${project.latest_version}` : "—"}</Badge></TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{formatMetric(metric?.ic_mean)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{formatMetric(metric?.rank_ic_mean)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{formatMetric(metric?.ic_ir)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{formatMetric(metric?.long_short_cumulative_return, true)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{formatMetric(metric?.long_short_sharpe)}</TableCell><TableCell className="px-3 py-4 text-muted-foreground">{formatDateTime(project.updated_at)}</TableCell><TableCell className="px-3 py-4 text-right" onClick={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="项目操作" size="icon-sm" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>;
}

function formatMetric(value: number | null | undefined, percent = false) { if (value === null || value === undefined) return "—"; return percent ? `${(value * 100).toFixed(2)}%` : value.toFixed(4); }
