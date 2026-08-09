import { Workflow } from "lucide-react";
import { useCallback, useState } from "react";

import { PageHero } from "@/components/bar/PageHero";
import WorkflowPanel from "@/components/panel/WorkflowPanel";

export default function WorkflowsPage() {
  const [total, setTotal] = useState(0);
  const updateTotal = useCallback((value: number) => setTotal(value), []);
  return <div className="space-y-6">
    <PageHero chips={["按工作空间分组", "运行记录", "实时任务"]} description="按工作空间查看 Query、Factor、Backtest 和 Incremental 的当前运行，并展开追溯每次提交与执行记录。" eyebrow="WORKFLOWS" icon={Workflow} stat={{ label: "筛选结果", value: total }} title="工作流管理" variant="analysis" />
    <WorkflowPanel onTotalChange={updateTotal} />
  </div>;
}
