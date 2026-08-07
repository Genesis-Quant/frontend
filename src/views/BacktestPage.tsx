import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { backtestApi } from "@/assets/lib/backtest";
import { errorMessage } from "@/assets/lib/utils";
import ProjectListActions from "@/components/bar/ProjectListActions";
import { AppPagination } from "@/components/pagination/AppPagination";
import { PageHero } from "@/components/bar/PageHero";
import { CreateProjectDialog, DeleteProjectDialog } from "@/components/modal/ProjectDialogs";
import ErrorPanel from "@/components/panel/ErrorPanel";
import BacktestProjectTable from "@/components/table/BacktestProjectTable";
import type { BacktestProjectListItem, BacktestProjectPage } from "@/types/backtest";

export default function BacktestPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<BacktestProjectPage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BacktestProjectListItem | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const totalPages = Math.max(1, Math.ceil((projects?.total ?? 0) / pageSize));

  useEffect(() => { load(); }, [page, pageSize]);

  async function load() {
    setLoading(true);
    setError("");
    try { setProjects(await backtestApi.listProjects(page, pageSize)); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const project = await backtestApi.createProject(title.trim());
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

  return <div className="space-y-5">
    <PageHero chips={["策略 DSL", "生命周期回调", "版本对比"]} description="管理策略回测项目、当前草稿和已保存版本，在统一任务链路中追踪执行与结果。" eyebrow="STRATEGY BACKTEST" icon={BarChart3} stat={{ label: "回测项目", value: projects?.total ?? 0 }} title="策略回测" variant="analysis" />
    <ProjectListActions createLabel="新建策略" loading={loading} onCreate={() => setCreateOpen(true)} onRefresh={load} />
    {error ? <ErrorPanel message={error} /> : null}
    <BacktestProjectTable loading={loading} projects={projects?.items ?? []} onOpen={(project) => navigate(`/backtest/projects/${project.id}`)} onDelete={setDeleteTarget} />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">共 {projects?.total ?? 0} 条</p><AppPagination page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>
    <CreateProjectDialog description="创建后设置参数，并在代码弹窗中编辑 DSL 与回调函数。" inputId="backtest-project-title" open={createOpen} placeholder="例如：沪深 300 风险平价策略" submitting={saving} title="创建策略回测项目" value={title} onCreate={create} onOpenChange={setCreateOpen} onValue={setTitle} />
    <DeleteProjectDialog description={`删除后将无法查看“${deleteTarget?.title ?? ""}”及其全部回测版本。该操作不可撤销。`} open={deleteTarget !== null} submitting={deleting} onDelete={remove} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} />
  </div>;
}
