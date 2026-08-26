import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { backtestApi } from "@/assets/lib/backtest";
import { factorApi } from "@/assets/lib/factor";
import { errorMessage } from "@/assets/lib/utils";
import { VersionCompareResult, type CompareVersion } from "@/components/modal/VersionCompareDialog";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, LargeDialogContent } from "@/ui/dialog";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";

type CompareKind = "factor" | "backtest";
type ProjectOption = { id: number; title: string; latest_version: number | null };
type VersionOption = { id: number; version: number; saved: boolean; remark: string };
type CompareSide = "left" | "right";

type ProjectCompareDialogProps = {
  kind: CompareKind;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export default function ProjectCompareDialog({ kind, onOpenChange, open, title }: ProjectCompareDialogProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [leftProjectId, setLeftProjectId] = useState<number | null>(null);
  const [rightProjectId, setRightProjectId] = useState<number | null>(null);
  const [leftVersions, setLeftVersions] = useState<VersionOption[]>([]);
  const [rightVersions, setRightVersions] = useState<VersionOption[]>([]);
  const [leftVersion, setLeftVersion] = useState<number | null>(null);
  const [rightVersion, setRightVersion] = useState<number | null>(null);
  const [result, setResult] = useState<{ left: CompareVersion; right: CompareVersion; leftTitle: string; rightTitle: string } | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState<Record<CompareSide, boolean>>({ left: false, right: false });
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");
  const versionRequestIds = useRef<Record<CompareSide, number>>({ left: 0, right: 0 });
  const loading = loadingProjects || loadingVersions.left || loadingVersions.right || comparing;

  useEffect(() => {
    if (!open) return undefined;
    let disposed = false;
    setProjects([]);
    setLeftProjectId(null);
    setRightProjectId(null);
    setLeftVersions([]);
    setRightVersions([]);
    setLeftVersion(null);
    setRightVersion(null);
    setResult(null);
    setError("");
    versionRequestIds.current.left += 1;
    versionRequestIds.current.right += 1;
    setLoadingVersions({ left: false, right: false });
    setComparing(false);
    setLoadingProjects(true);
    (kind === "factor" ? factorApi.listProjects({ page: 1, page_size: 100 }) : backtestApi.listProjects({ page: 1, page_size: 100 }))
      .then((response) => {
        if (disposed) return;
        setProjects(response.items.map(({ id, latest_version, title }) => ({ id, latest_version, title })));
      })
      .catch((reason) => { if (!disposed) setError(errorMessage(reason)); })
      .finally(() => { if (!disposed) setLoadingProjects(false); });
    return () => { disposed = true; };
  }, [kind, open]);

  async function selectProject(side: CompareSide, value: string) {
    const projectId = value ? Number(value) : null;
    const requestId = versionRequestIds.current[side] + 1;
    versionRequestIds.current[side] = requestId;
    const setProjectId = side === "left" ? setLeftProjectId : setRightProjectId;
    const setVersion = side === "left" ? setLeftVersion : setRightVersion;
    const setVersions = side === "left" ? setLeftVersions : setRightVersions;
    setProjectId(projectId);
    setVersion(null);
    setVersions([]);
    setLoadingVersions((current) => ({ ...current, [side]: Boolean(projectId) }));
    if (!projectId) return;
    setError("");
    try {
      const versions = kind === "factor" ? await factorApi.listVersions(projectId) : await backtestApi.listVersions(projectId);
      if (versionRequestIds.current[side] !== requestId) return;
      setVersions(versions.filter((item) => item.saved || item.is_current).map(({ id, remark, saved, version }) => ({ id, remark, saved, version })).sort((left, right) => left.version - right.version));
    } catch (reason) {
      if (versionRequestIds.current[side] === requestId) setError(errorMessage(reason));
    } finally {
      if (versionRequestIds.current[side] === requestId) {
        setLoadingVersions((current) => ({ ...current, [side]: false }));
      }
    }
  }

  async function compare() {
    if (leftProjectId === null || rightProjectId === null || leftVersion === null || rightVersion === null || loading) return;
    setComparing(true);
    setError("");
    try {
      const [left, right] = kind === "factor"
        ? await Promise.all([factorApi.getVersion(leftProjectId, leftVersion), factorApi.getVersion(rightProjectId, rightVersion)])
        : await Promise.all([backtestApi.getVersion(leftProjectId, leftVersion), backtestApi.getVersion(rightProjectId, rightVersion)]);
      const leftTitle = projects.find((project) => project.id === leftProjectId)?.title ?? `项目 #${leftProjectId}`;
      const rightTitle = projects.find((project) => project.id === rightProjectId)?.title ?? `项目 #${rightProjectId}`;
      setResult({ left, right, leftTitle, rightTitle });
      onOpenChange(false);
      setResultOpen(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setComparing(false);
    }
  }

  function closeResult(nextOpen: boolean) {
    setResultOpen(nextOpen);
    if (!nextOpen) setResult(null);
  }

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>选择对比研究</DialogTitle><DialogDescription>左右两侧可以选择不同研究，也可以选择同一研究的不同版本。</DialogDescription></DialogHeader>
        {loading && !projects.length ? <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />加载可对比研究...</div> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CompareSelector itemLabel="左侧研究" itemId={leftProjectId} items={projects} onItemChange={(value) => { selectProject("left", value).catch(() => undefined); }} onVersionChange={(value) => setLeftVersion(value ? Number(value) : null)} version={leftVersion} versionLabel="左侧版本" versions={leftVersions} />
          <CompareSelector itemLabel="右侧研究" itemId={rightProjectId} items={projects} onItemChange={(value) => { selectProject("right", value).catch(() => undefined); }} onVersionChange={(value) => setRightVersion(value ? Number(value) : null)} version={rightVersion} versionLabel="右侧版本" versions={rightVersions} />
        </div>
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button><Button onClick={() => { compare().catch(() => undefined); }} disabled={loading || leftProjectId === null || rightProjectId === null || leftVersion === null || rightVersion === null}>{loading ? <Loader2 className="animate-spin" /> : null}开始对比</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={resultOpen} onOpenChange={closeResult}>
      <LargeDialogContent className="flex flex-col overflow-hidden">
        <DialogHeader><DialogTitle>{title}对比</DialogTitle><DialogDescription>左右两侧展示所选研究与版本，图表使用统一坐标范围便于横向比较。</DialogDescription></DialogHeader>
        {result ? <VersionCompareResult kind={kind} left={result.left} leftProjectTitle={result.leftTitle} right={result.right} rightProjectTitle={result.rightTitle} /> : <div className="py-10 text-center text-sm text-muted-foreground">请选择要对比的版本</div>}
      </LargeDialogContent>
    </Dialog>
  </>;
}

function CompareSelector({ itemId, itemLabel, items, onItemChange, onVersionChange, version, versionLabel, versions }: { itemId: number | null; itemLabel: string; items: ProjectOption[]; onItemChange: (value: string) => void; onVersionChange: (value: string) => void; version: number | null; versionLabel: string; versions: VersionOption[] }) {
  return <div className="space-y-4 rounded-md border bg-muted/15 p-4">
    <div className="space-y-2"><Label>{itemLabel}</Label><Select value={itemId === null ? undefined : String(itemId)} onValueChange={onItemChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{items.length ? items.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.title}</SelectItem>) : <SelectItem value="__empty__" disabled>暂无可选研究</SelectItem>}</SelectContent></Select></div>
    <div className="space-y-2"><Label>{versionLabel}</Label><Select value={version === null ? undefined : String(version)} onValueChange={onVersionChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{versions.length ? versions.map((item) => <SelectItem key={item.version} value={String(item.version)}>v{item.version}{item.saved ? "" : " · 未保存"}</SelectItem>) : <SelectItem value="__empty__" disabled>{itemId === null ? "请先选择研究" : "暂无可选版本"}</SelectItem>}</SelectContent></Select></div>
  </div>;
}
