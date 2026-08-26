import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/assets/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";

type MetricHelpProps = {
  className?: string;
  description?: string;
  label?: string;
};

export function MetricHelp({ className, description, label = "查看指标说明" }: MetricHelpProps) {
  if (!description) return null;
  return <Tooltip>
    <TooltipTrigger asChild>
      <button
        aria-label={label}
        className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/75 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", className)}
        type="button"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <CircleHelp className="size-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent>{description}</TooltipContent>
  </Tooltip>;
}

type MetricLabelProps = MetricHelpProps & {
  children: ReactNode;
};

export function MetricLabel({ children, className, description, label }: MetricLabelProps) {
  return <span className={cn("inline-flex items-center gap-1", className)}>
    <span>{children}</span>
    <MetricHelp description={description} label={label} />
  </span>;
}
