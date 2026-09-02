import { ArrowLeft, PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/assets/lib/utils";
import { Button } from "@/ui/button";

type AnalysisWorkspaceProps = {
  backTo: string;
  children: ReactNode;
  sidebar: ReactNode;
  sidebarLabel?: string;
};

export default function AnalysisWorkspace({ backTo, children, sidebar, sidebarLabel = "分析参数" }: AnalysisWorkspaceProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setCollapsed(false);
    };
    desktop.addEventListener("change", handleViewportChange);
    return () => desktop.removeEventListener("change", handleViewportChange);
  }, []);

  return <div className={cn(
    "component-fade-in grid min-h-[calc(100dvh-4rem)] grid-cols-1 xl:transition-[grid-template-columns] xl:duration-300 xl:ease-out",
    collapsed ? "xl:grid-cols-[3.5rem_minmax(0,1fr)]" : "xl:grid-cols-[26rem_minmax(0,1fr)]"
  )}>
    <aside className="relative flex min-w-0 flex-col border-b bg-muted/15 xl:sticky xl:top-16 xl:h-[calc(100dvh-4rem)] xl:self-start xl:border-b-0 xl:border-r">
      <div className="relative min-h-0 flex-1">
        <div aria-hidden={collapsed} className={cn("h-full min-w-0 overflow-hidden transition-[opacity,transform] duration-200 ease-out", collapsed && "xl:pointer-events-none xl:-translate-x-2 xl:opacity-0")} inert={collapsed}>
          {sidebar}
        </div>
        <div className={cn("pointer-events-none absolute inset-0 hidden flex-col items-center gap-3 bg-muted/15 pt-10 text-muted-foreground opacity-0 transition-opacity duration-200 xl:flex", collapsed && "xl:opacity-100")}>
          <SlidersHorizontal className="size-4 text-primary" />
          <span className="text-xs font-medium tracking-widest [writing-mode:vertical-rl]">{sidebarLabel}</span>
        </div>
      </div>
      <div className={cn("relative z-20 flex shrink-0 items-center border-t p-3", collapsed ? "xl:gap-0" : "gap-2")}>
        <div className={cn("min-w-0 max-w-40 overflow-hidden transition-[max-width,opacity] duration-200", collapsed && "xl:pointer-events-none xl:max-w-0 xl:opacity-0")}>
          <Button variant="ghost" asChild><Link to={backTo}><ArrowLeft />返回</Link></Button>
        </div>
        <Button aria-label={collapsed ? `展开${sidebarLabel}` : `收起${sidebarLabel}`} className={cn("hidden shrink-0 xl:inline-flex", collapsed ? "xl:mx-auto" : "xl:ml-auto")} size="icon" title={collapsed ? `展开${sidebarLabel}` : `收起${sidebarLabel}`} variant="ghost" onClick={() => setCollapsed((current) => !current)}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>
    </aside>
    <main className="min-w-0 px-3 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">{children}</main>
  </div>;
}
