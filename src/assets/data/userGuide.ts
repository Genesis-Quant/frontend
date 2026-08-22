import backtestContent from "@/assets/docs/guide/backtest.md?raw";
import factorContent from "@/assets/docs/guide/factor.md?raw";
import queryContent from "@/assets/docs/guide/query.md?raw";
import quickStartContent from "@/assets/docs/guide/quick-start.md?raw";
import researchModelContent from "@/assets/docs/guide/research-model.md?raw";
import resultsContent from "@/assets/docs/guide/results.md?raw";
import workflowsContent from "@/assets/docs/guide/workflows.md?raw";
import type { DocumentationItem, DocumentationSection } from "@/components/layout/DocumentationWorkspace";

export type UserGuideDocument = DocumentationItem & {
  content: string;
};

export type UserGuideSection = Omit<DocumentationSection, "items"> & {
  items: UserGuideDocument[];
};

export const userGuideSections: UserGuideSection[] = [
  {
    slug: "start",
    title: "开始使用",
    description: "先理解页面和研究对象",
    items: [
      {
        slug: "quick-start",
        title: "快速开始",
        description: "从新建项目到读取结果的完整路径。",
        content: quickStartContent
      },
      {
        slug: "research-model",
        title: "项目、版本与运行记录",
        description: "Project、Version、Workspace、Attempt、Workflow 和 Task 的关系。",
        content: researchModelContent
      }
    ]
  },
  {
    slug: "research",
    title: "研究应用",
    description: "三类研究的实际操作",
    items: [
      {
        slug: "query",
        title: "数据查询",
        description: "查询 DSL、Parquet 结果和 DuckDB SQL 二次查询。",
        content: queryContent
      },
      {
        slug: "factor",
        title: "因子分析",
        description: "配置因子、阅读报告、保存版本和批量执行。",
        content: factorContent
      },
      {
        slug: "backtest",
        title: "策略回测",
        description: "参数、代码、报告、版本和专项分析。",
        content: backtestContent
      }
    ]
  },
  {
    slug: "operations",
    title: "运行与结果",
    description: "追踪任务并核验输出",
    items: [
      {
        slug: "workflows",
        title: "工作流、状态与日志",
        description: "按工作空间追踪 Attempt、Task、日志和异常。",
        content: workflowsContent
      },
      {
        slug: "results",
        title: "结果、导出与排错",
        description: "DuckDB、日期范围、表格、导出及常见故障。",
        content: resultsContent
      }
    ]
  }
];

export const userGuideDocuments = userGuideSections.flatMap((section) => section.items);
