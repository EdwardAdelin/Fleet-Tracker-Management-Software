import { useEffect, useMemo, useState } from 'react';
import axiosClient from '../api/axiosClient';

type Vehicle = {
  id: number;
  brand: string;
  model: string;
  licensePlate: string;
};

type User = {
  fullName?: string;
  role?: string;
};

function getUserFromStorage(): User | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export default function DriverDashboard() {
  const currentUser = useMemo(() => getUserFromStorage(), []);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState<'Tracking Active' | 'Inactive'>('Inactive');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  const [lastSentAt, setLastSentAt] = useState<string>('');
  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => {
    async function loadAssignedVehicle() {
      try {
        const { data } = await axiosClient.get<Vehicle>('/vehicles/my-assigned-vehicle');
        setVehicle(data);
      } catch (err) {
        console.error(err);
        setError((err as any)?.response?.data?.error || 'Unable to fetch assigned vehicle.');
      }
    }

    loadAssignedVehicle();
  }, []);

  useEffect(() => {
    if (!tracking) {
      return undefined;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setTracking(false);
      return undefined;
    }

    if (!vehicle) {
      setError('No assigned vehicle found to track.');
      setTracking(false);
      return undefined;
    }

    setError('');
    setStatus('Tracking Active');

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPosition({ lat, lng });
        sendLocationUpdate(lat, lng);
      },
      (geoError) => {
        setError(geoError.message || 'Unable to read GPS location.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    );

    setWatchId(id);

    return () => {
      navigator.geolocation.clearWatch(id);
    };
  }, [tracking, vehicle]);

  useEffect(() => {
    if (!tracking || !position || !vehicle) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      sendLocationUpdate(position.lat, position.lng);
    }, 12000);

    return () => window.clearInterval(interval);
  }, [tracking, position, vehicle]);

  async function sendLocationUpdate(lat: number, lng: number) {
    if (!vehicle) return;

    try {
      await axiosClient.put(`/vehicles/${vehicle.id}/location`, {
        currentLat: lat,
        currentLng: lng,
      });
      setLastSentAt(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      setError((err as any)?.response?.data?.error || 'Unable to update location.');
    }
  }

  function handleToggleTracking() {
    if (!tracking) {
      if (!vehicle) {
        setError('No assigned vehicle found to track.');
        return;
      }
      setTracking(true);
      setStatus('Tracking Active');
      setError('');
    } else {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      setTracking(false);
      setStatus('Inactive');
    }
  }

  if (currentUser?.role !== 'EMPLOYEE') {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Share Location</h1>
        <p className="mt-4 text-sm text-slate-600">This page is only available for drivers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Share Location</h1>
        <p className="mt-2 text-sm text-slate-600">
          Track your vehicle location in real time using your phone's GPS.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Tracking Status</p>
              <p
                className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                  status === 'Tracking Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {status}
              </p>
            </div>
            <button
              onClick={handleToggleTracking}
              className={`rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition ${
                tracking ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {tracking ? 'Stop Tracking' : 'Start Tracking'}
            </button>
          </div>

          <div className="mt-6 space-y-4 text-sm text-slate-700">
            <div>
              <p className="text-slate-500">Vehicle</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {vehicle ? `${vehicle.brand} ${vehicle.model}` : 'No assigned vehicle'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">License Plate</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {vehicle?.licensePlate ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Current Coordinates</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {position ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}` : 'Waiting for GPS...'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Last update sent</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {lastSentAt || 'None yet'}
              </p>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
