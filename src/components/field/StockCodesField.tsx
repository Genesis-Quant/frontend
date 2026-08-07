import { Database, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { queryApi, queryResultCodes } from "@/assets/lib/query";
import { cn } from "@/assets/lib/utils";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import type { QueryProjectListItem } from "@/types/query";

type StockCodesFieldProps = {
  className?: string;
  codes: string[];
  disabled?: boolean;
  onChange: (codes: string[]) => void;
  readOnly?: boolean;
};

export default function StockCodesField({ className, codes, disabled = false, onChange, readOnly = false }: StockCodesFieldProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [projects, setProjects] = useState<QueryProjectListItem[]>([]);
  const [sourceId, setSourceId] = useState<string>();
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef(0);
  const onChangeRef = useRef(onChange);
  const draftCodes = useMemo(() => parseCodes(text), [text]);
  const sources = useMemo(
    () => projects.filter((project) => project.current?.state === "SUCCESS" && project.current.workflow_instance_id),
    [projects]
  );
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!open) return undefined;
    setText(formatCodes(codes));
    setSourceId(undefined);
    setMessage("");
    setError("");
    setImporting(false);
    setLoadingProjects(false);
    setProjects([]);
    if (readOnly) return undefined;

    let active = true;
    setLoadingProjects(true);
    queryApi.listProjects(1, 100)
      .then((page) => { if (active) setProjects(page.items); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (active) setLoadingProjects(false); });
    return () => { active = false; };
  }, [codes, open, readOnly]);

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      request.current += 1;
      setImporting(false);
    }
    setOpen(nextOpen);
  }

  function changeText(value: string) {
    setText(value);
    setSourceId(undefined);
    setMessage("");
    setError("");
  }

  async function importProject(projectId: string) {
    const project = sources.find((item) => item.id === Number(projectId));
    const workflowInstanceId = project?.current?.workflow_instance_id;
    if (!project || !workflowInstanceId) return;
    const activeRequest = ++request.current;
    setSourceId(projectId);
    setImporting(true);
    setMessage("");
    setError("");
    try {
      const importedCodes = await queryResultCodes(workflowInstanceId);
      if (request.current !== activeRequest) return;
      const nextCodes = normalizeCodes(importedCodes);
      setText(formatCodes(nextCodes));
      setMessage(`已从“${project.title}”导入 ${nextCodes.length} 只股票`);
    } catch (reason) {
      if (request.current !== activeRequest) return;
      setSourceId(undefined);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (request.current === activeRequest) setImporting(false);
    }
  }

  function confirm() {
    onChangeRef.current(draftCodes);
    setOpen(false);
  }

  const count = normalizeCodes(codes).length;
  return <div className={cn("field-block", className)}>
    <Label>股票代码</Label>
    <Button className="w-full justify-start font-normal" disabled={disabled} type="button" variant="outline" onClick={() => setOpen(true)}>{count} 只股票</Button>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>股票代码</DialogTitle><DialogDescription>输入全部股票代码，或从已有查询结果的 Parquet 中导入并按 code 去重。</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3"><Label htmlFor="stock-codes-text">股票列表</Label><span className="text-xs text-muted-foreground">{draftCodes.length} 只股票</span></div>
            <textarea id="stock-codes-text" className="min-h-72 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50" disabled={readOnly || importing} placeholder={"000001.SZ\n600000.SH"} value={text} onChange={(event) => changeText(event.target.value)} />
            <p className="text-xs text-muted-foreground">支持换行、空格、逗号或分号分隔，保存时自动去重。</p>
          </div>
          {!readOnly ? <div className="space-y-2"><Label>从已有查询结果导入</Label><Select disabled={importing || loadingProjects || !sources.length} value={sourceId} onValueChange={importProject}><SelectTrigger className="w-full">{importing ? <><Loader2 className="animate-spin" />读取 Parquet</> : loadingProjects ? <><Loader2 className="animate-spin" />加载查询项目</> : <><Database /><SelectValue placeholder={sources.length ? "选择查询结果" : "暂无成功的查询结果"} /></>}</SelectTrigger><SelectContent>{sources.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.title}</SelectItem>)}</SelectContent></Select></div> : null}
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => changeOpen(false)}>{readOnly ? "关闭" : "取消"}</Button>{!readOnly ? <Button type="button" disabled={importing} onClick={confirm}>确定</Button> : null}</DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function parseCodes(value: string) {
  return normalizeCodes(value.split(/[\s,，;；]+/));
}

function normalizeCodes(codes: readonly string[]) {
  return [...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))];
}

function formatCodes(codes: readonly string[]) {
  return normalizeCodes(codes).join("\n");
}
