import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/assets/lib/utils";
import { useKeepAliveOpenState, useKeepAlivePortalContainer } from "@/components/layout/keepAliveContext";

function TooltipProvider({ delayDuration = 250, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

function Tooltip({ defaultOpen, onOpenChange, open, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const keepAliveOpen = useKeepAliveOpenState({ defaultOpen, onOpenChange, open });
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} {...keepAliveOpen} />;
}

function TooltipTrigger(props: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({ children, className, sideOffset = 6, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const keepAliveContainer = useKeepAlivePortalContainer();
  return <TooltipPrimitive.Portal container={keepAliveContainer ?? undefined}>
    <TooltipPrimitive.Content
      className={cn(
        "z-50 max-w-80 rounded-md border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-popover" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>;
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
