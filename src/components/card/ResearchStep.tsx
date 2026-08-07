import type { ComponentType } from "react";
import { motion } from "motion/react";

type IconComponent = ComponentType<{ className?: string; width?: number; height?: number }>;

interface ResearchStepProps {
  detail: string;
  icon: IconComponent;
  label: string;
  title: string;
}

export function ResearchStep({ detail, icon: Icon, label, title }: ResearchStepProps) {
  return (
    <motion.div
      className="group border-b border-border px-5 py-6 last:border-b-0 sm:border-b-0 sm:border-x sm:border-l-0 sm:last:border-r-0"
      whileHover={{ y: -4 }}
    >
      <div className="flex items-center justify-between">
        <Icon className="text-muted-foreground transition-colors group-hover:text-primary" width={17} height={17} />
        <span className="numeric text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="mt-12 font-semibold">{title}</div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</div>
    </motion.div>
  );
}
