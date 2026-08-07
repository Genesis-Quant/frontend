import { lazy, Suspense, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

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
const AdminPage = lazy(() => import("@/views/AdminPage"));

export default function App() {
  const location = useLocation();
  const authStatus = useAppStore((state) => state.authStatus);
  const restoreSession = useAppStore((state) => state.restoreSession);
  const user = useAppStore((state) => state.user);
  const authenticated = authStatus === "authenticated";

  useEffect(() => { restoreSession(); }, [restoreSession]);
  if (authStatus === "idle" || authStatus === "loading") return <RouteLoading />;

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteLoading />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={authenticated ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/register" element={authenticated ? <Navigate to="/" replace /> : <RegisterPage />} />
          <Route element={authenticated ? <AppLayout /> : <Navigate to="/login" replace />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/query" element={<QueryPage />} />
            <Route path="/query/secondary" element={<SecondaryQueryPage />} />
            <Route path="/query/projects/:projectId" element={<QueryDetailPage />} />
            <Route path="/factor" element={<FactorAnalysisPage />} />
            <Route path="/factor/projects/:projectId" element={<FactorAnalysisDetailPage />} />
            <Route path="/backtest" element={<BacktestPage />} />
            <Route path="/backtest/projects/:projectId" element={<BacktestDetailPage />} />
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/admin" element={user?.is_admin ? <AdminPage /> : <Navigate to="/" replace />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to={authenticated ? "/" : "/login"} replace />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

function RouteLoading() {
  return <div className="grid min-h-screen place-items-center"><div className="flex flex-col items-center gap-5"><BrandMark /><span className="loading-line" /></div></div>;
}
