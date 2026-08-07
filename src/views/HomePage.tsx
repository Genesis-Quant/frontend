import IconChartColumn from "~icons/lucide/chart-column";
import IconDatabase from "~icons/lucide/database";
import IconFlaskConical from "~icons/lucide/flask-conical";

import { HomeFooter } from "@/components/bar/HomeFooter";
import { HomeHeroPanel, type ResearchSlide } from "@/components/panel/HomeHeroPanel";
import { ResearchApplicationsPanel } from "@/components/panel/ResearchApplicationsPanel";
import { TaskLifecyclePanel } from "@/components/panel/TaskLifecyclePanel";

const heroImage = "https://typora-1304907527.cos.ap-nanjing.myqcloud.com/arena-quant-hero.png";
const researchSlides = [
  {
    id: "query",
    eyebrow: "DATA RESEARCH",
    title: ["统一数据查询", "从可信数据开始。"],
    description: "以结构化参数提交数据查询，在后台完成计算，并以 Parquet 结果保留可复现的数据快照。",
    action: "了解 Query",
    icon: IconDatabase,
    endpoint: "POST /api/v1/query/workflows",
    signals: [["DATASET", "统一数据集"], ["CODES", "股票池筛选"], ["OUTPUT", "按需生成结果"]]
  },
  {
    id: "factor",
    eyebrow: "FACTOR RESEARCH",
    title: ["因子有效性分析", "验证每一个研究假设。"],
    description: "完成因子预处理、信息系数和分组收益分析，将多输出结果交给后台任务统一管理。",
    action: "了解 Factor",
    icon: IconFlaskConical,
    endpoint: "POST /api/v1/factor/workflows",
    signals: [["PROCESSED", "因子预处理"], ["IC", "信息系数"], ["GROUP", "分组收益"]]
  },
  {
    id: "backtest",
    eyebrow: "STRATEGY RESEARCH",
    title: ["策略回测", "验证收益与风险。"],
    description: "提交策略参数与数据集查询，由 DolphinScheduler 在后台执行，并持续追踪状态、日志和最终报告。",
    action: "了解 Backtest",
    icon: IconChartColumn,
    endpoint: "POST /api/v1/backtest/workflows",
    signals: [["RETURNS", "收益表现"], ["RISK", "风险指标"], ["LOGS", "执行日志"]]
  }
] as const satisfies readonly ResearchSlide[];
const marketTape = ["QUERY", "FACTOR", "BACKTEST", "DOLPHINSCHEDULER", "PARQUET", "IC", "GROUP RETURN", "SHARPE", "DRAWDOWN"];

export default function HomePage() {
  return (
    <div className="overflow-hidden">
      <HomeHeroPanel image={heroImage} marketItems={marketTape} slides={researchSlides} />
      <ResearchApplicationsPanel slides={researchSlides} />
      <TaskLifecyclePanel />
      <HomeFooter />
    </div>
  );
}
