import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../api/client";

type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

interface Complaint {
  id: number;
  society_id: number;
  asset_id: number | null;
  raised_by: number | null;
  category: string | null;
  description: string;
  status: ComplaintStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
}

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
};

const CATEGORIES = ["PLUMBING", "ELECTRICAL", "LIFT", "SECURITY", "CLEANLINESS", "NOISE", "PARKING", "WATER", "OTHER"];

function NewComplaintModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ category: "PLUMBING", description: "" });

  const mutation = useMutation({
    mutationFn: () => api.post<Complaint>("/complaints", {
      category: form.category,
      description: form.description,
    }),
    onSuccess: () => {
      toast.success("Complaint raised");
      qc.invalidateQueries({ queryKey: ["complaints"] });
      onClose();
    },
    onError: () => toast.error("Failed to raise complaint"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-4 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Raise Complaint</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2.5 text-base">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4} placeholder="Describe the issue in detail…"
              className="w-full border rounded-lg px-3 py-2 text-base resize-none" />
          </div>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.description.trim()}
            className="w-full bg-brand text-white font-semibold py-3 rounded-xl text-base disabled:opacity-60">
            {mutation.isPending ? "Raising…" : "Raise Complaint"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResolveModal({ complaint, onClose }: { complaint: Complaint; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status === "OPEN" ? "IN_PROGRESS" : "RESOLVED");
  const [notes, setNotes] = useState(complaint.resolution_notes ?? "");

  const mutation = useMutation({
    mutationFn: () => api.patch(`/complaints/${complaint.id}`, { status, resolution_notes: notes || null }),
    onSuccess: () => {
      toast.success("Complaint updated");
      qc.invalidateQueries({ queryKey: ["complaints"] });
      onClose();
    },
    onError: () => toast.error("Failed to update"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-4 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-gray-800">Update Complaint</h2>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{complaint.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
            <div className="flex gap-2">
              {(["OPEN", "IN_PROGRESS", "RESOLVED"] as ComplaintStatus[]).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${status === s ? STATUS_COLORS[s] + " border-current" : "bg-white text-gray-500 border-gray-200"}`}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Add notes on action taken…"
              className="w-full border rounded-lg px-3 py-2 text-base resize-none" />
          </div>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="w-full bg-brand text-white font-semibold py-3 rounded-xl text-base disabled:opacity-60">
            {mutation.isPending ? "Saving…" : "Save Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ComplaintsPage() {
  const [showNew, setShowNew] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<Complaint | null>(null);
  const [filter, setFilter] = useState<"ALL" | ComplaintStatus>("ALL");

  const { data: complaints = [], isLoading } = useQuery<Complaint[]>({
    queryKey: ["complaints"],
    queryFn: () => api.get<Complaint[]>("/complaints").then((r) => r.data),
  });

  const sorted = [...complaints].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const filtered = filter === "ALL" ? sorted : sorted.filter((c) => c.status === filter);

  const openCount = complaints.filter((c) => c.status === "OPEN").length;
  const inProgressCount = complaints.filter((c) => c.status === "IN_PROGRESS").length;
  const resolvedCount = complaints.filter((c) => c.status === "RESOLVED").length;

  const avgResolutionDays = (() => {
    const resolved = complaints.filter((c) => c.status === "RESOLVED" && c.resolved_at);
    if (!resolved.length) return null;
    const avg = resolved.reduce((sum, c) => {
      return sum + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()) / 86400000;
    }, 0) / resolved.length;
    return Math.round(avg * 10) / 10;
  })();

  return (
    <div className="max-w-3xl mx-auto">
      {showNew && <NewComplaintModal onClose={() => setShowNew(false)} />}
      {updateTarget && <ResolveModal complaint={updateTarget} onClose={() => setUpdateTarget(null)} />}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Complaints</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resident & staff issue tracker</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="bg-brand text-white px-5 py-2.5 rounded-lg font-medium text-sm min-h-[44px] hover:bg-brand-dark">
          + Raise Complaint
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Open</p>
          <p className={`text-2xl font-bold ${openCount > 0 ? "text-red-600" : "text-green-700"}`}>{openCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">In Progress</p>
          <p className={`text-2xl font-bold ${inProgressCount > 0 ? "text-amber-600" : "text-gray-800"}`}>{inProgressCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Resolved</p>
          <p className="text-2xl font-bold text-green-700">{resolvedCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Avg Resolution</p>
          <p className="text-2xl font-bold text-gray-800">{avgResolutionDays != null ? `${avgResolutionDays}d` : "—"}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {([["ALL", `All (${complaints.length})`], ["OPEN", `Open (${openCount})`], ["IN_PROGRESS", `In Progress (${inProgressCount})`], ["RESOLVED", `Resolved (${resolvedCount})`]] as [string, string][]).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f as typeof filter)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? "bg-brand text-white" : "bg-white text-gray-600 border hover:bg-gray-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Complaints list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading && <div className="text-center text-gray-400 py-12 text-sm">Loading…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center text-gray-400 py-12 text-sm">
            <p className="text-3xl mb-2">✅</p>
            <p>{filter === "ALL" ? "No complaints yet." : `No ${STATUS_LABELS[filter as ComplaintStatus] ?? filter.toLowerCase()} complaints.`}</p>
          </div>
        )}
        <div className="divide-y divide-gray-100">
          {filtered.map((c) => (
            <div key={c.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                    {c.category && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.category}</span>
                    )}
                    <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-800">{c.description}</p>
                  {c.resolution_notes && (
                    <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1">
                      <span className="font-medium">Resolution:</span> {c.resolution_notes}
                    </p>
                  )}
                  {c.resolved_at && (
                    <p className="text-xs text-gray-400 mt-1">Resolved: {new Date(c.resolved_at).toLocaleDateString()}</p>
                  )}
                </div>
                {c.status !== "RESOLVED" && (
                  <button onClick={() => setUpdateTarget(c)}
                    className="shrink-0 border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50">
                    Update
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
