import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { matchPath, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { KeepAliveRoutes, type KeepAliveRoute } from "@/components/layout/KeepAliveRoutes";
import { BrandMark } from "@/components/mark/BrandMark";
import { useAppStore } from "@/store";

const LoginPage = lazy(() => import("@/views/LoginPage"));
const AppLayout = lazy(() => import("@/layout/AppLayout"));
const HomePage = lazy(() => import("@/views/HomePage"));
const QueryPage = lazy(() => import("@/views/QueryPage"));
const QueryDetailPage = lazy(() => import("@/views/QueryDetailPage"));
const SecondaryQueryPage = lazy(() => import("@/views/SecondaryQueryPage"));
const FactorAnalysisPage = lazy(() => import("@/views/FactorAnalysisPage"));
const FactorAnalysisDetailPage = lazy(() => import("@/views/FactorAnalysisDetailPage"));
const BacktestPage = lazy(() => import("@/views/BacktestPage"));
const BacktestDetailPage = lazy(() => import("@/views/BacktestDetailPage"));
const ProfilePage = lazy(() => import("@/views/ProfilePage"));
const RegisterPage = lazy(() => import("@/views/RegisterPage"));
const WorkflowsPage = lazy(() => import("@/views/WorkflowsPage"));
const DocsPage = lazy(() => import("@/views/DocsPage"));
const McpPage = lazy(() => import("@/views/McpPage"));
const AdminPage = lazy(() => import("@/views/AdminPage"));

const primaryRoutes: KeepAliveRoute[] = [
  { cacheKey: "home", path: "/", element: <HomePage /> },
  { cacheKey: "query", path: "/query", element: <QueryPage /> },
  { cacheKey: "factor", path: "/factor", element: <FactorAnalysisPage /> },
  { cacheKey: "backtest", path: "/backtest", element: <BacktestPage /> },
  { cacheKey: "workflows", path: "/workflows", element: <WorkflowsPage /> },
  { cacheKey: "docs", path: "/docs", element: <DocsPage /> },
  { cacheKey: "mcp", path: "/mcp", element: <McpPage /> },
  { cacheKey: "profile", path: "/profile", element: <ProfilePage /> }
];
const adminRoute: KeepAliveRoute = { cacheKey: "admin", path: "/admin", element: <AdminPage /> };

export default function App() {
  const location = useLocation();
  const authStatus = useAppStore((state) => state.authStatus);
  const restoreSession = useAppStore((state) => state.restoreSession);
  const user = useAppStore((state) => state.user);
  const authenticated = authStatus === "authenticated";

  useEffect(() => { restoreSession(); }, [restoreSession]);
  if (authStatus === "idle" || authStatus === "loading") return <RouteLoading />;

  return <AnimatePresence mode="wait"><Suspense fallback={<RouteLoading />}>
    {authenticated
      ? <AuthenticatedApplication admin={Boolean(user?.is_admin)} />
      : <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>}
  </Suspense></AnimatePresence>;
}

function AuthenticatedApplication({ admin }: { admin: boolean }) {
  const location = useLocation();
  const [primaryLocations, setPrimaryLocations] = useState<Record<string, string>>({});
  const routes = admin ? [...primaryRoutes, adminRoute] : primaryRoutes;
  const activePrimaryRoute = routes.find((route) => matchPath({ path: route.path, end: true }, location.pathname));
  const primary = Boolean(activePrimaryRoute);

  useLayoutEffect(() => {
    if (!activePrimaryRoute) return;
    const path = `${location.pathname}${location.search}${location.hash}`;
    setPrimaryLocations((current) => current[activePrimaryRoute.path] === path
      ? current
      : { ...current, [activePrimaryRoute.path]: path });
  }, [activePrimaryRoute, location.hash, location.pathname, location.search]);

  const resolvePrimaryPath = useCallback((path: string) => primaryLocations[path] ?? path, [primaryLocations]);

  return <AppLayout resolvePrimaryPath={resolvePrimaryPath}>
    <KeepAliveRoutes fallback={<RouteLoading />} routes={routes} />
    {!primary
      ? <Suspense fallback={<RouteLoading />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/query/secondary" element={<SecondaryQueryPage />} />
          <Route path="/query/projects/:projectId" element={<QueryDetailPage />} />
          <Route path="/factor/projects/:projectId" element={<FactorAnalysisDetailPage />} />
          <Route path="/backtest/projects/:projectId" element={<BacktestDetailPage />} />
          <Route path="/tutorial" element={<Navigate to={{ pathname: "/docs", search: location.search, hash: location.hash }} replace />} />
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      : null}
  </AppLayout>;
}

function RouteLoading() {
  return <div className="grid min-h-screen place-items-center"><div className="flex flex-col items-center gap-5"><BrandMark /><span className="loading-line" /></div></div>;
}
