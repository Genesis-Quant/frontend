import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";

type DeleteConfirmationDialogProps = {
  actionLabel?: string;
  description: string;
  error?: string;
  open: boolean;
  submitting: boolean;
  title?: string;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
};

export default function DeleteConfirmationDialog({ actionLabel = "删除", description, error, open, submitting, title = "确认删除", onDelete, onOpenChange }: DeleteConfirmationDialogProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{error ? <p className="text-sm text-destructive">{error}</p> : null}<DialogFooter><Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>取消</Button><Button variant="destructive" disabled={submitting} onClick={onDelete}>{submitting ? <Loader2 className="animate-spin" /> : <Trash2 />}{actionLabel}</Button></DialogFooter></DialogContent></Dialog>;
}
