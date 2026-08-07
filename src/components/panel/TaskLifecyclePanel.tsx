import IconBraces from "~icons/lucide/braces";
import IconRadar from "~icons/lucide/radar";
import IconRoute from "~icons/lucide/route";

import { ResearchStep } from "@/components/card/ResearchStep";

export function TaskLifecyclePanel() {
  return (
    <section className="bg-[color:var(--panel-soft)]" id="workflow">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.35fr] lg:gap-20 lg:px-12 lg:py-24">
        <div>
          <p className="text-[10px] font-bold tracking-[0.24em] text-primary">TASK LIFECYCLE</p>
          <h2 className="display-type mt-4 text-4xl tracking-[-0.04em] sm:text-5xl">从提交到结果，每一步都可追踪。</h2>
        </div>
        <div className="grid border-y border-border sm:grid-cols-3">
          <ResearchStep icon={IconBraces} label="01" title="提交" detail="应用 API 校验参数并创建后台任务" />
          <ResearchStep icon={IconRadar} label="02" title="追踪" detail="Tasks API 统一提供状态、日志与操作" />
          <ResearchStep icon={IconRoute} label="03" title="获取" detail="完成后由对应应用 API 返回结果文件" />
        </div>
      </div>
    </section>
  );
}
