import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/auth/LoginPage";
import { DashboardPage } from "./pages/committee/DashboardPage";
import { AssetsPage } from "./pages/assets/AssetsPage";
import { AssetLogPage } from "./pages/assets/AssetLogPage";
import { QRScanPage } from "./pages/assets/QRScanPage";
import { STPLogPage } from "./pages/operator/STPLogPage";
import { WaterLogPage } from "./pages/operator/WaterLogPage";
import { DGLogPage } from "./pages/operator/DGLogPage";
import { PPMCompletionPage } from "./pages/operator/PPMCompletionPage";
import { CompliancePage } from "./pages/committee/CompliancePage";
import { ReportsPage } from "./pages/committee/ReportsPage";
import { InventoryPage } from "./pages/inventory/InventoryPage";
import { ComplaintsPage } from "./pages/complaints/ComplaintsPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function DefaultRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (["super_admin", "committee"].includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/operator/stp" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/assets/scan/:qr_token" element={<QRScanPage />} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/assets" element={<ProtectedRoute><AssetsPage /></ProtectedRoute>} />
      <Route path="/assets/:id/log" element={<ProtectedRoute><AssetLogPage /></ProtectedRoute>} />
      <Route path="/operator/stp" element={<ProtectedRoute><STPLogPage /></ProtectedRoute>} />
      <Route path="/operator/water" element={<ProtectedRoute><WaterLogPage /></ProtectedRoute>} />
      <Route path="/operator/dg" element={<ProtectedRoute><DGLogPage /></ProtectedRoute>} />
      <Route path="/operator/ppm" element={<ProtectedRoute><PPMCompletionPage /></ProtectedRoute>} />
      <Route path="/compliance" element={<ProtectedRoute><CompliancePage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
      <Route path="/complaints" element={<ProtectedRoute><ComplaintsPage /></ProtectedRoute>} />
      <Route path="/" element={<DefaultRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
