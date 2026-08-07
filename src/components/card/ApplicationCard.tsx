import type { ComponentType } from "react";
import { motion } from "motion/react";
import IconGitBranch from "~icons/lucide/git-branch";

type IconComponent = ComponentType<{ className?: string; width?: number; height?: number }>;

interface ApplicationCardProps {
  index: number;
  slide: {
    description: string;
    endpoint: string;
    icon: IconComponent;
    id: string;
    title: readonly string[];
  };
}

export function ApplicationCard({ index, slide }: ApplicationCardProps) {
  const Icon = slide.icon;

  return (
    <motion.article
      className="group bg-background p-6 md:min-h-[310px]"
      id={`application-${slide.id}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.42, delay: index * 0.08 }}
    >
      <div className="flex items-center justify-between">
        <span className="grid size-10 place-items-center rounded-md border border-border bg-[color:var(--panel-soft)] text-primary">
          <Icon width={18} height={18} />
        </span>
        <span className="numeric text-[10px] text-muted-foreground">0{index + 1}</span>
      </div>
      <h3 className="display-type mt-16 text-2xl tracking-[-0.03em]">{slide.title[0]}</h3>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">{slide.description}</p>
      <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-[9px] tracking-[0.08em] text-muted-foreground">
        <IconGitBranch width={13} height={13} />
        <code>{slide.endpoint}</code>
      </div>
    </motion.article>
  );
}
