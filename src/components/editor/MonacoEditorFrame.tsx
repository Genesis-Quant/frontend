import { Maximize2, Minimize2 } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/assets/lib/utils";
import { Button } from "@/ui/button";
import "./MonacoEditorFrame.less";

export default function MonacoEditorFrame({ actions, children, className }: { actions?: ReactNode; children: ReactNode; className?: string }) {
  const [fullScreen, setFullScreen] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = frame.current;
    if (!fullScreen || !element) return undefined;

    element.showPopover();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setFullScreen(false);
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => {
      window.removeEventListener("keydown", closeOnEscape, true);
      if (element.matches(":popover-open")) element.hidePopover();
    };
  }, [fullScreen]);

  function toggleFullScreen() {
    setFullScreen((current) => !current);
  }

  const label = fullScreen ? "退出窗口内全屏" : "窗口内全屏编辑";
  return <div className={cn("monaco-editor-frame flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-background", className)} popover={fullScreen ? "manual" : undefined} ref={frame}>
    <div className="monaco-editor-frame__toolbar flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1">
      <div className="flex min-w-0 items-center gap-1.5">{actions}</div>
      <Button aria-label={label} className="shrink-0 text-muted-foreground hover:text-foreground" onClick={toggleFullScreen} size="icon-sm" title={label} variant="ghost">
        {fullScreen ? <Minimize2 /> : <Maximize2 />}
      </Button>
    </div>
    <div className="min-h-0 flex-1 overflow-hidden bg-background">{children}</div>
  </div>;
}
