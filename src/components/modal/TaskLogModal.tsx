import TaskLogPanel from "@/components/panel/TaskLogPanel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/dialog";

type TaskLogModalProps = {
  open: boolean;
  workflowInstanceId: number | null;
  taskInstanceId: number | null;
  onOpenChange: (open: boolean) => void;
};

export default function TaskLogModal({ onOpenChange, open, taskInstanceId, workflowInstanceId }: TaskLogModalProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="h-[min(48rem,88vh)] gap-0 overflow-hidden p-0 sm:max-w-[min(960px,calc(100vw-2rem))]" showCloseButton>
    <DialogHeader className="sr-only"><DialogTitle>Task 日志</DialogTitle><DialogDescription>查看当前工作流 Task 的实时执行日志。</DialogDescription></DialogHeader>
    <TaskLogPanel className="h-full rounded-none border-0 shadow-none" reserveCloseButton taskInstanceId={taskInstanceId} title="Task 日志" workflowInstanceId={workflowInstanceId} />
  </DialogContent></Dialog>;
}
