import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import toast from "react-hot-toast";
import type { OutboxEntry, PPMTask, PPMCompletion } from "../../api/types";
import api from "../../api/client";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { queueEntry, syncOutbox } from "../../offline/sync";
import { db } from "../../offline/db";
import { generateUUID } from "../../lib/uuid";
import { recentDateLabels } from "../../lib/trend";
import { SyncStatusBadge } from "../../components/SyncStatusBadge";
import { TrendChart } from "../../components/TrendChart";

function dueBadge(task: PPMTask) {
  if (!task.next_due) return null;
  const days = Math.ceil((new Date(task.next_due).getTime() - Date.now()) / 86400000);
  if (days < 0) return <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{Math.abs(days)}d overdue</span>;
  if (days <= 7) return <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">due in {days}d</span>;
  return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">due {new Date(task.next_due).toLocaleDateString()}</span>;
}

function LogCompletionModal({ task, onClose, onSuccess }: {
  task: PPMTask;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    Object.fromEntries((task.checklist_json ?? []).map((item) => [item, false]))
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [completedAt, setCompletedAt] = useState(new Date().toISOString().slice(0, 16));
  const [submitting, setSubmitting] = useState(false);

  const captureGPS = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); toast.success("GPS captured"); },
      () => toast.error("GPS unavailable")
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo && online) { toast.error("Proof photo required"); return; }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      task_id: task.id,
      completed_at: new Date(completedAt).toISOString(),
      checklist_result_json: checklist,
      geo_lat: gpsCoords?.lat ?? null,
      geo_lng: gpsCoords?.lng ?? null,
      notes: notes || null,
      proof_photos_json: [],
    };
    try {
      if (online) {
        payload.client_uuid = generateUUID();
        await api.post("/ppm/completions", payload);
        toast.success("PPM completion recorded");
        await syncOutbox();
      } else {
        await queueEntry("ppm_completion", payload, photo ? [{ field: "proof_photo", blob: photo, name: photo.name }] : []);
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
          <div>
            <h2 className="font-semibold text-gray-800">Log Completion</h2>
            <p className="text-xs text-gray-500 mt-0.5">{task.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Completed At</label>
            <input type="datetime-local" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)}
              className="w-full border rounded-lg px-3 py-3 text-base min-h-[44px]" />
          </div>

          {task.checklist_json && task.checklist_json.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("ppm.checklist")}</label>
              <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                {task.checklist_json.map((item) => (
                  <label key={item} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!checklist[item]}
                      onChange={(e) => setChecklist((c) => ({ ...c, [item]: e.target.checked }))}
                      className="w-5 h-5 rounded accent-brand" />
                    <span className="text-sm">{item}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {Object.values(checklist).filter(Boolean).length} / {task.checklist_json.length} items checked
              </p>
            </div>
          )}

          <button type="button" onClick={captureGPS}
            className="w-full border border-brand text-brand font-medium py-2.5 rounded-lg min-h-[44px] text-sm">
            {gpsCoords ? `✓ GPS: ${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}` : t("ppm.gps")}
          </button>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("ppm.proof_photo")} {online && <span className="text-red-500">*</span>}</label>
            <input type="file" accept="image/*" capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              className="w-full text-sm" required={online} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-base" />
          </div>

          <button type="submit" disabled={submitting}
            className="w-full bg-brand text-white font-semibold py-3 rounded-xl text-base min-h-[52px] disabled:opacity-60">
            {submitting ? "Submitting…" : "Record Completion"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function PPMCompletionPage() {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<PPMTask | null>(null);
  const [filter, setFilter] = useState<"all" | "overdue" | "upcoming">("all");

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<PPMTask[]>({
    queryKey: ["ppm-tasks"],
    queryFn: () => api.get<PPMTask[]>("/ppm/tasks").then((r) => r.data),
  });

  const { data: completions = [] } = useQuery<PPMCompletion[]>({
    queryKey: ["ppm-completions"],
    queryFn: () => api.get<PPMCompletion[]>("/ppm/completions").then((r) => r.data),
    enabled: online,
  });

  const pendingQueue = useLiveQuery(
    () => db.outbox.where("entity_type").equals("ppm_completion").reverse().limit(20).toArray(), []
  );

  const now = Date.now();
  const overdueCount = tasks.filter((t) => t.next_due && new Date(t.next_due).getTime() < now).length;
  const dueThisWeek = tasks.filter((t) => {
    if (!t.next_due) return false;
    const d = new Date(t.next_due).getTime() - now;
    return d >= 0 && d <= 7 * 86400000;
  }).length;

  const completionsThisMonth = completions.filter((c) => {
    const d = new Date(c.completed_at);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  const trendData = useMemo(() => {
    const days = recentDateLabels(completions.map((c) => c.completed_at), 5);
    const counts: Record<string, number> = {};
    completions.forEach((c) => {
      const label = new Date(c.completed_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      counts[label] = (counts[label] ?? 0) + 1;
    });
    return days.map((label) => ({ date: label, completions: counts[label] ?? 0 }));
  }, [completions]);

  const lastCompletedIds = new Map<number, string>();
  [...completions].sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    .forEach((c) => { if (!lastCompletedIds.has(c.task_id)) lastCompletedIds.set(c.task_id, c.completed_at); });

  const filtered = tasks.filter((t) => {
    if (filter === "overdue") return t.next_due && new Date(t.next_due).getTime() < now;
    if (filter === "upcoming") {
      if (!t.next_due) return false;
      const d = new Date(t.next_due).getTime() - now;
      return d >= 0 && d <= 30 * 86400000;
    }
    return true;
  }).sort((a, b) => {
    if (!a.next_due) return 1;
    if (!b.next_due) return -1;
    return new Date(a.next_due).getTime() - new Date(b.next_due).getTime();
  });

  return (
    <div className="max-w-3xl mx-auto">
      {selectedTask && (
        <LogCompletionModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["ppm-tasks"] });
            qc.invalidateQueries({ queryKey: ["ppm-completions"] });
          }}
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">PPM / Maintenance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Planned preventive maintenance schedule</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Overdue</p>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-600" : "text-green-700"}`}>{overdueCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Due This Week</p>
          <p className={`text-2xl font-bold ${dueThisWeek > 0 ? "text-amber-600" : "text-gray-800"}`}>{dueThisWeek}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Done This Month</p>
          <p className="text-2xl font-bold text-gray-800">{completionsThisMonth}</p>
        </div>
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <TrendChart
          title="Completions — Last 5 Days"
          data={trendData}
          series={[{ key: "completions", label: "Tasks Completed", color: "#0d9488", type: "bar" }]}
          height={180}
        />
      </div>

      {pendingQueue && pendingQueue.filter((e) => e.status === "pending").length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-center gap-2">
          <span className="text-amber-500">📶</span>
          <span className="text-sm text-amber-700">
            {pendingQueue.filter((e) => e.status === "pending").length} completions pending sync
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "overdue", "upcoming"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? "bg-brand text-white" : "bg-white text-gray-600 border hover:bg-gray-50"}`}>
            {f === "all" ? `All (${tasks.length})` : f === "overdue" ? `Overdue (${overdueCount})` : `Upcoming (${dueThisWeek})`}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        {tasksLoading && <div className="text-center text-gray-400 py-10 text-sm">Loading tasks…</div>}
        {!tasksLoading && filtered.length === 0 && (
          <div className="text-center text-gray-400 py-10 text-sm">No tasks in this filter.</div>
        )}
        <div className="divide-y divide-gray-100">
          {filtered.map((task) => {
            const lastDone = lastCompletedIds.get(task.id);
            const isOverdue = task.next_due && new Date(task.next_due).getTime() < now;
            return (
              <div key={task.id} className={`px-5 py-4 flex items-start justify-between gap-3 ${isOverdue ? "bg-red-50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800 text-sm">{task.title}</span>
                    {task.is_statutory && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Statutory</span>
                    )}
                    {dueBadge(task)}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {task.frequency}{task.custom_interval_days ? ` (${task.custom_interval_days}d)` : ""}
                    {task.category ? ` · ${task.category}` : ""}
                    {lastDone ? ` · Last done: ${new Date(lastDone).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTask(task)}
                  className="shrink-0 bg-brand text-white text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] hover:bg-brand-dark">
                  Log
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent completions */}
      {completions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-700">Recent Completions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Task</th>
                  <th className="px-4 py-3 text-left">Completed</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...completions]
                  .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
                  .slice(0, 10)
                  .map((c) => {
                    const task = tasks.find((t) => t.id === c.task_id);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{task?.title ?? `Task #${c.task_id}`}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(c.completed_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[180px] truncate">{c.notes ?? "—"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
