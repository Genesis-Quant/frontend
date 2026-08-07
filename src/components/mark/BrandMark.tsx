import IconChartSpline from "~icons/lucide/chart-spline";

export function BrandMark() {
  return (
    <div className="flex items-center gap-3" aria-label="Arena">
      <span className="grid size-9 place-items-center rounded-md border border-border bg-[color:var(--panel-soft)] text-primary shadow-[inset_0_1px_rgba(255,255,255,0.06)]">
        <IconChartSpline width={18} height={18} />
      </span>
      <span>
        <span className="block text-[15px] font-bold tracking-[0.16em]">ARENA</span>
        <span className="block text-[9px] font-semibold tracking-[0.24em] text-muted-foreground">QUANT RESEARCH</span>
      </span>
    </div>
  );
}
