import { ApplicationCard } from "@/components/card/ApplicationCard";
import type { ResearchSlide } from "@/components/panel/HomeHeroPanel";

interface ResearchApplicationsPanelProps {
  slides: readonly ResearchSlide[];
}

export function ResearchApplicationsPanel({ slides }: ResearchApplicationsPanelProps) {
  return (
    <section className="border-b border-border bg-background" id="applications">
      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div>
            <p className="text-[10px] font-bold tracking-[0.24em] text-primary">RESEARCH APPLICATIONS</p>
            <h2 className="display-type mt-4 max-w-lg text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">三种应用，一套任务生命周期。</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">应用负责提交与结果，中间状态、日志和操作统一交给 Tasks API，保持职责清晰。</p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
            {slides.map((slide, index) => <ApplicationCard key={slide.id} index={index} slide={slide} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
