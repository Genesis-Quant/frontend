import type { LucideIcon } from "lucide-react";

type EmptyStatePanelProps = {
  className?: string;
  description: string;
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
};

export default function EmptyStatePanel({ className = "min-h-80", description, icon: Icon, iconClassName = "", title }: EmptyStatePanelProps) {
  return <div className={`component-fade-in grid place-items-center rounded-md border bg-card text-center shadow-sm ${className}`}><div><Icon className={`mx-auto size-6 text-muted-foreground ${iconClassName}`} /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{description}</p></div></div>;
}
