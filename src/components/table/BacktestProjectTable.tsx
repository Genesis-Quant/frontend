import { Activity, Loader2, MoreHorizontal, Trash2 } from "lucide-react";

import { formatDateTime } from "@/assets/lib/dateTime";
import { ProjectTableState } from "@/components/table/ProjectTableState";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import type { BacktestProjectListItem } from "@/types/backtest";

type BacktestProjectTableProps = { loading: boolean; projects: BacktestProjectListItem[]; onDelete: (project: BacktestProjectListItem) => void; onOpen: (project: BacktestProjectListItem) => void };

export default function BacktestProjectTable({ loading, projects, onDelete, onOpen }: BacktestProjectTableProps) {
  return <Card className="overflow-hidden py-0 shadow-sm"><CardContent className="p-0"><Table className="min-w-[1260px] table-fixed"><TableHeader><TableRow><TableHead className="w-20 px-5">ID</TableHead><TableHead className="w-[260px] px-4">名称</TableHead><TableHead className="w-28 px-4">最新版本</TableHead><TableHead className="w-28 px-3 text-right">累计收益</TableHead><TableHead className="w-28 px-3 text-right">年化收益</TableHead><TableHead className="w-28 px-3 text-right">夏普比率</TableHead><TableHead className="w-28 px-3 text-right">年化波动</TableHead><TableHead className="w-28 px-3 text-right">最大回撤</TableHead><TableHead className="w-24 px-3 text-right">日胜率</TableHead><TableHead className="w-40 px-3">更新时间</TableHead><TableHead className="w-16 px-3 text-right">操作</TableHead></TableRow></TableHeader><TableBody>{projects.map((project) => <BacktestProjectRow key={project.id} project={project} onOpen={() => onOpen(project)} onDelete={() => onDelete(project)} />)}{loading ? <ProjectTableState colSpan={11}><Loader2 className="animate-spin" />正在加载...</ProjectTableState> : null}{!loading && !projects.length ? <ProjectTableState colSpan={11}><Activity className="size-4" />暂无回测项目</ProjectTableState> : null}</TableBody></Table></CardContent></Card>;
}

function BacktestProjectRow({ onDelete, onOpen, project }: { onDelete: () => void; onOpen: () => void; project: BacktestProjectListItem }) {
  return <TableRow className="group cursor-pointer" onClick={onOpen}><TableCell className="px-5 py-4 font-mono text-xs text-muted-foreground">{project.id}</TableCell><TableCell className="px-4 py-4 font-medium group-hover:underline">{project.title}</TableCell><TableCell className="px-4 py-4"><Badge variant="secondary">{project.latest_version ? `v${project.latest_version}` : "—"}</Badge></TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{percent(project.latest_summary?.totalReturn)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{percent(project.latest_summary?.annualReturn)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{decimal(project.latest_summary?.sharpeRatio)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{percent(project.latest_summary?.annualVolatility)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{percent(project.latest_summary?.maxDrawdown)}</TableCell><TableCell className="px-3 py-4 text-right tabular-nums">{percent(project.latest_summary?.dailyWinningRate)}</TableCell><TableCell className="px-3 py-4 text-muted-foreground">{formatDateTime(project.updated_at)}</TableCell><TableCell className="px-3 py-4 text-right" onClick={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="项目操作" size="icon-sm" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>;
}

function percent(value: number | null | undefined) { return value === null || value === undefined ? "—" : `${(value * 100).toFixed(2)}%`; }
function decimal(value: number | null | undefined) { return value === null || value === undefined ? "—" : value.toFixed(3); }
