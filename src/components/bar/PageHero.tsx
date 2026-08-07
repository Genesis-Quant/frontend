import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type PageHeroVariant = "analysis" | "archive" | "square";
type PageHeroProps = { actions?: ReactNode; chips?: string[]; description: string; eyebrow: string; icon: LucideIcon; stat?: { label: string; value: number | string }; title: string; variant: PageHeroVariant };

const heroStyle: Record<PageHeroVariant, { accent: string; eyebrow: string; glow: string; line: string; surface: string }> = {
  archive: { accent: "text-amber-600 dark:text-amber-300", eyebrow: "border-amber-500/25 bg-amber-500/10", glow: "from-amber-500/20 via-emerald-500/10 to-violet-500/20", line: "bg-amber-500/70", surface: "bg-[radial-gradient(circle_at_78%_8%,color-mix(in_oklch,var(--chart-4)_22%,transparent),transparent_34rem),linear-gradient(135deg,color-mix(in_oklch,var(--chart-2)_9%,transparent),color-mix(in_oklch,var(--muted)_42%,transparent))]" },
  square: { accent: "text-emerald-600 dark:text-emerald-300", eyebrow: "border-emerald-500/25 bg-emerald-500/10", glow: "from-emerald-500/22 via-sky-500/10 to-transparent", line: "bg-emerald-500/70", surface: "bg-[radial-gradient(circle_at_72%_18%,color-mix(in_oklch,var(--chart-2)_22%,transparent),transparent_32rem),linear-gradient(135deg,color-mix(in_oklch,var(--muted)_50%,transparent),transparent)]" },
  analysis: { accent: "text-sky-600 dark:text-sky-300", eyebrow: "border-sky-500/25 bg-sky-500/10", glow: "from-sky-500/22 via-blue-500/10 to-transparent", line: "bg-sky-500/70", surface: "bg-[radial-gradient(circle_at_15%_12%,color-mix(in_oklch,var(--chart-1)_22%,transparent),transparent_34rem),linear-gradient(135deg,color-mix(in_oklch,var(--muted)_54%,transparent),transparent)]" }
};

export function PageHero({ actions, chips = [], description, eyebrow, icon: Icon, stat, title, variant }: PageHeroProps) {
  const style = heroStyle[variant];
  return <section className={`component-fade-in relative overflow-hidden rounded-md border px-5 py-4 shadow-sm ${style.surface}`}>
    <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${style.glow}`} />
    <div className={`pointer-events-none absolute bottom-0 left-0 h-px w-2/5 ${style.line}`} />
    <div className="pointer-events-none absolute -right-16 top-1/2 hidden h-44 w-44 -translate-y-1/2 rounded-full border border-foreground/5 lg:block" />
    <div className="pointer-events-none absolute -right-8 top-1/2 hidden h-28 w-28 -translate-y-1/2 rounded-full border border-foreground/5 lg:block" />
    <div className="relative flex items-end justify-between gap-6"><div className="min-w-0"><div className={`inline-flex items-center gap-2 rounded-sm border px-2 py-1 text-[11px] font-medium tracking-wide ${style.accent} ${style.eyebrow}`}><Icon className="size-3.5" />{eyebrow}</div><h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>{chips.length ? <div className="mt-4 flex flex-wrap gap-2">{chips.map((chip) => <span className="rounded-sm border bg-background/45 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur" key={chip}>{chip}</span>)}</div> : null}</div><div className="flex shrink-0 items-end gap-3">{actions}{stat ? <div className="hidden min-w-24 rounded-md border bg-background/70 px-4 py-3 text-right shadow-sm backdrop-blur sm:block"><div className="text-xl font-semibold tabular-nums">{stat.value}</div><div className="mt-1 text-xs text-muted-foreground">{stat.label}</div></div> : null}</div></div>
  </section>;
}
