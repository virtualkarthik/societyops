import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import toast from "react-hot-toast";
import type { OutboxEntry, DGLog, Asset } from "../../api/types";
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
  const now = new Date().toISOString().slice(0, 16);
  const [form, setForm] = useState({
    asset_id: assets.length === 1 ? String(assets[0].id) : "",
    run_start: now, run_end: "",
    diesel_opening: "", diesel_closing: "",
    load_kw: "", frequency: "50", voltage: "415", notes: "",
  });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset_id) { toast.error("Select a DG asset"); return; }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      asset_id: Number(form.asset_id),
      run_start: new Date(form.run_start).toISOString(),
      run_end: form.run_end ? new Date(form.run_end).toISOString() : null,
      diesel_opening: form.diesel_opening ? Number(form.diesel_opening) : null,
      diesel_closing: form.diesel_closing ? Number(form.diesel_closing) : null,
      load_kw: form.load_kw ? Number(form.load_kw) : null,
      frequency: form.frequency ? Number(form.frequency) : null,
      voltage: form.voltage ? Number(form.voltage) : null,
      notes: form.notes || null,
    };
    try {
      if (online) {
        payload.client_uuid = generateUUID();
        await api.post("/dg/logs", payload);
        toast.success("DG log submitted");
        await syncOutbox();
      } else {
        await queueEntry("dg_log", payload, photo ? [{ field: "photo_url", blob: photo, name: photo.name }] : []);
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
          <h2 className="font-semibold text-gray-800">Log DG Entry</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.asset")}</label>
            <select required value={form.asset_id} onChange={(e) => set("asset_id", e.target.value)}
              className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]">
              <option value="">Select DG Asset…</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Run Start</label>
              <input type="datetime-local" value={form.run_start} onChange={(e) => set("run_start", e.target.value)}
                required className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Run End</label>
              <input type="datetime-local" value={form.run_end} onChange={(e) => set("run_end", e.target.value)}
                className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["diesel_opening", "Diesel Opening (L)", "0.1"],
              ["diesel_closing", "Diesel Closing (L)", "0.1"],
              ["load_kw", "Load (kW)", "1"],
              ["frequency", "Frequency (Hz)", "0.1"],
              ["voltage", "Voltage (V)", "1"],
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

export function DGLogPage() {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.get<Asset[]>("/assets", { params: { type: "DG" } })
      .then((r) => setAssets(r.data))
      .catch(() => db.cachedAssets.where("type").equals("DG").toArray().then(setAssets));
  }, []);

  const { data: logs = [], isLoading } = useQuery<DGLog[]>({
    queryKey: ["dg-logs"],
    queryFn: () => api.get<DGLog[]>("/dg/logs").then((r) => r.data),
    enabled: online,
  });

  const { data: reconciliation } = useQuery<{ total_purchased_litres: number; total_consumed_litres: number; estimated_stock_litres: number }>({
    queryKey: ["dg-reconciliation"],
    queryFn: () => api.get("/dg/fuel-reconciliation").then((r) => r.data),
    enabled: online,
  });

  const pendingQueue = useLiveQuery(
    () => db.outbox.where("entity_type").equals("dg_log").reverse().limit(20).toArray(), []
  );

  const recent = [...logs].sort((a, b) => new Date(b.run_start).getTime() - new Date(a.run_start).getTime()).slice(0, 10);
  const last = recent[0];
  const totalConsumed = recent.reduce((sum, l) => sum + (l.diesel_consumed ?? 0), 0);

  const trendData = useMemo(() => {
    const days = recentDateLabels(logs.map((l) => l.run_start), 5);
    const grouped: Record<string, DGLog[]> = {};
    logs.forEach((log) => {
      const label = new Date(log.run_start).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(log);
    });
    return days.map((label) => {
      const group = grouped[label] ?? [];
      const consumed = group.reduce((sum, l) => sum + (l.diesel_consumed ?? 0), 0);
      const loadVals = group.map((l) => l.load_kw).filter((v) => v != null) as number[];
      return {
        date: label,
        diesel_consumed: group.length ? Math.round(consumed * 10) / 10 : null,
        load_kw: loadVals.length ? Math.round(loadVals.reduce((a, b) => a + b, 0) / loadVals.length) : null,
      };
    });
  }, [logs]);

  const stockColor = reconciliation
    ? reconciliation.estimated_stock_litres < 50 ? "text-red-600" : reconciliation.estimated_stock_litres < 150 ? "text-amber-600" : "text-green-700"
    : "text-gray-800";

  return (
    <div className="max-w-3xl mx-auto">
      {showForm && (
        <LogEntryModal
          assets={assets}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["dg-logs"] });
            qc.invalidateQueries({ queryKey: ["dg-reconciliation"] });
          }}
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">DG Operations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Diesel Generator — run logs & fuel tracking</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-brand text-white px-5 py-2.5 rounded-lg font-medium text-sm min-h-[44px] hover:bg-brand-dark">
          + Log Entry
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Est. Fuel Stock" value={reconciliation ? Math.round(reconciliation.estimated_stock_litres) : null} unit="L" color={stockColor} />
        <StatCard label="Total Purchased" value={reconciliation ? reconciliation.total_purchased_litres : null} unit="L" />
        <StatCard label="Total Consumed" value={reconciliation ? Math.round(reconciliation.total_consumed_litres * 10) / 10 : Math.round(totalConsumed * 10) / 10} unit="L" />
        <StatCard label="Last Load" value={last?.load_kw ?? null} unit="kW" />
      </div>

      {/* Trend charts */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <TrendChart
          title="Diesel Consumed — Last 5 Days"
          data={trendData}
          series={[{ key: "diesel_consumed", label: "Consumed (L)", color: "#d97706", type: "bar" }]}
          yUnit=" L"
          height={180}
        />
        <TrendChart
          title="Load kW — Last 5 Days"
          data={trendData}
          series={[{ key: "load_kw", label: "Avg Load (kW)", color: "#0d9488" }]}
          yUnit=" kW"
          height={180}
        />
      </div>

      {reconciliation && reconciliation.estimated_stock_litres < 50 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex gap-3 items-start">
          <span className="text-red-500 text-lg">⚠</span>
          <div>
            <p className="font-semibold text-red-700 text-sm">Low Fuel Alert</p>
            <p className="text-xs text-red-600 mt-0.5">
              Estimated stock at {Math.round(reconciliation.estimated_stock_litres)} L — refill recommended.
            </p>
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
          <h2 className="font-semibold text-gray-700">Recent Run Logs</h2>
          {isLoading && <span className="text-xs text-gray-400">Loading…</span>}
        </div>
        {recent.length === 0 && !isLoading ? (
          <div className="text-center text-gray-400 py-10 text-sm">No logs yet — tap "+ Log Entry" to record the first one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Run Start</th>
                  <th className="px-4 py-3 text-right">Duration</th>
                  <th className="px-4 py-3 text-right">Opening (L)</th>
                  <th className="px-4 py-3 text-right">Consumed (L)</th>
                  <th className="px-4 py-3 text-right">Load (kW)</th>
                  <th className="px-4 py-3 text-right">Voltage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map((log) => {
                  const durationHrs = log.run_end
                    ? ((new Date(log.run_end).getTime() - new Date(log.run_start).getTime()) / 3600000).toFixed(1)
                    : log.run_hours?.toFixed(1) ?? "—";
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{new Date(log.run_start).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">{new Date(log.run_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{durationHrs} hrs</td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.diesel_opening ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700">{log.diesel_consumed ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.load_kw ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.voltage ?? "—"}</td>
                    </tr>
                  );
                })}
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
