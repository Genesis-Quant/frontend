import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

export const KeepAliveActiveContext = createContext(true);
export const KeepAlivePortalContainerContext = createContext<HTMLElement | null>(null);

export function useKeepAliveActive() {
  return useContext(KeepAliveActiveContext);
}

export function useKeepAlivePortalContainer() {
  return useContext(KeepAlivePortalContainerContext);
}

export function useKeepAliveReactivation(callback: () => void) {
  const active = useKeepAliveActive();
  const callbackRef = useRef(callback);
  const previouslyActive = useRef(active);

  useLayoutEffect(() => { callbackRef.current = callback; }, [callback]);
  useEffect(() => {
    const reactivated = active && !previouslyActive.current;
    previouslyActive.current = active;
    if (reactivated) callbackRef.current();
  }, [active]);
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
