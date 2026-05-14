import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
