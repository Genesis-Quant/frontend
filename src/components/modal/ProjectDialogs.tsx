import { Loader2, Plus, Trash2 } from "lucide-react";

import { isInputMethodComposing } from "@/assets/lib/keyboard";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

type CreateProjectDialogProps = {
  description: string;
  inputId: string;
  open: boolean;
  placeholder?: string;
  submitting: boolean;
  title: string;
  value: string;
  onCreate: () => void;
  onOpenChange: (open: boolean) => void;
  onValue: (value: string) => void;
};

export function CreateProjectDialog({ description, inputId, open, placeholder, submitting, title, value, onCreate, onOpenChange, onValue }: CreateProjectDialogProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor={inputId}>项目名称</Label><Input id={inputId} autoFocus placeholder={placeholder} value={value} onChange={(event) => onValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !isInputMethodComposing(event)) onCreate(); }} /></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={submitting || !value.trim()} onClick={onCreate}>{submitting ? <Loader2 className="animate-spin" /> : <Plus />}创建</Button></DialogFooter></DialogContent></Dialog>;
}

type DeleteProjectDialogProps = {
  description: string;
  open: boolean;
  submitting: boolean;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
};

export function DeleteProjectDialog({ description, open, submitting, onDelete, onOpenChange }: DeleteProjectDialogProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>取消</Button><Button variant="destructive" disabled={submitting} onClick={onDelete}>{submitting ? <Loader2 className="animate-spin" /> : <Trash2 />}删除</Button></DialogFooter></DialogContent></Dialog>;
}
