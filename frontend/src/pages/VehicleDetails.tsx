import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axiosClient from '../api/axiosClient';

type Vehicle = {
  id: number;
  brand: string;
  model: string;
  licensePlate: string;
  type: string;
  status: string;
  currentMileage: number;
  currentLat?: number | null;
  currentLng?: number | null;
};

type Document = {
  id: number;
  documentType: string;
  fileUrl: string;
  expiresAt?: string | null;
  createdAt: string;
};

type MaintenanceLog = {
  id: number;
  reportType: string;
  description: string;
  cost?: number | null;
  receiptUrl?: string | null;
  reportedAt: string;
  employee: { id: number; fullName: string };
};

type OBDError = {
  id: number;
  code: string;
  description?: string | null;
  resolved: boolean;
  createdAt: string;
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function VehicleDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [obdErrors, setObdErrors] = useState<OBDError[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [obdLoading, setObdLoading] = useState(false);
  const [obdError, setObdError] = useState<string | null>(null);

  const [docModalOpen, setDocModalOpen] = useState(false);
  const [maintModalOpen, setMaintModalOpen] = useState(false);
  const [newMileage, setNewMileage] = useState<number | ''>('');

  const [docType, setDocType] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

  const reloadAll = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const [vehicleRes, docsRes, logsRes, obdRes] = await Promise.all([
        axiosClient.get<Vehicle>(`/vehicles/${id}`),
        axiosClient.get<Document[]>(`/documents/vehicle/${id}`),
        axiosClient.get<MaintenanceLog[]>(`/maintenance/vehicle/${id}`),
        axiosClient.get<OBDError[]>(`/vehicles/${id}/obd`),
      ]);

      setVehicle(vehicleRes.data);
      setDocuments(docsRes.data);
      setLogs(logsRes.data);
      setObdErrors(obdRes.data);
    } catch (err) {
      console.error(err);
      setError(
        (err as any)?.response?.data?.error ||
          'Unable to load vehicle details. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const closeModals = () => {
    setDocModalOpen(false);
    setMaintModalOpen(false);
  };

  const resetDocForm = () => {
    setDocType('');
    setFileUrl('');
    setExpiresAt('');
  };

  const resetMaintForm = () => {
    setReportType('');
    setDescription('');
    setCost('');
    setReceiptUrl('');
  };

  const handleAddDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!vehicle) return;

    try {
      await axiosClient.post('/documents', {
        vehicleId: vehicle.id,
        documentType: docType,
        fileUrl,
        expiresAt: expiresAt || undefined,
      });
      resetDocForm();
      closeModals();
      reloadAll();
    } catch (err) {
      console.error(err);
      window.alert(
        (err as any)?.response?.data?.error ||
          'Unable to add document. Please try again.',
      );
    }
  };

  const handleUpdateMileage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!vehicle) return;

    if (newMileage === '' || typeof newMileage !== 'number' || Number.isNaN(newMileage)) {
      toast.error('Please enter a valid numeric mileage.');
      return;
    }

    try {
      const response = await axiosClient.put<Vehicle>(`/vehicles/${vehicle.id}/mileage`, {
        newMileage,
      });
      setVehicle(response.data);
      toast.success('Mileage updated successfully.');
      setNewMileage('');
    } catch (err) {
      console.error(err);
      toast.error(
        (err as any)?.response?.data?.error ||
          'Unable to update mileage. Please try again.',
      );
    }
  };

  const fetchObdErrors = async () => {
    if (!id) return;
    setObdLoading(true);
    setObdError(null);

    try {
      const response = await axiosClient.get<OBDError[]>(`/vehicles/${id}/obd`);
      setObdErrors(response.data);
    } catch (err) {
      console.error(err);
      setObdError(
        (err as any)?.response?.data?.error ||
          'Unable to load diagnostics. Please try again.',
      );
    } finally {
      setObdLoading(false);
    }
  };

  const handleResolveObdError = async (errorId: number) => {
    if (!vehicle) return;
    try {
      await axiosClient.put(`/vehicles/${vehicle.id}/obd/${errorId}/resolve`);
      await fetchObdErrors();
      toast.success('OBD error marked as resolved.');
    } catch (err) {
      console.error(err);
      toast.error(
        (err as any)?.response?.data?.error ||
          'Unable to resolve OBD error. Please try again.',
      );
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm('Delete this maintenance log?')) return;

    try {
      await axiosClient.delete(`/maintenance/${logId}`);
      setLogs((prev) => prev.filter((log) => log.id !== logId));
      toast.success('Maintenance log deleted successfully.');
    } catch (err) {
      console.error(err);
      toast.error(
        (err as any)?.response?.data?.error ||
          'Unable to delete maintenance log. Please try again.',
      );
    }
  };

  const handleAddMaintenance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!vehicle) return;

    try {
      await axiosClient.post('/maintenance', {
        vehicleId: vehicle.id,
        reportType,
        description,
        cost: cost ? Number(cost) : undefined,
        receiptUrl: receiptUrl || undefined,
      });

      resetMaintForm();
      closeModals();
      reloadAll();
    } catch (err) {
      console.error(err);
      window.alert(
        (err as any)?.response?.data?.error ||
          'Unable to add maintenance log. Please try again.',
      );
    }
  };

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-700">No vehicle ID provided.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Vehicle details
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            View documents and maintenance logs for this vehicle.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </div>

      {loading && (
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          Loading vehicle details…
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      )}

      {vehicle && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-500">Vehicle</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {vehicle.brand} {vehicle.model}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  License plate: <span className="font-medium">{vehicle.licensePlate}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 md:mt-0">
                <div className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-700">
                  Type: {vehicle.type}
                </div>
                <div className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-700">
                  Status: {vehicle.status}
                </div>
                <div className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-700">
                  Mileage: {vehicle.currentMileage.toLocaleString()}
                </div>
              </div>
              <form onSubmit={handleUpdateMileage} className="mt-4 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <span>Set mileage:</span>
                  <input
                    type="number"
                    value={newMileage}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewMileage(value === '' ? '' : Number(value));
                    }}
                    min={vehicle.currentMileage}
                    className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="New mileage"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  Update Mileage
                </button>
              </form>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Diagnostics</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Active OBD-II diagnostic trouble codes for this vehicle.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchObdErrors}
                className="inline-flex items-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500"
              >
                Refresh / Scan
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {obdLoading ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  Loading diagnostic codes…
                </div>
              ) : obdError ? (
                <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
                  {obdError}
                </div>
              ) : obdErrors.length === 0 ? (
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
                  No active OBD errors.
                </div>
              ) : (
                <div className="space-y-3">
                  {obdErrors.map((error) => (
                    <div
                      key={error.id}
                      className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-rose-900">{error.code}</p>
                          <p className="text-sm text-slate-700">
                            {error.description || 'No description provided.'}
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          {new Date(error.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                          Active
                        </span>
                        <button
                          type="button"
                          onClick={() => handleResolveObdError(error.id)}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Mark as Resolved
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Documents</h3>
                <button
                  type="button"
                  onClick={() => setDocModalOpen(true)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  Add Document
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Expiry
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Link
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {documents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-500">
                          No documents found.
                        </td>
                      </tr>
                    ) : (
                      documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="px-4 py-4 text-sm text-slate-700">{doc.documentType}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {formatDate(doc.expiresAt)}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline"
                            >
                              View
                            </a>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            <button
                              type="button"
                              className="rounded-lg bg-rose-500 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-400"
                              onClick={async () => {
                                if (!window.confirm('Delete this document?')) return;
                                try {
                                  await axiosClient.delete(`/documents/${doc.id}`);
                                  setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
                                  toast.success('Document deleted successfully.');
                                } catch (err) {
                                  console.error(err);
                                  toast.error(
                                    (err as any)?.response?.data?.error ||
                                      'Unable to delete document. Please try again.',
                                  );
                                }
                              }}
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
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Maintenance logs</h3>
                <button
                  type="button"
                  onClick={() => setMaintModalOpen(true)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  Add Maintenance
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Cost
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Reported by
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Receipt / Link
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                          No maintenance logs.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-4 text-sm text-slate-700">{log.reportType}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{log.description}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {log.cost != null ? `${log.cost.toFixed(2)} RON` : '-'}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {formatDate(log.reportedAt)}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {log.employee?.fullName ?? '-'}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {log.receiptUrl ? (
                              <a
                                href={log.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline"
                              >
                                View Link
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            <button
                              type="button"
                              className="rounded-lg bg-rose-500 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-400"
                              onClick={() => handleDeleteLog(log.id)}
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
            </section>
          </div>
        </div>
      )}

      {(docModalOpen || maintModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {docModalOpen ? 'Add document' : 'Add maintenance log'}
              </h3>
              <button
                type="button"
                onClick={closeModals}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            {docModalOpen ? (
              <form onSubmit={handleAddDocument} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Document type</span>
                  <input
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="RCA, ITP, etc."
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">File URL</span>
                  <input
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="https://..."
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Expires at</span>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Save document
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddMaintenance} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Report type</span>
                  <input
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="Repair, Inspection, etc."
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="mt-1 h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="Details about the issue or work performed"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Cost</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="Amount (optional)"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Receipt URL</span>
                  <input
                    value={receiptUrl}
                    onChange={(e) => setReceiptUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="https://..."
                  />
                </label>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Save log
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
