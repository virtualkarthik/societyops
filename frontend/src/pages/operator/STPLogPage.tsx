import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import toast from "react-hot-toast";
import type { OutboxEntry, STPLog, Asset } from "../../api/types";
import api from "../../api/client";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { queueEntry, syncOutbox } from "../../offline/sync";
import { db } from "../../offline/db";
import { generateUUID } from "../../lib/uuid";
import { recentDateLabels } from "../../lib/trend";
import { SyncStatusBadge } from "../../components/SyncStatusBadge";
import { TrendChart } from "../../components/TrendChart";

function StatCard({ label, value, unit, color = "text-gray-800" }: { label: string; value: string | number | null; unit?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span></p>
    </div>
  );
}

function LogEntryModal({ assets, onClose, onSuccess }: {
  assets: Asset[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    asset_id: assets.length === 1 ? String(assets[0].id) : "",
    logged_at: new Date().toISOString().slice(0, 16),
    shift: "AM",
    ph: "", mlss: "", chlorine_dosing: "", blower_run_hours: "",
    inlet_flow: "", outlet_flow: "", tank_level: "", power_hours: "",
    backwash_done: false, sludge_removed: false, notes: "",
  });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset_id) { toast.error("Select an asset"); return; }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      asset_id: Number(form.asset_id),
      logged_at: new Date(form.logged_at).toISOString(),
      shift: form.shift || null,
      ph: form.ph ? Number(form.ph) : null,
      mlss: form.mlss ? Number(form.mlss) : null,
      chlorine_dosing: form.chlorine_dosing ? Number(form.chlorine_dosing) : null,
      blower_run_hours: form.blower_run_hours ? Number(form.blower_run_hours) : null,
      inlet_flow: form.inlet_flow ? Number(form.inlet_flow) : null,
      outlet_flow: form.outlet_flow ? Number(form.outlet_flow) : null,
      tank_level: form.tank_level ? Number(form.tank_level) : null,
      backwash_done: form.backwash_done,
      sludge_removed: form.sludge_removed,
      power_hours: form.power_hours ? Number(form.power_hours) : null,
      notes: form.notes || null,
    };
    try {
      if (online) {
        payload.client_uuid = generateUUID();
        await api.post("/stp/logs", payload);
        toast.success("STP log submitted");
        await syncOutbox();
      } else {
        await queueEntry("stp_log", payload, photo ? [{ field: "photo_url", blob: photo, name: photo.name }] : []);
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
          <h2 className="font-semibold text-gray-800">Log STP Entry</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.asset")}</label>
            <select required value={form.asset_id} onChange={(e) => set("asset_id", e.target.value)}
              className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]">
              <option value="">Select STP Asset…</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.date")}</label>
              <input type="datetime-local" value={form.logged_at} onChange={(e) => set("logged_at", e.target.value)}
                className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("stp.shift")}</label>
              <select value={form.shift} onChange={(e) => set("shift", e.target.value)}
                className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
                <option value="NIGHT">Night</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["ph", "pH", "0.1"], ["mlss", "MLSS (mg/L)", "1"],
              ["chlorine_dosing", "Chlorine (mg/L)", "0.1"], ["blower_run_hours", "Blower Hours", "0.1"],
              ["inlet_flow", "Inlet Flow (m³/hr)", "0.1"], ["outlet_flow", "Outlet Flow (m³/hr)", "0.1"],
              ["tank_level", "Tank Level (%)", "1"], ["power_hours", "Power Hours", "0.1"],
            ] as [string, string, string][]).map(([field, label, step]) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="number" step={step} value={form[field as keyof typeof form] as string}
                  onChange={(e) => set(field, e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-base" inputMode="decimal" />
              </div>
            ))}
          </div>
          <div className="flex gap-6">
            {([["backwash_done", "Backwash Done"], ["sludge_removed", "Sludge Removed"]] as [string, string][]).map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[field as keyof typeof form] as boolean}
                  onChange={(e) => set(field, e.target.checked)} className="w-5 h-5 rounded accent-brand" />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-base" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
            <input type="file" accept="image/*" capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)} className="w-full text-sm" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-brand text-white font-semibold py-3 rounded-xl text-base min-h-[52px] disabled:opacity-60">
            {submitting ? "Submitting…" : "Submit Log"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function STPLogPage() {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.get<Asset[]>("/assets", { params: { type: "STP" } })
      .then((r) => setAssets(r.data))
      .catch(() => db.cachedAssets.where("type").equals("STP").toArray().then(setAssets));
  }, []);

  const { data: logs = [], isLoading } = useQuery<STPLog[]>({
    queryKey: ["stp-logs"],
    queryFn: () => api.get<STPLog[]>("/stp/logs").then((r) => r.data),
    enabled: online,
  });

  const pendingQueue = useLiveQuery(
    () => db.outbox.where("entity_type").equals("stp_log").reverse().limit(20).toArray(), []
  );

  const recent = [...logs].sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()).slice(0, 10);
  const last = recent[0];

  const breaches = recent.filter((l) => l.ph !== null && (l.ph < 6.5 || l.ph > 9.0));

  const trendData = useMemo(() => {
    const days = recentDateLabels(logs.map((l) => l.logged_at), 5);
    const grouped: Record<string, STPLog[]> = {};
    logs.forEach((log) => {
      const label = new Date(log.logged_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(log);
    });
    return days.map((label) => {
      const group = grouped[label] ?? [];
      const phVals = group.map((l) => l.ph).filter((v) => v != null) as number[];
      const mlssVals = group.map((l) => l.mlss).filter((v) => v != null) as number[];
      return {
        date: label,
        ph: phVals.length ? Math.round((phVals.reduce((a, b) => a + b, 0) / phVals.length) * 100) / 100 : null,
        mlss: mlssVals.length ? Math.round(mlssVals.reduce((a, b) => a + b, 0) / mlssVals.length) : null,
      };
    });
  }, [logs]);

  return (
    <div className="max-w-3xl mx-auto">
      {showForm && (
        <LogEntryModal
          assets={assets}
          onClose={() => setShowForm(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["stp-logs"] })}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">STP Operations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sewage Treatment Plant — monitoring & logs</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-brand text-white px-5 py-2.5 rounded-lg font-medium text-sm min-h-[44px] hover:bg-brand-dark">
          + Log Entry
        </button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Last pH" value={last?.ph ?? null} color={last?.ph && (last.ph < 6.5 || last.ph > 9.0) ? "text-red-600" : "text-green-700"} />
        <StatCard label="Last MLSS" value={last?.mlss ?? null} unit="mg/L" />
        <StatCard label="Outlet Flow" value={last?.outlet_flow ?? null} unit="m³/hr" />
        <StatCard label="pH Breaches (last 10)" value={breaches.length} color={breaches.length > 0 ? "text-red-600" : "text-green-700"} />
      </div>

      {/* Trend charts */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <TrendChart
          title="pH Trend — Last 5 Days"
          data={trendData}
          series={[{ key: "ph", label: "Avg pH" }]}
          referenceLines={[
            { y: 6.5, label: "Min", color: "#ef4444" },
            { y: 9.0, label: "Max", color: "#ef4444" },
          ]}
          height={180}
        />
        <TrendChart
          title="MLSS Trend — Last 5 Days"
          data={trendData}
          series={[{ key: "mlss", label: "Avg MLSS", color: "#0284c7" }]}
          yUnit=" mg/L"
          height={180}
        />
      </div>

      {/* Breach alert */}
      {breaches.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex gap-3 items-start">
          <span className="text-red-500 text-lg">⚠</span>
          <div>
            <p className="font-semibold text-red-700 text-sm">pH Breach Detected</p>
            <p className="text-xs text-red-600 mt-0.5">
              {breaches.length} reading(s) outside 6.5–9.0 range. Last breach: pH {breaches[0].ph} on {new Date(breaches[0].logged_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* Offline queue */}
      {pendingQueue && pendingQueue.filter((e) => e.status === "pending").length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-center gap-2">
          <span className="text-amber-500">📶</span>
          <span className="text-sm text-amber-700">
            {pendingQueue.filter((e) => e.status === "pending").length} entries pending sync
          </span>
        </div>
      )}

      {/* Recent logs table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">Recent Logs</h2>
          {isLoading && <span className="text-xs text-gray-400">Loading…</span>}
        </div>
        {recent.length === 0 && !isLoading ? (
          <div className="text-center text-gray-400 py-10 text-sm">No logs yet — tap "Log Entry" to record the first one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date / Shift</th>
                  <th className="px-4 py-3 text-right">pH</th>
                  <th className="px-4 py-3 text-right">MLSS</th>
                  <th className="px-4 py-3 text-right">Inlet</th>
                  <th className="px-4 py-3 text-right">Outlet</th>
                  <th className="px-4 py-3 text-right">Blower hrs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map((log) => {
                  const phBreach = log.ph !== null && (log.ph < 6.5 || log.ph > 9.0);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{new Date(log.logged_at).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">{log.shift ?? "—"}</div>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${phBreach ? "text-red-600" : "text-gray-700"}`}>
                        {log.ph ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.mlss ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.inlet_flow ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.outlet_flow ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.blower_run_hours ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Offline queue history */}
      {pendingQueue && pendingQueue.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
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
