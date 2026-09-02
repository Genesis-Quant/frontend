import { Activity, Suspense, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { matchPath, Route, Routes, useLocation, type Location } from "react-router-dom";

import { KeepAliveActiveContext, KeepAlivePortalContainerContext } from "@/components/layout/keepAliveContext";

export interface KeepAliveRoute {
  cacheKey: string;
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
  const scrollPositions = useRef(new Map<string, number>());

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
    return <CachedRoute active={active} fallback={fallback} key={route.cacheKey} location={routeLocation} route={route} scrollPositions={scrollPositions} />;
  });
}

function CachedRoute({ active, fallback, location, route, scrollPositions }: { active: boolean; fallback: ReactNode; location: Location; route: KeepAliveRoute; scrollPositions: MutableRefObject<Map<string, number>> }) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  return <Activity mode={active ? "visible" : "hidden"} name={route.cacheKey}>
    <div aria-hidden={!active} className="contents" data-keep-alive-route={route.cacheKey}>
      <RouteActivation cacheKey={route.cacheKey} path={route.path} scrollPositions={scrollPositions} />
      <div data-keep-alive-portal-root={route.cacheKey} ref={setPortalContainer} />
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
  </Activity>;
}

function RouteActivation({ cacheKey, path, scrollPositions }: { cacheKey: string; path: string; scrollPositions: MutableRefObject<Map<string, number>> }) {
  useLayoutEffect(() => {
    const restorePosition = scrollPositions.current.get(cacheKey) ?? 0;
    const restore = () => { window.scrollTo({ behavior: "instant", left: 0, top: restorePosition }); };
    restore();
    scrollPositions.current.set(cacheKey, restorePosition);
    const savePosition = () => {
      if (window.location.pathname === path) scrollPositions.current.set(cacheKey, window.scrollY);
    };
    window.addEventListener("scroll", savePosition, { passive: true });
    const restoreFrame = window.requestAnimationFrame(restore);
    return () => {
      window.cancelAnimationFrame(restoreFrame);
      window.removeEventListener("scroll", savePosition);
    };
  }, [cacheKey, path, scrollPositions]);
  return null;
}
