import { DatabaseZap, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { queryApi } from "@/assets/lib/query";
import { errorMessage } from "@/assets/lib/utils";
import ProjectListActions from "@/components/bar/ProjectListActions";
import { PageHero } from "@/components/bar/PageHero";
import DeleteConfirmationDialog from "@/components/modal/DeleteConfirmationDialog";
import { CreateProjectDialog } from "@/components/modal/ProjectDialogs";
import { useKeepAliveReactivation } from "@/components/layout/keepAliveContext";
import ErrorPanel from "@/components/panel/ErrorPanel";
import QueryProjectTable from "@/components/table/QueryProjectTable";
import { Button } from "@/ui/button";
import type { ProjectSortOrder } from "@/types/project";
import type { QueryProjectListItem, QueryProjectPage, QueryProjectSortField } from "@/types/query";

const emptyProjects: QueryProjectListItem[] = [];

export default function QueryPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<QueryProjectPage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<QueryProjectSortField>("updated_at");
  const [sortOrder, setSortOrder] = useState<ProjectSortOrder>("desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QueryProjectListItem | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const loadSequence = useRef(0);
  const allTotal = projects?.all_total ?? projects?.total ?? 0;
  const atLimit = allTotal >= (projects?.limit ?? 5);

  useEffect(() => { load(); }, [page, pageSize, search, sortBy, sortOrder]);
  useKeepAliveReactivation(() => { load(true); });

  async function load(background = false) {
    const sequence = ++loadSequence.current;
    if (!background) setLoading(true);
    setError("");
    try {
      const result = await queryApi.listProjects({ page, page_size: pageSize, search: search || undefined, sort_by: sortBy, sort_order: sortOrder });
      if (sequence === loadSequence.current) {
        const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
        if (page > lastPage) setPage(lastPage);
        else setProjects(result);
      }
    } catch (reason) { if (sequence === loadSequence.current) setError(errorMessage(reason)); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }

  async function create() {
    if (!title.trim() || atLimit) return;
    setSaving(true);
    setError("");
    try {
      const project = await queryApi.createProject(title.trim());
      setCreateOpen(false);
      navigate(`/query/projects/${project.id}`);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await queryApi.deleteProject(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setDeleting(false); }
  }

  function changeSearch(value: string) { setPage(1); setSearch(value); }
  function changeSorting(field: QueryProjectSortField, order: ProjectSortOrder) { setPage(1); setSortBy(field); setSortOrder(order); }

  return <div className="space-y-5">
    <PageHero chips={["查询 DSL", "Parquet", "DuckDB SQL"]} description="通过 DSL 生成查询结果，并在浏览器中使用 SQL 关联当前用户已有项目的 Parquet。" eyebrow="DATA QUERY" icon={DatabaseZap} stat={{ label: "查询项目", value: `${allTotal}/${projects?.limit ?? 5}` }} title="数据查询" variant="analysis" />
    <ProjectListActions createDisabled={atLimit} createLabel="新建查询" loading={loading} onCreate={() => setCreateOpen(true)} onRefresh={() => { load(); }}><Button variant="outline" onClick={() => navigate("/query/secondary")}><Terminal />SQL 二次查询</Button></ProjectListActions>
    {error ? <ErrorPanel message={error} /> : null}
    <QueryProjectTable loading={loading} onDelete={setDeleteTarget} onOpen={(project) => navigate(`/query/projects/${project.id}`)} onPage={setPage} onPageSize={setPageSize} onSearch={changeSearch} onSort={changeSorting} page={page} pageSize={pageSize} projects={projects?.items ?? emptyProjects} search={search} sortBy={sortBy} sortOrder={sortOrder} total={projects?.total ?? 0} />
    <p className="text-sm text-muted-foreground">每个用户最多创建 {projects?.limit ?? 5} 个项目</p>
    <CreateProjectDialog description="项目保存当前查询结果，不创建历史版本。" inputId="query-project-title" open={createOpen} submitting={saving} title="创建查询项目" value={title} onCreate={create} onOpenChange={setCreateOpen} onValue={setTitle} />
    <DeleteConfirmationDialog description={`删除后将同时清理“${deleteTarget?.title ?? ""}”的查询工作流和 Parquet 结果。`} open={deleteTarget !== null} submitting={deleting} onDelete={remove} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} />
  </div>;
}
