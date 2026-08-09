import { ListPlus, Loader2 } from "lucide-react";

import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

export default function QueueSubmitDialog({ open, remark, submitting, onOpenChange, onRemark, onSubmit }: { open: boolean; remark: string; submitting: boolean; onOpenChange: (open: boolean) => void; onRemark: (remark: string) => void; onSubmit: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>提交到队列</DialogTitle><DialogDescription>加入本地队列，批量执行后自动生成新版本。</DialogDescription></DialogHeader>
      <div className="space-y-2"><Label htmlFor="queue-remark">备注（可选）</Label><Input id="queue-remark" maxLength={512} value={remark} onChange={(event) => onRemark(event.target.value)} /></div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={submitting} onClick={onSubmit}>{submitting ? <Loader2 className="animate-spin" /> : <ListPlus />}提交</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
