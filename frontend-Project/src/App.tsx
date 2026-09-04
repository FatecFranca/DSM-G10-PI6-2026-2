import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppLayout } from './components/Layout';
import { Alert, Loading } from './components/ui';
import { AnalysisPage } from './pages/AnalysisPage';
import { DashboardPage } from './pages/DashboardPage';
import { DataMiningPage } from './pages/DataMiningPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { FollowUpsPage } from './pages/FollowUpsPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { StudentFormPage } from './pages/StudentFormPage';
import { StudentsPage } from './pages/StudentsPage';
import { AdminInstitutionsPage } from './pages/admin/InstitutionsPage';
import { AdminUsersPage } from './pages/admin/UsersPage';
import { useAuth } from './state/AuthContext';
import { useI18n } from './state/I18nContext';
import type { Role } from './types/api';

function RequireAuth({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();

  if (!user) return null;
  if (!roles.includes(user.role)) {
    return <Alert tone="danger">{t('errors.INSUFFICIENT_ROLE')}</Alert>;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />

        <Route path="students" element={<StudentsPage />} />
        <Route
          path="students/new"
          element={
            <RequireRole roles={['ADMIN', 'ANALYST']}>
              <StudentFormPage />
            </RequireRole>
          }
        />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route
          path="students/:id/edit"
          element={
            <RequireRole roles={['ADMIN', 'ANALYST']}>
              <StudentFormPage />
            </RequireRole>
          }
        />

        <Route path="analysis" element={<AnalysisPage />} />
        <Route
          path="data-mining"
          element={
            <RequireRole roles={['ADMIN']}>
              <DataMiningPage />
            </RequireRole>
          }
        />
        <Route path="follow-ups" element={<FollowUpsPage />} />

        <Route
          path="admin/users"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminUsersPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/institutions"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminInstitutionsPage />
            </RequireRole>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
