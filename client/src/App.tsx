import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./authContext";
import MarketingLayout from "./layouts/MarketingLayout";
import AdminLayout from "./layouts/AdminLayout";
import PublicHomePage from "./public-site/PublicHomePage";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import AccountPage from "./pages/AccountPage";
import AdminMembersPage from "./pages/AdminMembersPage";
import AdminMemberPage from "./pages/AdminMemberPage";
import AdminReportsPage from "./pages/AdminReportsPage";
import AdminRenewalsPage from "./pages/AdminRenewalsPage";
import AdminCommunicationsPage from "./pages/AdminCommunicationsPage";
import AdminExceptionsPage from "./pages/AdminExceptionsPage";
import AdminWorkbenchPage from "./pages/AdminWorkbenchPage";
import AdminEmailTemplatesPage from "./pages/AdminEmailTemplatesPage";
import AdminAgentsPage from "./pages/AdminAgentsPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";

function RequireAuth({ admin }: { admin?: boolean }) {
  const { token, member } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (admin && member?.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<PublicHomePage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<MarketingLayout />}>
            <Route path="/account" element={<AccountPage />} />
          </Route>
        </Route>

        <Route element={<RequireAuth admin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/workbench" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="workbench" element={<AdminWorkbenchPage />} />
            <Route path="members" element={<AdminMembersPage />} />
            <Route path="members/:id" element={<AdminMemberPage />} />
            <Route path="renewals" element={<AdminRenewalsPage />} />
            <Route path="communications" element={<AdminCommunicationsPage />} />
            <Route path="exceptions" element={<AdminExceptionsPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="email-templates" element={<AdminEmailTemplatesPage />} />
            <Route path="agents" element={<AdminAgentsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
