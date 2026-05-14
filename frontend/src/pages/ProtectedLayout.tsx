import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function getUserFromStorage() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as { fullName?: string; role?: string };
  } catch {
    return null;
  }
}

export default function ProtectedLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getUserFromStorage());

  useEffect(() => {
    const handler = () => setUser(getUserFromStorage());
    window.addEventListener('profileUpdated', handler);
    return () => window.removeEventListener('profileUpdated', handler);
  }, []);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Mobility Platform</h1>
          <p className="text-sm text-slate-500">
            Welcome back{user?.fullName ? `, ${user.fullName}` : ''}!
          </p>
        </div>

        <div className="flex items-center gap-4">
          {user?.fullName && (
            <NavLink
              to="/profile"
              className="text-sm font-semibold text-slate-700 hover:underline"
            >
              {user.fullName}
            </NavLink>
          )}
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-72px)]">
        <aside className="w-64 border-r border-slate-200 bg-white p-6">
          <nav className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Navigation
            </div>
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/vehicles"
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              Vehicles
            </NavLink>
            <NavLink
              to="/tasks"
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              Tasks
            </NavLink>

            <NavLink
              to="/chat"
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              Chat
            </NavLink>

            {user?.role === 'EMPLOYEE' && (
              <NavLink
                to="/driver-panel"
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                Share Location
              </NavLink>
            )}

            {(user?.role === 'OWNER' || user?.role === 'DISPATCHER') && (
              <>
                <NavLink
                  to="/team"
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  Team
                </NavLink>
                <NavLink
                  to="/dispatcher-tools"
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  Dispatcher Tools
                </NavLink>
              </>
            )}
          </nav>
        </aside>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
