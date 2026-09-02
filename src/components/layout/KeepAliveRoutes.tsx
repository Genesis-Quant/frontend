import { Suspense, useLayoutEffect, useState, type ReactNode } from "react";
import { matchPath, Route, Routes, useLocation, type Location } from "react-router-dom";

import { cn } from "@/assets/lib/utils";

import { KeepAliveActiveContext, KeepAlivePortalContainerContext } from "@/components/layout/keepAliveContext";

export interface KeepAliveRoute {
  cacheKey: string;
  contentClassName?: string;
  element: ReactNode;
  path: string;
}

interface KeepAliveRoutesProps {
  fallback: ReactNode;
  routes: KeepAliveRoute[];
}

export function KeepAliveRoutes({ fallback, routes }: KeepAliveRoutesProps) {
  const location = useLocation();
  const activeRoute = routes.find((route) => matchPath({ path: route.path, end: true }, location.pathname));
  const [cachedLocations, setCachedLocations] = useState<Map<string, Location>>(() => new Map());

  useLayoutEffect(() => {
    if (!activeRoute) return;
    setCachedLocations((current) => {
      if (current.get(activeRoute.cacheKey) === location) return current;
      const next = new Map(current);
      next.set(activeRoute.cacheKey, location);
      return next;
    });
  }, [activeRoute, location]);

  return routes.map((route) => {
    const active = route.cacheKey === activeRoute?.cacheKey;
    const routeLocation = active ? location : cachedLocations.get(route.cacheKey);
    if (!routeLocation) return null;
    return <CachedRoute active={active} fallback={fallback} key={route.cacheKey} location={routeLocation} route={route} />;
  });
}

function CachedRoute({ active, fallback, location, route }: { active: boolean; fallback: ReactNode; location: Location; route: KeepAliveRoute }) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  return <div aria-hidden={!active} className="h-full overflow-y-auto" data-keep-alive-route={route.cacheKey} hidden={!active}>
    <div data-keep-alive-portal-root={route.cacheKey} ref={setPortalContainer} />
    <div className={cn("min-h-full", route.contentClassName)}>
      <KeepAliveActiveContext.Provider value={active}>
        <KeepAlivePortalContainerContext.Provider value={portalContainer}>
          <Suspense fallback={fallback}>
            <Routes location={location}>
              <Route path={route.path} element={route.element} />
            </Routes>
          </Suspense>
        </KeepAlivePortalContainerContext.Provider>
      </KeepAliveActiveContext.Provider>
    </div>
  </div>;
}
