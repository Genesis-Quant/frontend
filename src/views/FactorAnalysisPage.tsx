import { FlaskConical, GitCompare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { factorApi } from "@/assets/lib/factor";
import { errorMessage } from "@/assets/lib/utils";
import ProjectListActions from "@/components/bar/ProjectListActions";
import { PageHero } from "@/components/bar/PageHero";
import DeleteConfirmationDialog from "@/components/modal/DeleteConfirmationDialog";
import { CreateProjectDialog } from "@/components/modal/ProjectDialogs";
import ProjectCompareDialog from "@/components/modal/ProjectCompareDialog";
import ErrorPanel from "@/components/panel/ErrorPanel";
import FactorProjectTable from "@/components/table/FactorProjectTable";
import type { FactorProjectListItem, FactorProjectPage, FactorProjectSortField } from "@/types/factor";
import type { ProjectSortOrder } from "@/types/project";
import { Button } from "@/ui/button";

const emptyProjects: FactorProjectListItem[] = [];

export default function FactorAnalysisPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<FactorProjectPage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<FactorProjectSortField>("updated_at");
  const [sortOrder, setSortOrder] = useState<ProjectSortOrder>("desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FactorProjectListItem | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const loadSequence = useRef(0);
  const allTotal = projects?.all_total ?? projects?.total ?? 0;

  useEffect(() => { load(); }, [page, pageSize, search, sortBy, sortOrder]);

  async function load() {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await factorApi.listProjects({ page, page_size: pageSize, search: search || undefined, sort_by: sortBy, sort_order: sortOrder });
      if (sequence === loadSequence.current) {
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

  function changeSearch(value: string) { setPage(1); setSearch(value); }
  function changeSorting(field: FactorProjectSortField, order: ProjectSortOrder) { setPage(1); setSortBy(field); setSortOrder(order); }

  return <div className="space-y-5">
    <PageHero chips={["多因子分析", "版本迭代", "横向对比"]} description="管理因子分析项目、当前草稿和已保存版本，继续迭代同一项研究。" eyebrow="FACTOR ANALYSIS" icon={FlaskConical} stat={{ label: "研究项目", value: allTotal }} title="因子分析" variant="analysis" />

    <ProjectListActions createLabel="新建分析" loading={loading} onCreate={() => setCreateOpen(true)} onRefresh={load}><Button variant="outline" disabled={allTotal === 0} onClick={() => setCompareOpen(true)}><GitCompare />对比研究</Button></ProjectListActions>
    {error ? <ErrorPanel message={error} /> : null}
    <FactorProjectTable loading={loading} onDelete={setDeleteTarget} onOpen={(project) => navigate(`/factor/projects/${project.id}`)} onPage={setPage} onPageSize={setPageSize} onSearch={changeSearch} onSort={changeSorting} page={page} pageSize={pageSize} projects={projects?.items ?? emptyProjects} search={search} sortBy={sortBy} sortOrder={sortOrder} total={projects?.total ?? 0} />

    <CreateProjectDialog description="创建后进入研究页设置参数和 DSL。" inputId="factor-project-title" open={createOpen} placeholder="例如：量价因子有效性研究" submitting={saving} title="创建因子研究项目" value={title} onCreate={create} onOpenChange={setCreateOpen} onValue={setTitle} />
    <DeleteConfirmationDialog description={`删除后将无法查看“${deleteTarget?.title ?? ""}”及其所有历史版本。该操作不可撤销。`} open={deleteTarget !== null} submitting={deleting} onDelete={remove} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} />
    <ProjectCompareDialog kind="factor" open={compareOpen} title="因子分析" onOpenChange={setCompareOpen} />
  </div>;
}
