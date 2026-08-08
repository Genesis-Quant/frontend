import { Check, Loader2 } from "lucide-react";

import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

export default function SaveVersionDialog({ latestVersion, onClose, onRemark, onSave, open, remark, submitting }: { latestVersion: number | null; onClose: () => void; onRemark: (remark: string) => void; onSave: () => void; open: boolean; remark: string; submitting: boolean }) {
  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}><DialogContent><DialogHeader><DialogTitle>保存为 v{(latestVersion ?? 0) + 1}</DialogTitle><DialogDescription>当前任务输入、Parquet 结果和指标摘要将作为不可变版本保存。</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="version-remark">版本备注（可选）</Label><Input id="version-remark" maxLength={512} value={remark} onChange={(event) => onRemark(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={onSave} disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : <Check />}保存</Button></DialogFooter></DialogContent></Dialog>;
}
