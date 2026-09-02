import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const KeepAliveActiveContext = createContext(true);
export const KeepAlivePortalContainerContext = createContext<HTMLElement | null>(null);

export function useKeepAliveActive() {
  return useContext(KeepAliveActiveContext);
}

export function useKeepAlivePortalContainer() {
  return useContext(KeepAlivePortalContainerContext);
}

export function useKeepAliveOpenState({ defaultOpen = false, onOpenChange, open }: { defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; open?: boolean }) {
  const active = useKeepAliveActive();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const resolvedOpen = open ?? uncontrolledOpen;
  const changeOpen = useCallback((nextOpen: boolean) => {
    if (open === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!active && resolvedOpen) changeOpen(false);
  }, [active, changeOpen, resolvedOpen]);

  return { open: active && resolvedOpen, onOpenChange: changeOpen };
}
