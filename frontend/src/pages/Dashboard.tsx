import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axiosClient from '../api/axiosClient';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Fix Leaflet icon URLs in Vite / React environment
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString(),
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString(),
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString(),
});

function safeParseJSON<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function decodeToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(decodeURIComponent(atob(parts[1]).split('').map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join('')));
    return payload as { role?: string; fullName?: string; name?: string };
  } catch {
    return null;
  }
}

type Vehicle = {
  id: number;
  brand: string;
  model: string;
  licensePlate: string;
  type: string;
  currentLat?: number | null;
  currentLng?: number | null;
};

type Task = {
  id: number;
  status: string;
};

type User = {
  id: number;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string>('');

  useEffect(() => {
    const payload = decodeToken();
    if (payload) {
      setUserRole(payload.role ?? null);
      setUserFullName((payload.fullName || payload.name || '').toString());
    } else {
      const storedUser = safeParseJSON<{ role?: string; fullName?: string }>(localStorage.getItem('user'));
      setUserRole(storedUser?.role ?? null);
      setUserFullName(storedUser?.fullName ?? '');
    }
  }, []);

  useEffect(() => {
    if (userRole !== 'OWNER' && userRole !== 'DISPATCHER') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const vehiclesReq = axiosClient.get<Vehicle[]>('/vehicles');
    const tasksReq = axiosClient.get<Task[]>('/tasks');
    const usersReq = axiosClient.get<User[]>('/users');

    Promise.all([vehiclesReq, tasksReq, usersReq])
      .then(([vehiclesRes, tasksRes, usersRes]) => {
        setVehicles(vehiclesRes.data);
        setTasks(tasksRes.data);
        setUsers(usersRes.data);
      })
      .catch((err) => {
        console.error(err);
        setError(
          (err as any)?.response?.data?.error ||
            'Unable to load dashboard data. Please try again.',
        );
      })
      .finally(() => setLoading(false));
  }, [userRole]);

  const totalVehicles = vehicles.length;
  const totalEmployees = users.length;
  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status === 'IN_PROGRESS').length,
    [tasks],
  );

  const taskStatusData = useMemo(() => {
    const counts = { TODO: 0, IN_PROGRESS: 0, DONE: 0 } as Record<string, number>;
    tasks.forEach((task) => {
      counts[task.status] = (counts[task.status] ?? 0) + 1;
    });
    return [
      { name: 'TODO', value: counts.TODO },
      { name: 'IN_PROGRESS', value: counts.IN_PROGRESS },
      { name: 'DONE', value: counts.DONE },
    ];
  }, [tasks]);

  const vehicleTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    vehicles.forEach((vehicle) => {
      counts[vehicle.type] = (counts[vehicle.type] ?? 0) + 1;
    });
    return Object.entries(counts).map(([type, value]) => ({ type, value }));
  }, [vehicles]);

  const statusColors: Record<string, string> = {
    TODO: '#3b82f6',
    IN_PROGRESS: '#fbbf24',
    DONE: '#22c55e',
  };

  if (userRole === 'EMPLOYEE') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Welcome back, {userFullName || 'Employee'}!</h2>
          <p className="mt-2 text-sm text-slate-600">
            You can manage your routes and tasks from the Tasks menu.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            For all route updates, task status changes, and assignment details, go to your tasks.
          </p>
          <button
            type="button"
            onClick={() => navigate('/tasks')}
            className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Go to My Tasks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Fleet dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          Real-time fleet statistics and vehicle positions.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Vehicle map</h3>
          <div className="text-sm text-slate-600">Vehicle positions with GPS</div>
        </div>

        <div className="mt-4 h-96 w-full rounded-xl border border-slate-200">
          <MapContainer
            center={[45.9, 25.0]}
            zoom={6}
            scrollWheelZoom
            className="h-full w-full rounded-xl"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {vehicles
              .filter((v) => v.currentLat != null && v.currentLng != null)
              .map((vehicle) => (
                <Marker
                  key={vehicle.id}
                  position={[vehicle.currentLat as number, vehicle.currentLng as number]}
                >
                  <Popup>
                    <div className="space-y-1 text-sm">
                      <div className="font-semibold">
                        {vehicle.brand} {vehicle.model}
                      </div>
                      <div className="text-slate-600">{vehicle.licensePlate}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Vehicles
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{totalVehicles}</div>
          <div className="mt-2 text-sm text-slate-600">Registered fleet count</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Employees
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{totalEmployees}</div>
          <div className="mt-2 text-sm text-slate-600">Employees with login access</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active Tasks
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{activeTasks}</div>
          <div className="mt-2 text-sm text-slate-600">Tasks in progress right now</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Task status distribution</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={taskStatusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={55}
                  label
                >
                  {taskStatusData.map((entry) => (
                    <Cell key={entry.name} fill={statusColors[entry.name] ?? '#a1a1aa'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Vehicle type breakdown</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={vehicleTypeData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          Loading dashboard data…
        </div>
      )}
    </div>
  );
}
