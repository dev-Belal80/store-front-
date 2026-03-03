import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const roleDashboardMap = {
  super_admin: '/admin/dashboard',
  store_owner: '/store/dashboard',
};

export default function ProtectedRoute({ role }) {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    const targetPath = roleDashboardMap[user.role] || '/login';
    return <Navigate to={targetPath} replace />;
  }

  return <Outlet />;
}