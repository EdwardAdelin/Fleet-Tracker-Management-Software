import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

type User = {
  id: number;
  fullName: string;
};

type VehicleType = 'CAR' | 'VAN' | 'TRUCK' | 'SCOOTER' | 'BOAT' | 'OTHER';

type Vehicle = {
  id: string;
  brand: string;
  model: string;
  licensePlate: string;
  type: VehicleType;
  status: string;
  currentMileage: number;
  currentLat?: number | null;
  currentLng?: number | null;
  assignedDriverId?: number | null;
  assignedDriver?: { fullName: string } | null;
};

type RouteTask = {
  id: number;
  address?: string | null;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  lat: number;
  lng: number;
  [key: string]: any;
};

type RouteResult = {
  tasks: RouteTask[];
  totalDistance: number;
};

type OptimizeResult = {
  greedy: RouteResult;
  google: RouteResult;
};


const vehicleTypes: VehicleType[] = [
  'CAR',
  'VAN',
  'TRUCK',
  'SCOOTER',
  'BOAT',
  'OTHER',
];

function getUserFromStorage() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as { role?: string };
  } catch {
    return null;
  }
}

const GOOGLE_MAPS_ORIGIN = '44.4268,26.1025';
const GOOGLE_MAPS_DESTINATION = '44.4268,26.1025';

function getGoogleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
}

function generateMapUrl(tasks: RouteTask[] | null | undefined) {
  if (!Array.isArray(tasks) || tasks.length === 0) return '';

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return '';

  const waypoints = tasks
    .filter(
      (task) =>
        task?.lat != null &&
        task?.lng != null &&
        !Number.isNaN(task.lat) &&
        !Number.isNaN(task.lng),
    )
    .map((task) => `${task.lat},${task.lng}`);

  if (waypoints.length === 0) return '';

  const waypointString = `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;

  return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${GOOGLE_MAPS_ORIGIN}&destination=${GOOGLE_MAPS_DESTINATION}${waypointString}`;
}

export default function Vehicles() {
  const currentUser = getUserFromStorage();
  const canCreate =
    currentUser?.role === 'OWNER' || currentUser?.role === 'DISPATCHER';
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignedDriverId, setAssignedDriverId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const [optimizingVehicle, setOptimizingVehicle] = useState<Vehicle | null>(null);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [type, setType] = useState<VehicleType>('CAR');
  const [status, setStatus] = useState('AVAILABLE');
  const [currentMileage, setCurrentMileage] = useState(0);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const hasVehicles = vehicles.length > 0;

  useEffect(() => {
    setLoading(true);
    setError(null);

    const vehiclesReq = axiosClient.get<Vehicle[]>('/vehicles');
    const userReq = canCreate ? axiosClient.get<User[]>('/users') : Promise.resolve({ data: [] });

    Promise.all([vehiclesReq, userReq])
      .then(([vehiclesRes, usersRes]) => {
        setVehicles(vehiclesRes.data);
        if (canCreate) {
          setUsers(usersRes.data);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(
          (err as any)?.response?.data?.message ||
            'Unable to load vehicles. Please try again later.',
        );
      })
      .finally(() => setLoading(false));
  }, [canCreate]);

  const resetForm = () => {
    setBrand('');
    setModel('');
    setLicensePlate('');
    setType('CAR');
    setStatus('AVAILABLE');
    setCurrentMileage(0);
    setAssignedDriverId('');
    setEditingVehicleId(null);
    setSaveError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    setSaving(true);

    const payload = {
      brand,
      model,
      licensePlate,
      type,
      status,
      currentMileage,
      assignedDriverId:
        assignedDriverId === '' ? null : Number(assignedDriverId),
    };

    try {
      let data: Vehicle;

      if (editingVehicleId) {
        const response = await axiosClient.put<Vehicle>(`/vehicles/${editingVehicleId}`, payload);
        data = response.data;
        setVehicles((current) =>
          current.map((v) => (v.id === editingVehicleId ? data : v)),
        );
      } else {
        const response = await axiosClient.post<Vehicle>('/vehicles', payload);
        data = response.data;
        setVehicles((current) => [data, ...current]);
      }

      resetForm();
      setFormOpen(false);
    } catch (err) {
      console.error(err);
      setSaveError(
        (err as any)?.response?.data?.message ||
          'Unable to save vehicle. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (vehicle: Vehicle) => {
    setBrand(vehicle.brand);
    setModel(vehicle.model);
    setLicensePlate(vehicle.licensePlate);
    setType(vehicle.type);
    setStatus(vehicle.status || 'AVAILABLE');
    setCurrentMileage(vehicle.currentMileage ?? 0);
    setAssignedDriverId(
      vehicle.assignedDriverId === undefined || vehicle.assignedDriverId === null
        ? ''
        : vehicle.assignedDriverId,
    );
    setEditingVehicleId(vehicle.id);
    setFormOpen(true);
  };

  const handleDelete = async (vehicleId: string) => {
    if (!window.confirm('Are you sure you want to delete this vehicle? This action cannot be undone.')) {
      return;
    }

    try {
      await axiosClient.delete(`/vehicles/${vehicleId}`);
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    } catch (err) {
      console.error(err);
      alert(
        (err as any)?.response?.data?.error ||
          'Unable to delete vehicle. Please try again.',
      );
    }
  };

  const handleUpdateLocation = async (vehicle: Vehicle) => {
    const latInput = window.prompt('Enter current latitude:', String(vehicle.currentLat ?? ''));
    if (latInput === null) return;

    const lngInput = window.prompt('Enter current longitude:', String(vehicle.currentLng ?? ''));
    if (lngInput === null) return;

    const currentLat = Number(latInput);
    const currentLng = Number(lngInput);

    if (Number.isNaN(currentLat) || Number.isNaN(currentLng)) {
      window.alert('Latitude and longitude must be valid numbers.');
      return;
    }

    try {
      const { data } = await axiosClient.put<Vehicle>(`/vehicles/${vehicle.id}/location`, {
        currentLat,
        currentLng,
      });

      setVehicles((current) =>
        current.map((v) => (v.id === data.id ? { ...v, ...data } : v)),
      );
    } catch (err) {
      console.error(err);
      window.alert(
        (err as any)?.response?.data?.error ||
          'Unable to update location. Please try again.',
      );
    }
  };

  const handleOptimizeRoute = async (vehicle: Vehicle) => {
    setOptimizeError(null);
    setOptimizing(true);
    setOptimizingVehicle(vehicle);
    setOptimizeResult(null);
    setOptimizeOpen(true);

    try {
      const { data } = await axiosClient.post<OptimizeResult>(
        `/routing/vehicles/${vehicle.id}/optimize`,
      );
      setOptimizeResult(data);
    } catch (err) {
      console.error(err);
      setOptimizeError(
        (err as any)?.response?.data?.error ||
          'Unable to optimize route. Please try again.',
      );
    } finally {
      setOptimizing(false);
    }
  };

  const filteredVehicles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return vehicles;

    return vehicles.filter((vehicle) => {
      return (
        vehicle.brand.toLowerCase().includes(term) ||
        vehicle.model.toLowerCase().includes(term) ||
        vehicle.licensePlate.toLowerCase().includes(term)
      );
    });
  }, [vehicles, searchTerm]);

  const greedyMapUrl = optimizeResult ? generateMapUrl(optimizeResult.greedy.tasks) : '';
  const googleMapUrl = optimizeResult ? generateMapUrl(optimizeResult.google.tasks) : '';

  const exportToCSV = () => {
    const headers = ['Brand', 'Model', 'License Plate', 'Type', 'Status', 'Mileage'];
    const rows = filteredVehicles.map((vehicle) => [
      vehicle.brand,
      vehicle.model,
      vehicle.licensePlate,
      vehicle.type,
      vehicle.status,
      vehicle.currentMileage?.toString() ?? '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vehicles_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

 const rows = useMemo(
    () =>
      filteredVehicles.map((vehicle) => (
        <tr key={vehicle.id} className="hover:bg-slate-50">
          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{vehicle.brand}</td>
          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{vehicle.model}</td>
          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
            <Link
              to={`/vehicles/${vehicle.id}`}
              className="text-indigo-600 hover:underline"
            >
              {vehicle.licensePlate}
            </Link>
          </td>
          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{vehicle.type}</td>
          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{vehicle.status}</td>
          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{vehicle.currentMileage?.toLocaleString()}</td>
          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
            {vehicle.assignedDriver?.fullName || 'Unassigned'}
          </td>
          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
            {vehicle.currentLat != null && vehicle.currentLng != null
              ? `${vehicle.currentLat.toFixed(4)}, ${vehicle.currentLng.toFixed(4)}`
              : '-'}
          </td>
          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
            <div className="flex flex-wrap gap-2">
              {canCreate && (
                <button
                  type="button"
                  onClick={() => handleEditClick(vehicle)}
                  className="rounded-md bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Edit
                </button>
              )}
              <Link
                to={`/vehicles/${vehicle.id}`}
                className="rounded-md bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                View
              </Link>
              <button
                type="button"
                onClick={() => handleUpdateLocation(vehicle)}
                className="rounded-md bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Update location
              </button>
              <button
                type="button"
                onClick={() => handleOptimizeRoute(vehicle)}
                disabled={optimizing}
                className="rounded-md bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {optimizing && optimizingVehicle?.id === vehicle.id ? 'Optimizing…' : 'Optimize'}
              </button>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => handleDelete(vehicle.id)}
                  className="rounded-md bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                >
                  Delete
                </button>
              )}
            </div>
          </td>
        </tr>
      )),
    [filteredVehicles, canCreate],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Vehicles</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage your fleet and keep vehicle data up to date.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <div className="flex w-full items-center gap-2 md:w-auto">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by License Plate or Brand..."
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 md:w-80"
            />
            <button
              type="button"
              onClick={exportToCSV}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              Export to CSV
            </button>
          </div>

          {canCreate && (
            <button
              type="button"
              onClick={() => setFormOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {formOpen ? 'Close form' : 'Add New Vehicle'}
            </button>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">New vehicle</h3>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Brand</span>
                <input
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Toyota"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Model</span>
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Corolla"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">License plate</span>
                <input
                  value={licensePlate}
                  onChange={(event) => setLicensePlate(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="AB-123-CD"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Current mileage</span>
                <input
                  type="number"
                  value={currentMileage}
                  onChange={(event) => setCurrentMileage(Number(event.target.value))}
                  min={0}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="0"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Type</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as VehicleType)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {vehicleTypes.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="IN_SERVICE">IN_SERVICE</option>
                  <option value="OUT_OF_ORDER">OUT_OF_ORDER</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </label>

              {canCreate && (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Assigned Driver</span>
                  <select
                    value={assignedDriverId}
                    onChange={(event) =>
                      setAssignedDriverId(
                        event.target.value === '' ? '' : Number(event.target.value),
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
                {saving ? 'Saving…' : 'Save vehicle'}
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
          <h3 className="text-base font-semibold text-slate-900">Vehicle fleet</h3>
          <span className="text-sm text-slate-500">
            {loading
              ? 'Loading…'
              : filteredVehicles.length === vehicles.length
              ? `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`
              : `${filteredVehicles.length} of ${vehicles.length} vehicles`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Brand</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Model</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">License Plate</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Mileage</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Driver</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Location</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">{rows}</tbody>
          </table>
        </div>

        {loading && (
          <div className="px-6 py-4 text-sm text-slate-600">Loading vehicles…</div>
        )}

        {!loading && error && (
          <div className="px-6 py-4 text-sm text-rose-700">{error}</div>
        )}

        {!loading && !error && !hasVehicles && (
          <div className="px-6 py-4 text-sm text-slate-600">
            No vehicles found. Click “Add New Vehicle” to create one.
          </div>
        )}
      </div>

      {optimizeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Route Optimization Comparison</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Comparing Greedy and Google Directions optimization for {optimizingVehicle?.brand} {optimizingVehicle?.model}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOptimizeOpen(false);
                  setOptimizeResult(null);
                  setOptimizeError(null);
                  setOptimizingVehicle(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              {optimizing ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-600">
                  Optimizing route… Please wait.
                </div>
              ) : optimizeError ? (
                <div className="rounded-2xl bg-rose-50 p-6 text-sm text-rose-700">
                  {optimizeError}
                </div>
              ) : optimizeResult ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Greedy Algorithm</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">
                          {optimizeResult.greedy.totalDistance.toFixed(2)} km
                        </p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Route length: {optimizeResult.greedy.tasks.length} stops
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Google Directions</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">
                          {optimizeResult.google.totalDistance.toFixed(2)} km
                        </p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Route length: {optimizeResult.google.tasks.length} stops
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-600">Google saved</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">
                      {(optimizeResult.greedy.totalDistance - optimizeResult.google.totalDistance).toFixed(2)} km
                    </p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <section className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-semibold text-slate-900">Greedy Task Order</h4>
                      <ol className="mt-4 space-y-3">
                        {optimizeResult.greedy.tasks.map((task, index) => (
                          <li key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Stop {index + 1}
                            </div>
                            <div className="mt-1 text-sm text-slate-800">
                              {task.address || task.pickupLocation || task.dropoffLocation || `${task.lat.toFixed(4)}, ${task.lng.toFixed(4)}`}
                            </div>
                          </li>
                        ))}
                      </ol>
                      {greedyMapUrl ? (
                        <iframe
                          width="100%"
                          height="300"
                          style={{ border: 0, borderRadius: '8px', marginTop: '16px' }}
                          src={greedyMapUrl}
                          allowFullScreen
                        />
                      ) : null}
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-semibold text-slate-900">Google Task Order</h4>
                      <ol className="mt-4 space-y-3">
                        {optimizeResult.google.tasks.map((task, index) => (
                          <li key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Stop {index + 1}
                            </div>
                            <div className="mt-1 text-sm text-slate-800">
                              {task.address || task.pickupLocation || task.dropoffLocation || `${task.lat.toFixed(4)}, ${task.lng.toFixed(4)}`}
                            </div>
                          </li>
                        ))}
                      </ol>
                      {googleMapUrl ? (
                        <iframe
                          width="100%"
                          height="300"
                          style={{ border: 0, borderRadius: '8px', marginTop: '16px' }}
                          src={googleMapUrl}
                          allowFullScreen
                        />
                      ) : null}
                    </section>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-600">
                  Click Optimize to compare route options.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
