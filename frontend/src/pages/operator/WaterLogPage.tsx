import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import toast from "react-hot-toast";
import type { OutboxEntry, WaterLog, Asset } from "../../api/types";
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
    borewell_run_hours: "", water_level: "", motor_health_note: "",
    sump_level: "", oht_level: "", notes: "",
  });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset_id) { toast.error("Select an asset"); return; }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      asset_id: Number(form.asset_id),
      logged_at: new Date(form.logged_at).toISOString(),
      borewell_run_hours: form.borewell_run_hours ? Number(form.borewell_run_hours) : null,
      water_level: form.water_level ? Number(form.water_level) : null,
      motor_health_note: form.motor_health_note || null,
      sump_level: form.sump_level ? Number(form.sump_level) : null,
      oht_level: form.oht_level ? Number(form.oht_level) : null,
      notes: form.notes || null,
    };
    try {
      if (online) {
        payload.client_uuid = generateUUID();
        await api.post("/water/logs", payload);
        toast.success("Water log submitted");
        await syncOutbox();
      } else {
        await queueEntry("water_log", payload, photo ? [{ field: "photo_url", blob: photo, name: photo.name }] : []);
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
          <h2 className="font-semibold text-gray-800">Log Water Entry</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.asset")}</label>
            <select required value={form.asset_id} onChange={(e) => set("asset_id", e.target.value)}
              className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]">
              <option value="">Select Borewell / Water Asset…</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
            <input type="datetime-local" value={form.logged_at} onChange={(e) => set("logged_at", e.target.value)}
              className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["borewell_run_hours", "Borewell Run Hours", "0.1"],
              ["water_level", "Water Level (m)", "0.1"],
              ["sump_level", "Sump Level (%)", "1"],
              ["oht_level", "OHT Level (%)", "1"],
            ] as [string, string, string][]).map(([field, label, step]) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="number" step={step} value={form[field as keyof typeof form] as string}
                  onChange={(e) => set(field, e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-base" inputMode="decimal" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motor Health Note</label>
            <input type="text" value={form.motor_health_note} onChange={(e) => set("motor_health_note", e.target.value)}
              placeholder="e.g. Running fine / Vibration noticed"
              className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]" />
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

export function WaterLogPage() {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.get<Asset[]>("/assets", { params: { type: "BOREWELL" } })
      .then((r) => setAssets(r.data))
      .catch(() => db.cachedAssets.where("type").equals("BOREWELL").toArray().then(setAssets));
  }, []);

  const { data: logs = [], isLoading } = useQuery<WaterLog[]>({
    queryKey: ["water-logs"],
    queryFn: () => api.get<WaterLog[]>("/water/logs").then((r) => r.data),
    enabled: online,
  });

  const { data: balance } = useQuery<{ total_borewell_run_hours: number; total_tanker_litres: number }>({
    queryKey: ["water-balance"],
    queryFn: () => api.get("/water/balance").then((r) => r.data),
    enabled: online,
  });

  const pendingQueue = useLiveQuery(
    () => db.outbox.where("entity_type").equals("water_log").reverse().limit(20).toArray(), []
  );

  const recent = [...logs].sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()).slice(0, 10);
  const last = recent[0];
  const totalHoursThisMonth = recent.reduce((sum, l) => sum + (l.borewell_run_hours ?? 0), 0);

  const trendData = useMemo(() => {
    const days = recentDateLabels(logs.map((l) => l.logged_at), 5);
    const grouped: Record<string, WaterLog[]> = {};
    logs.forEach((log) => {
      const label = new Date(log.logged_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(log);
    });
    return days.map((label) => {
      const group = grouped[label] ?? [];
      const levelVals = group.map((l) => l.water_level).filter((v) => v != null) as number[];
      const runHrs = group.map((l) => l.borewell_run_hours ?? 0).reduce((a, b) => a + b, 0);
      return {
        date: label,
        water_level: levelVals.length ? Math.round((levelVals.reduce((a, b) => a + b, 0) / levelVals.length) * 10) / 10 : null,
        borewell_run_hours: group.length ? Math.round(runHrs * 10) / 10 : null,
      };
    });
  }, [logs]);

  return (
    <div className="max-w-3xl mx-auto">
      {showForm && (
        <LogEntryModal
          assets={assets}
          onClose={() => setShowForm(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["water-logs"] })}
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Water Operations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Borewell, Sump & OHT — monitoring & logs</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-brand text-white px-5 py-2.5 rounded-lg font-medium text-sm min-h-[44px] hover:bg-brand-dark">
          + Log Entry
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Last Water Level" value={last?.water_level ?? null} unit="m" />
        <StatCard label="Last Sump Level" value={last?.sump_level ?? null} unit="%" />
        <StatCard label="Last OHT Level" value={last?.oht_level ?? null} unit="%" />
        <StatCard label="Borewell Hrs (month)" value={balance ? Math.round(balance.total_borewell_run_hours * 10) / 10 : totalHoursThisMonth} unit="hrs" />
      </div>

      {/* Trend charts */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <TrendChart
          title="Water Level — Last 5 Days"
          data={trendData}
          series={[{ key: "water_level", label: "Avg Level (m)", color: "#0ea5e9" }]}
          yUnit=" m"
          height={180}
        />
        <TrendChart
          title="Borewell Run Hours — Last 5 Days"
          data={trendData}
          series={[{ key: "borewell_run_hours", label: "Run Hrs", color: "#10b981", type: "bar" }]}
          yUnit=" hrs"
          height={180}
        />
      </div>

      {balance && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-blue-600 font-medium">Borewell Run (this month)</p>
            <p className="text-xl font-bold text-blue-800">{balance.total_borewell_run_hours.toFixed(1)} hrs</p>
          </div>
          <div>
            <p className="text-xs text-blue-600 font-medium">Tanker Deliveries (this month)</p>
            <p className="text-xl font-bold text-blue-800">{balance.total_tanker_litres.toLocaleString()} L</p>
          </div>
        </div>
      )}

      {pendingQueue && pendingQueue.filter((e) => e.status === "pending").length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-center gap-2">
          <span className="text-amber-500">📶</span>
          <span className="text-sm text-amber-700">
            {pendingQueue.filter((e) => e.status === "pending").length} entries pending sync
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">Recent Logs</h2>
          {isLoading && <span className="text-xs text-gray-400">Loading…</span>}
        </div>
        {recent.length === 0 && !isLoading ? (
          <div className="text-center text-gray-400 py-10 text-sm">No logs yet — tap "+ Log Entry" to record the first one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Run Hrs</th>
                  <th className="px-4 py-3 text-right">Level (m)</th>
                  <th className="px-4 py-3 text-right">Sump %</th>
                  <th className="px-4 py-3 text-right">OHT %</th>
                  <th className="px-4 py-3 text-left">Motor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{new Date(log.logged_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{log.borewell_run_hours ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{log.water_level ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{log.sump_level ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{log.oht_level ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">{log.motor_health_note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
