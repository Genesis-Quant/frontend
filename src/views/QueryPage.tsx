import { DatabaseZap, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { queryApi } from "@/assets/lib/query";
import { errorMessage } from "@/assets/lib/utils";
import ProjectListActions from "@/components/bar/ProjectListActions";
import { AppPagination } from "@/components/pagination/AppPagination";
import { PageHero } from "@/components/bar/PageHero";
import { CreateProjectDialog, DeleteProjectDialog } from "@/components/modal/ProjectDialogs";
import ErrorPanel from "@/components/panel/ErrorPanel";
import QueryProjectTable from "@/components/table/QueryProjectTable";
import { Button } from "@/ui/button";
import type { QueryProjectListItem, QueryProjectPage } from "@/types/query";

export default function QueryPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<QueryProjectPage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QueryProjectListItem | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const totalPages = Math.max(1, Math.ceil((projects?.total ?? 0) / pageSize));
  const atLimit = (projects?.total ?? 0) >= (projects?.limit ?? 5);

  useEffect(() => { load(); }, [page, pageSize]);

  async function load() {
    setLoading(true);
    setError("");
    try { setProjects(await queryApi.listProjects(page, pageSize)); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
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

  return <div className="space-y-5">
    <PageHero chips={["查询 DSL", "Parquet", "DuckDB SQL"]} description="通过 DSL 生成查询结果，并在浏览器中使用 SQL 关联当前用户已有项目的 Parquet。" eyebrow="DATA QUERY" icon={DatabaseZap} stat={{ label: "查询项目", value: `${projects?.total ?? 0}/${projects?.limit ?? 5}` }} title="数据查询" variant="analysis" />
    <ProjectListActions createDisabled={atLimit} createLabel="新建查询" loading={loading} onCreate={() => setCreateOpen(true)} onRefresh={load}><Button variant="outline" onClick={() => navigate("/query/secondary")}><Terminal />SQL 二次查询</Button></ProjectListActions>
    {error ? <ErrorPanel message={error} /> : null}
    <QueryProjectTable loading={loading} projects={projects?.items ?? []} onOpen={(project) => navigate(`/query/projects/${project.id}`)} onDelete={setDeleteTarget} />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">每个用户最多创建 {projects?.limit ?? 5} 个项目</p><AppPagination page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>
    <CreateProjectDialog description="项目保存当前查询结果，不创建历史版本。" inputId="query-project-title" open={createOpen} submitting={saving} title="创建查询项目" value={title} onCreate={create} onOpenChange={setCreateOpen} onValue={setTitle} />
    <DeleteProjectDialog description={`删除后将同时清理“${deleteTarget?.title ?? ""}”的查询工作流和 Parquet 结果。`} open={deleteTarget !== null} submitting={deleting} onDelete={remove} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} />
  </div>;
}
