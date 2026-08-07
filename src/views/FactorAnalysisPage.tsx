import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { factorApi } from "@/assets/lib/factor";
import { errorMessage } from "@/assets/lib/utils";
import ProjectListActions from "@/components/bar/ProjectListActions";
import { AppPagination } from "@/components/pagination/AppPagination";
import { PageHero } from "@/components/bar/PageHero";
import { CreateProjectDialog, DeleteProjectDialog } from "@/components/modal/ProjectDialogs";
import ErrorPanel from "@/components/panel/ErrorPanel";
import FactorProjectTable from "@/components/table/FactorProjectTable";
import type { FactorProjectListItem, FactorProjectPage } from "@/types/factor";

export default function FactorAnalysisPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<FactorProjectPage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FactorProjectListItem | null>(null);
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
    try { setProjects(await factorApi.listProjects(page, pageSize)); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const project = await factorApi.createProject(title.trim());
      setCreateOpen(false);
      navigate(`/factor/projects/${project.id}`);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await factorApi.deleteProject(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setDeleting(false); }
  }

  return <div className="space-y-5">
    <PageHero chips={["多因子分析", "版本迭代", "参数回填"]} description="管理因子分析项目、当前草稿和已保存版本，继续迭代同一项研究。" eyebrow="FACTOR ANALYSIS" icon={FlaskConical} stat={{ label: "研究项目", value: projects?.total ?? 0 }} title="因子分析" variant="analysis" />

    <ProjectListActions createLabel="新建分析" loading={loading} onCreate={() => setCreateOpen(true)} onRefresh={load} />
    {error ? <ErrorPanel message={error} /> : null}
    <FactorProjectTable loading={loading} projects={projects?.items ?? []} onOpen={(project) => navigate(`/factor/projects/${project.id}`)} onDelete={setDeleteTarget} />

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">共 {projects?.total ?? 0} 条</p><AppPagination page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>

    <CreateProjectDialog description="创建后进入研究页设置参数和 DSL。" inputId="factor-project-title" open={createOpen} placeholder="例如：量价因子有效性研究" submitting={saving} title="创建因子研究项目" value={title} onCreate={create} onOpenChange={setCreateOpen} onValue={setTitle} />
    <DeleteProjectDialog description={`删除后将无法查看“${deleteTarget?.title ?? ""}”及其所有历史版本。该操作不可撤销。`} open={deleteTarget !== null} submitting={deleting} onDelete={remove} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} />
  </div>;
}
