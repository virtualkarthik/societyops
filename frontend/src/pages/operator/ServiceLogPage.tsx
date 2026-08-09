import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import toast from "react-hot-toast";
import type { OutboxEntry, ServiceRecord, ServiceType, Asset } from "../../api/types";
import api from "../../api/client";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { queueEntry, syncOutbox } from "../../offline/sync";
import { db } from "../../offline/db";
import { SyncStatusBadge } from "../../components/SyncStatusBadge";
import { generateUUID } from "../../lib/uuid";

const SERVICE_TYPES: ServiceType[] = ["ROUTINE", "REPAIR", "BREAKDOWN", "AMC_VISIT", "INSPECTION"];

const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  ROUTINE: "Routine",
  REPAIR: "Repair",
  BREAKDOWN: "Breakdown",
  AMC_VISIT: "AMC Visit",
  INSPECTION: "Inspection",
};

const SERVICE_TYPE_COLOR: Record<ServiceType, string> = {
  ROUTINE: "bg-blue-50 text-blue-700",
  REPAIR: "bg-amber-50 text-amber-700",
  BREAKDOWN: "bg-red-50 text-red-700",
  AMC_VISIT: "bg-purple-50 text-purple-700",
  INSPECTION: "bg-gray-100 text-gray-700",
};

function LogServiceModal({ assets, fixedAssetId, onClose, onSuccess }: {
  assets: Asset[];
  fixedAssetId?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const online = useOnlineStatus();
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    asset_id: fixedAssetId ? String(fixedAssetId) : "",
    service_date: today,
    service_type: "ROUTINE" as ServiceType,
    vendor_name: "",
    technician_name: "",
    cost: "",
    next_service_due: "",
    notes: "",
  });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset_id) { toast.error("Select an asset"); return; }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      asset_id: Number(form.asset_id),
      service_date: form.service_date,
      service_type: form.service_type,
      vendor_name: form.vendor_name || null,
      technician_name: form.technician_name || null,
      cost: form.cost ? Number(form.cost) : null,
      next_service_due: form.next_service_due || null,
      notes: form.notes || null,
    };
    try {
      if (online) {
        payload.client_uuid = generateUUID();
        await api.post("/service-records", payload);
        toast.success("Service record saved");
        await syncOutbox();
      } else {
        await queueEntry("service_record", payload);
        toast("Saved offline — will sync when online", { icon: "📶" });
      }
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Log Service</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!fixedAssetId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
              <select required value={form.asset_id} onChange={(e) => set("asset_id", e.target.value)}
                className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]">
                <option value="">Select Asset…</option>
                {assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Date</label>
              <input type="date" value={form.service_date} onChange={(e) => set("service_date", e.target.value)}
                required className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.service_type} onChange={(e) => set("service_type", e.target.value)}
                className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]">
                {SERVICE_TYPES.map((t) => <option key={t} value={t}>{SERVICE_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
              <input type="text" value={form.vendor_name} onChange={(e) => set("vendor_name", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Technician</label>
              <input type="text" value={form.technician_name} onChange={(e) => set("technician_name", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-base" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost (₹)</label>
              <input type="number" step="1" value={form.cost} onChange={(e) => set("cost", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-base" inputMode="decimal" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Service Due</label>
              <input type="date" value={form.next_service_due} onChange={(e) => set("next_service_due", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-base" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes — what was done</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
              rows={3} className="w-full border rounded-lg px-3 py-2 text-base" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-brand text-white font-semibold py-3 rounded-xl text-base min-h-[52px] disabled:opacity-60">
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ServiceLogPage({ fixedAssetId }: { fixedAssetId?: number }) {
  const qc = useQueryClient();
  const online = useOnlineStatus();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.get<Asset[]>("/assets")
      .then((r) => setAssets(r.data))
      .catch(() => db.cachedAssets.toArray().then(setAssets));
  }, []);

  const { data: records = [], isLoading } = useQuery<ServiceRecord[]>({
    queryKey: ["service-records", fixedAssetId ?? "all"],
    queryFn: () =>
      api.get<ServiceRecord[]>("/service-records", { params: fixedAssetId ? { asset_id: fixedAssetId } : {} })
        .then((r) => r.data),
    enabled: online,
  });

  const pendingQueue = useLiveQuery(
    () => db.outbox.where("entity_type").equals("service_record").reverse().limit(20).toArray(), []
  );

  const assetName = (id: number) => assets.find((a) => a.id === id)?.name ?? `#${id}`;
  const pendingCount = pendingQueue?.filter((e) => e.status === "pending").length ?? 0;

  return (
    <div className={fixedAssetId ? "" : "max-w-3xl mx-auto"}>
      {showForm && (
        <LogServiceModal
          assets={assets}
          fixedAssetId={fixedAssetId}
          onClose={() => setShowForm(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["service-records"] })}
        />
      )}

      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="font-semibold text-gray-800">{fixedAssetId ? "Service History" : "Service Records"}</h2>
          {!fixedAssetId && <p className="text-sm text-gray-500 mt-0.5">Repairs, breakdowns & vendor visits for any asset</p>}
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-brand text-white px-4 py-2 rounded-lg font-medium text-sm min-h-[44px] hover:bg-brand-dark">
          + Log Service
        </button>
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <span className="text-amber-500">📶</span>
          <span className="text-sm text-amber-700">{pendingCount} service record(s) pending sync</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {records.length === 0 && !isLoading ? (
          <div className="text-center text-gray-400 py-10 text-sm">No service records yet — tap "+ Log Service" to add one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  {!fixedAssetId && <th className="px-4 py-3 text-left">Asset</th>}
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Vendor / Technician</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-800">{new Date(r.service_date).toLocaleDateString()}</td>
                    {!fixedAssetId && <td className="px-4 py-3 text-gray-600">{assetName(r.asset_id)}</td>}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${SERVICE_TYPE_COLOR[r.service_type]}`}>
                        {SERVICE_TYPE_LABEL[r.service_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {[r.vendor_name, r.technician_name].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.cost != null ? `₹${r.cost}` : "—"}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={r.notes ?? ""}>{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingQueue && pendingQueue.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-4">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-700">Offline Queue</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingQueue.map((entry: OutboxEntry) => (
              <div key={entry.id} className="px-4 py-3 flex justify-between items-center">
                <span className="text-xs text-gray-500">{new Date(entry.created_at).toLocaleString()}</span>
                <SyncStatusBadge status={entry.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
