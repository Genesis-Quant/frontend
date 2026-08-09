import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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

type RenameDialogProps = {
  description: string;
  error?: string;
  inputId: string;
  label: string;
  maxLength: number;
  open: boolean;
  submitting: boolean;
  title: string;
  value: string;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onValue: (value: string) => void;
};

export function RenameDialog({ description, error, inputId, label, maxLength, open, submitting, title, value, onOpenChange, onRename, onValue }: RenameDialogProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor={inputId}>{label}</Label><Input id={inputId} autoFocus maxLength={maxLength} value={value} onChange={(event) => onValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !isInputMethodComposing(event)) { event.preventDefault(); onRename(); } }} />{error ? <p className="text-sm text-destructive">{error}</p> : null}</div><DialogFooter><Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>取消</Button><Button disabled={submitting || !value.trim()} onClick={onRename}>{submitting ? <Loader2 className="animate-spin" /> : <Pencil />}保存</Button></DialogFooter></DialogContent></Dialog>;
}

type DeleteVersionDialogProps = {
  error?: string;
  open: boolean;
  submitting: boolean;
  version: number | null;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
};

export function DeleteVersionDialog({ error, open, submitting, version, onDelete, onOpenChange }: DeleteVersionDialogProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>删除版本 v{version}</DialogTitle><DialogDescription>版本关联的工作流、结果文件和批量分析记录将同时删除，此操作不可撤销。</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}<DialogFooter><Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>取消</Button><Button variant="destructive" disabled={submitting || version === null} onClick={onDelete}>{submitting ? <Loader2 className="animate-spin" /> : <Trash2 />}删除版本</Button></DialogFooter></DialogContent></Dialog>;
}
