import { Loader2, Play, Square } from "lucide-react";

import { Button } from "@/ui/button";

type WorkflowRunButtonProps = {
  active: boolean;
  className?: string;
  disabled?: boolean;
  label: string;
  stopping: boolean;
  submitting: boolean;
  onRun: () => void;
  onStop: () => void;
};

export default function WorkflowRunButton({ active, className, disabled = false, label, onRun, onStop, stopping, submitting }: WorkflowRunButtonProps) {
  if (submitting) return <Button className={className} disabled><Loader2 className="animate-spin" />正在提交</Button>;
  if (active) return <Button className={className} variant="destructive" disabled={stopping} onClick={onStop}>{stopping ? <Loader2 className="animate-spin" /> : <Square />}{stopping ? "正在终止" : "终止工作流"}</Button>;
  return <Button className={className} disabled={disabled} onClick={onRun}><Play />{label}</Button>;
}
