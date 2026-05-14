import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

type User = {
  id: number;
  fullName: string;
  email: string;
  role: 'EMPLOYEE' | 'DISPATCHER' | 'OWNER';
};

type Vehicle = {
  id: number;
  brand: string;
  model: string;
  licensePlate: string;
  assignedDriverId?: number | null;
};

export default function Team() {
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'EMPLOYEE' | 'DISPATCHER'>('EMPLOYEE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchUsers() {
    setLoading(true);
    try {
      const [usersResponse, vehiclesResponse] = await Promise.all([
        axiosClient.get<User[]>('/users'),
        axiosClient.get<Vehicle[]>('/vehicles'),
      ]);
      setUsers(usersResponse.data);
      setVehicles(vehiclesResponse.data);
    } catch (err) {
      console.error(err);
      setError('Unable to fetch team members.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!fullName || !email || !password || !role) {
      setError('All fields are required.');
      return;
    }

    try {
      const { data } = await axiosClient.post<User>('/users', {
        fullName,
        email,
        password,
        role,
      });

      setUsers((prev) => [...prev, data]);
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('EMPLOYEE');
    } catch (err) {
      console.error(err);
      setError((err as any)?.response?.data?.error || 'Unable to add user.');
    }
  }

  async function handleDelete(userId: number) {
    const prompt = window.confirm('Are you sure you want to delete this employee?');
    if (!prompt) return;

    try {
      await axiosClient.delete(`/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error(err);
      setError((err as any)?.response?.data?.error || 'Unable to delete user.');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Team Management</h1>
      <p className="mt-2 text-sm text-slate-600">Manage employees for your company.</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Add Employee</h2>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm text-slate-700">Full Name</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-700">Email</span>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-700">Password</span>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-700">Role</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={role}
                onChange={(e) => setRole(e.target.value as 'EMPLOYEE' | 'DISPATCHER')}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="DISPATCHER">Dispatcher</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Add Employee
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Current Team</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading...</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Email</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Role</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-sm text-slate-500">
                        No team members yet.
                      </td>
                    </tr>
                  ) : (
                    users.map((member) => (
                      <tr key={member.id}>
                        <td className="px-3 py-2 text-sm text-slate-700">
                          {member.fullName}
                          {(() => {
                            const userVehicle = vehicles.find(
                              (vehicle) => vehicle.assignedDriverId === member.id,
                            );
                            return userVehicle ? (
                              <span className="ml-2 text-xs text-slate-500">
                                — {userVehicle.brand} {userVehicle.model}
                              </span>
                            ) : (
                              <span className="ml-2 text-xs text-slate-500">
                                — (No Vehicle)
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">{member.email}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{member.role}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleDelete(member.id)}
                            className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
