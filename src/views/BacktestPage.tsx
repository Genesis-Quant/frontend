import { BarChart3, GitCompare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { backtestApi } from "@/assets/lib/backtest";
import { errorMessage } from "@/assets/lib/utils";
import ProjectListActions from "@/components/bar/ProjectListActions";
import { PageHero } from "@/components/bar/PageHero";
import DeleteConfirmationDialog from "@/components/modal/DeleteConfirmationDialog";
import { CreateProjectDialog } from "@/components/modal/ProjectDialogs";
import ProjectCompareDialog from "@/components/modal/ProjectCompareDialog";
import ErrorPanel from "@/components/panel/ErrorPanel";
import BacktestProjectTable from "@/components/table/BacktestProjectTable";
import { defaultBacktestParameters, type BacktestProjectListItem, type BacktestProjectPage, type BacktestProjectSortField } from "@/types/backtest";
import type { ProjectSortOrder } from "@/types/project";
import { Button } from "@/ui/button";

const emptyProjects: BacktestProjectListItem[] = [];

export default function BacktestPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<BacktestProjectPage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<BacktestProjectSortField>("updated_at");
  const [sortOrder, setSortOrder] = useState<ProjectSortOrder>("desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BacktestProjectListItem | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const loadSequence = useRef(0);
  const hasLoadedProjects = useRef(false);
  const allTotal = projects?.all_total ?? projects?.total ?? 0;

  useEffect(() => { load(hasLoadedProjects.current); }, [page, pageSize, search, sortBy, sortOrder]);

  async function load(background = false) {
    const sequence = ++loadSequence.current;
    if (!background) setLoading(true);
    setError("");
    try {
      const result = await backtestApi.listProjects({ page, page_size: pageSize, search: search || undefined, sort_by: sortBy, sort_order: sortOrder });
      if (sequence === loadSequence.current) {
        hasLoadedProjects.current = true;
        const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
        if (page > lastPage) setPage(lastPage);
        else setProjects(result);
      }
    } catch (reason) { if (sequence === loadSequence.current) setError(errorMessage(reason)); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const project = await backtestApi.createProject(title.trim(), defaultBacktestParameters());
      setCreateOpen(false);
      navigate(`/backtest/projects/${project.id}`);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await backtestApi.deleteProject(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setDeleting(false); }
  }

  function changeSearch(value: string) { setPage(1); setSearch(value); }
  function changeSorting(field: BacktestProjectSortField, order: ProjectSortOrder) { setPage(1); setSortBy(field); setSortOrder(order); }

  return <div className="space-y-5">
    <PageHero chips={["策略 DSL", "生命周期回调", "版本对比"]} description="管理策略回测项目、当前草稿和已保存版本，在统一任务链路中追踪执行与结果。" eyebrow="STRATEGY BACKTEST" icon={BarChart3} stat={{ label: "回测项目", value: allTotal }} title="策略回测" variant="analysis" />
    <ProjectListActions createLabel="新建策略" loading={loading} onCreate={() => setCreateOpen(true)} onRefresh={() => { load(); }}><Button variant="outline" disabled={allTotal === 0} onClick={() => setCompareOpen(true)}><GitCompare />对比研究</Button></ProjectListActions>
    {error ? <ErrorPanel message={error} /> : null}
    <BacktestProjectTable loading={loading} onDelete={setDeleteTarget} onOpen={(project) => navigate(`/backtest/projects/${project.id}`)} onPage={setPage} onPageSize={setPageSize} onSearch={changeSearch} onSort={changeSorting} page={page} pageSize={pageSize} projects={projects?.items ?? emptyProjects} search={search} sortBy={sortBy} sortOrder={sortOrder} total={projects?.total ?? 0} />
    <CreateProjectDialog description="创建后设置参数，并在代码弹窗中编辑 DSL 与回调函数。" inputId="backtest-project-title" open={createOpen} placeholder="例如：沪深 300 风险平价策略" submitting={saving} title="创建策略回测项目" value={title} onCreate={create} onOpenChange={setCreateOpen} onValue={setTitle} />
    <DeleteConfirmationDialog description={`删除后将无法查看“${deleteTarget?.title ?? ""}”及其全部回测版本。该操作不可撤销。`} open={deleteTarget !== null} submitting={deleting} onDelete={remove} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} />
    <ProjectCompareDialog kind="backtest" open={compareOpen} title="策略回测" onOpenChange={setCompareOpen} />
  </div>;
}
