import { useEffect, useMemo, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import axiosClient from '../api/axiosClient';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

type JwtPayload = {
  userId: number;
  role: string;
};

type User = {
  id: number;
  fullName: string;
  email: string;
  role: string;
};

type Vehicle = {
  id: number;
  brand: string;
  model: string;
  licensePlate: string;
  assignedDriverId?: number | null;
};

type Task = {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  startDate?: string;
  endDate?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  address?: string;
  lat?: number;
  lng?: number;
  pickupLocation?: string;
  dropoffLocation?: string;
  contactDetails?: string;
  employee?: User;
  vehicle?: Vehicle;
};

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);

  const two = (n: number) => n.toString().padStart(2, '0');
  const day = two(date.getDate());
  const month = two(date.getMonth() + 1);
  const hours = two(date.getHours());
  const minutes = two(date.getMinutes());

  return `${day}/${month} ${hours}:${minutes}`;
}

function getCurrentUserFromToken() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return jwtDecode<JwtPayload>(token);
  } catch {
    return null;
  }
}

export default function Tasks() {
  const currentUser = useMemo(() => getCurrentUserFromToken(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [scheduledStartDate, setScheduledStartDate] = useState('');
  const [scheduledEndDate, setScheduledEndDate] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [contactDetails, setContactDetails] = useState('');

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const taskRes = await axiosClient.get<Task[]>('/tasks');
      setTasks(taskRes.data);
    } catch (err) {
      console.error(err);
      setError(
        (err as any)?.response?.data?.error ||
          'Unable to load task data. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    const fetchExtras = async () => {
      if (currentUser?.role !== 'OWNER' && currentUser?.role !== 'DISPATCHER') {
        return;
      }

      try {
        const [vehiclesRes, usersRes] = await Promise.all([
          axiosClient.get<Vehicle[]>('/vehicles'),
          axiosClient.get<User[]>('/users'),
        ]);

        setVehicles(vehiclesRes.data);
        setUsers(usersRes.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchExtras();
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEmployeeId('');
    setScheduledStartDate('');
    setScheduledEndDate('');
    setAddress('');
    setLat('');
    setLng('');
    setPickupLocation('');
    setDropoffLocation('');
    setContactDetails('');
    setEditingTaskId(null);
    setSaveError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    setSaving(true);

    const payloadLat = parseFloat(lat);
    const payloadLng = parseFloat(lng);

    if (Number.isNaN(payloadLat) || Number.isNaN(payloadLng)) {
      window.alert('Lat and Lng must be valid numbers!');
      setSaving(false);
      return;
    }

    try {
      let data: Task;

      if (editingTaskId !== null) {
        const response = await axiosClient.put<Task>(`/tasks/${editingTaskId}`, {
          title,
          description,
          assignedToId: employeeId,
          employeeId,
          scheduledStartDate: scheduledStartDate ? new Date(scheduledStartDate).toISOString() : undefined,
          scheduledEndDate: scheduledEndDate ? new Date(scheduledEndDate).toISOString() : undefined,
          address: address || undefined,
          lat: payloadLat,
          lng: payloadLng,
          pickupLocation: pickupLocation || undefined,
          dropoffLocation: dropoffLocation || undefined,
          contactDetails: contactDetails || undefined,
        });
        data = response.data;
        setTasks((prev) => prev.map((task) => (task.id === data.id ? data : task)));
      } else {
        const response = await axiosClient.post<Task>('/tasks', {
          title,
          description,
          assignedToId: employeeId,
          employeeId,
          scheduledStartDate: scheduledStartDate ? new Date(scheduledStartDate).toISOString() : undefined,
          scheduledEndDate: scheduledEndDate ? new Date(scheduledEndDate).toISOString() : undefined,
          address: address || undefined,
          lat: payloadLat,
          lng: payloadLng,
          pickupLocation: pickupLocation || undefined,
          dropoffLocation: dropoffLocation || undefined,
          contactDetails: contactDetails || undefined,
        });
        data = response.data;
        setTasks((prev) => [data, ...prev]);
      }

      resetForm();
      setFormOpen(false);
    } catch (err) {
      console.error(err);
      setSaveError(
        (err as any)?.response?.data?.error ||
          'Unable to create task. Please check the fields and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (task: Task, status: TaskStatus) => {
    try {
      await axiosClient.put<Task>(`/tasks/${task.id}/status`, { status });
      await fetchTasks();
    } catch (err) {
      console.error(err);
      window.alert(
        (err as any)?.response?.data?.error ||
          'Unable to update task status. Please try again.',
      );
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await axiosClient.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch (err) {
      console.error(err);
      window.alert(
        (err as any)?.response?.data?.error ||
          'Unable to delete task. Please try again.',
      );
    }
  };

  const handleEditTask = (task: Task) => {
    setTitle(task.title || '');
    setDescription(task.description || '');
    setEmployeeId(task.employee?.id ?? '');
    setScheduledStartDate(task.scheduledStartDate ? task.scheduledStartDate.slice(0, 16) : '');
    setScheduledEndDate(task.scheduledEndDate ? task.scheduledEndDate.slice(0, 16) : '');
    setAddress(task.address || '');
    setLat(task.lat != null ? String(task.lat) : '');
    setLng(task.lng != null ? String(task.lng) : '');
    setPickupLocation(task.pickupLocation || '');
    setDropoffLocation(task.dropoffLocation || '');
    setContactDetails(task.contactDetails || '');
    setEditingTaskId(task.id);
    setFormOpen(true);
  };

  const taskRows = useMemo(
    () =>
      tasks.map((task) => {
        const isEmployee = currentUser?.role === 'EMPLOYEE';
        const isMine = currentUser && task.employee?.id === currentUser.userId;

        const actionContent = (() => {
          if (isEmployee && isMine) {
            if (task.status === 'TODO') {
              return (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(task, 'IN_PROGRESS')}
                  className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Start Task
                </button>
              );
            }
            if (task.status === 'IN_PROGRESS') {
              return (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(task, 'DONE')}
                  className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Complete Task
                </button>
              );
            }
            return null;
          }

          return null;
        })();

        const statusBadgeStyles =
          task.status === 'TODO'
            ? 'bg-slate-100 text-slate-700'
            : task.status === 'IN_PROGRESS'
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-emerald-100 text-emerald-700';

        return (
          <tr key={task.id} className="hover:bg-slate-50">
            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
              {task.title}
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeStyles}`}
              >
                {task.status.replace('_', ' ')}
              </span>
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
              {task.employee?.fullName ?? '-'}
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
              {task.vehicle ? `${task.vehicle.brand} ${task.vehicle.model}` : '-'}
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
              {task.scheduledStartDate || task.scheduledEndDate
                ? `${formatDate(task.scheduledStartDate)} – ${formatDate(task.scheduledEndDate)}`
                : '-'}
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
              {(task.address || task.lat != null || task.lng != null)
                ? (
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {task.address || (
                          <span className="text-gray-500">
                            {task.lat?.toFixed(4)}, {task.lng?.toFixed(4)}
                          </span>
                        )}
                      </div>
                      {task.contactDetails && (
                        <div className="text-xs text-slate-500">{task.contactDetails}</div>
                      )}
                    </div>
                  )
                : '-'}
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
              {isEmployee && isMine
                ? actionContent ?? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Completed
                    </span>
                  )
                : null}
              {(currentUser?.role === 'OWNER' || currentUser?.role === 'DISPATCHER') && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditTask(task)}
                    className="inline-flex rounded-md bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(task.id)}
                    className="inline-flex rounded-md bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              )}
            </td>
          </tr>
        );
      }),
    [tasks, currentUser],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Tasks</h2>
          <p className="mt-1 text-sm text-slate-600">
            Assign and track work across your team. Create tasks and assign vehicles +
            employees.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(currentUser?.role === 'OWNER' || currentUser?.role === 'DISPATCHER') && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setFormOpen((prev) => !prev);
              }}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {formOpen ? 'Close form' : 'Assign New Task'}
            </button>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">
            {editingTaskId !== null ? 'Edit task' : 'New task'}
          </h3>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Oil change"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Employee</span>
                <select
                  value={employeeId}
                  onChange={(event) => setEmployeeId(Number(event.target.value))}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Select employee</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1 h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Additional instructions (optional)"
                />
              </label>

              <div className="md:col-span-2 grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Scheduled Start</span>
                  <input
                    type="datetime-local"
                    value={scheduledStartDate}
                    onChange={(event) => setScheduledStartDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Scheduled End</span>
                  <input
                    type="datetime-local"
                    value={scheduledEndDate}
                    onChange={(event) => setScheduledEndDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
              </div>

              <div className="md:col-span-2 grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">City / Task address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="City or location name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Coordinates</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="number"
                      step="any"
                      required
                      value={lat}
                      onChange={(event) => setLat(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="Latitude"
                    />
                    <input
                      type="number"
                      step="any"
                      required
                      value={lng}
                      onChange={(event) => setLng(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="Longitude"
                    />
                  </div>
                </div>
              </div>

              <label className="md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Contact details</span>
                <input
                  type="text"
                  value={contactDetails}
                  onChange={(event) => setContactDetails(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Phone/email/notes"
                />
              </label>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Assigned Team (Driver & Vehicle)</label>
                <select
                  value={employeeId}
                  onChange={(event) => setEmployeeId(Number(event.target.value))}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Select driver</option>
                  {users.map((user) => {
                    const userVehicle = vehicles.find(
                      (vehicle) => vehicle.assignedDriverId === user.id,
                    );
                    return (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                        {userVehicle
                          ? ` - ${userVehicle.brand} ${userVehicle.model}`
                          : ' (No Vehicle Assigned)'}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-gray-500">
                  The vehicle will be automatically assigned based on the driver's current vehicle.
                </p>
              </div>
            </div>

            {saveError && (
              <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
                {saveError}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                {saving ? 'Saving…' : editingTaskId !== null ? 'Update task' : 'Save task'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">Task list</h3>
          <span className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Vehicle
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Schedule
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Route & Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">{taskRows}</tbody>
          </table>
        </div>

        {loading && (
          <div className="px-6 py-4 text-sm text-slate-600">Loading tasks…</div>
        )}

        {!loading && error && (
          <div className="px-6 py-4 text-sm text-rose-700">{error}</div>
        )}

        {!loading && !error && tasks.length === 0 && (
          <div className="px-6 py-4 text-sm text-slate-600">
            No tasks found. Use the button above to create a task.
          </div>
        )}
      </div>
    </div>
  );
}
