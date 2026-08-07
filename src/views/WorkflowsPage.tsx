import { Workflow } from "lucide-react";
import { useCallback, useState } from "react";

import { PageHero } from "@/components/bar/PageHero";
import WorkflowPanel from "@/components/panel/WorkflowPanel";

export default function WorkflowsPage() {
  const [total, setTotal] = useState(0);
  const updateTotal = useCallback((value: number) => setTotal(value), []);
  return <div className="space-y-6">
    <PageHero chips={["统一状态", "实时 Task", "自动刷新"]} description="查看 Query、Factor、Backtest 和 Incremental 的工作流实例，以及从 DolphinScheduler 实时获取的 Task。" eyebrow="WORKFLOWS" icon={Workflow} stat={{ label: "筛选结果", value: total }} title="工作流管理" variant="analysis" />
    <WorkflowPanel onTotalChange={updateTotal} />
  </div>;
}
