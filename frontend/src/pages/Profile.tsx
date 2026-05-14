import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import axiosClient from '../api/axiosClient';

type StoredUser = {
  id: number;
  fullName: string;
  email: string;
  role: string;
};

function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export default function Profile() {
  const storedUser = useMemo(() => getStoredUser(), []);

  const [fullName, setFullName] = useState(storedUser?.fullName || '');
  const [email, setEmail] = useState(storedUser?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (storedUser) {
      setFullName(storedUser.fullName);
      setEmail(storedUser.email);
    }
  }, [storedUser]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const { data } = await axiosClient.put<StoredUser>('/auth/profile', {
        fullName,
        email,
        newPassword: newPassword || undefined,
      });

      const updatedUser = { ...storedUser, ...data } as StoredUser;
      localStorage.setItem('user', JSON.stringify(updatedUser));

      // notify layout / other parts of app to re-read user data
      window.dispatchEvent(new Event('profileUpdated'));

      toast.success('Profile updated successfully');
      setNewPassword('');
    } catch (err) {
      console.error(err);
      setError(
        (err as any)?.response?.data?.error ||
          'Unable to update profile. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (!storedUser) {
    return (
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-600">Unable to load profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Your profile</h2>
        <p className="mt-1 text-sm text-slate-600">
          Update your details and change your password.
        </p>

        {error && (
          <div className="mt-6 rounded-md bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Full Name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Your full name"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">New Password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Leave blank to keep current password"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
