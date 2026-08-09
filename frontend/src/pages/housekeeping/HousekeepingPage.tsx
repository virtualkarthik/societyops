import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  getHousekeepingAreas, createHousekeepingArea,
  getHousekeepingToday, createHousekeepingLog, getHousekeepingLogs,
} from "../../api/housekeeping";
import type { HousekeepingAreaType, HousekeepingActivityType } from "../../api/types";

const AREA_TYPES: HousekeepingAreaType[] = [
  "CORRIDOR", "STAIRCASE", "LOBBY", "PARKING", "COMMON_ROOM", "CLUBHOUSE", "GARDEN", "TERRACE", "OTHER",
];
const ACTIVITY_TYPES: HousekeepingActivityType[] = [
  "DRY_SWEEPING", "WET_MOPPING", "PARKING_CLEANING", "ROOM_CLEANING",
  "GARBAGE_COLLECTION", "GLASS_CLEANING", "OTHER",
];
const ACTIVITY_LABEL: Record<HousekeepingActivityType, string> = {
  DRY_SWEEPING: "Dry Sweeping",
  WET_MOPPING: "Wet Mopping",
  PARKING_CLEANING: "Parking Cleaning",
  ROOM_CLEANING: "Room Cleaning",
  GARBAGE_COLLECTION: "Garbage Collection",
  GLASS_CLEANING: "Glass Cleaning",
  OTHER: "Other",
};

function AddAreaForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [areaType, setAreaType] = useState<HousekeepingAreaType>("CORRIDOR");
  const [location, setLocation] = useState("");
  const [activities, setActivities] = useState<HousekeepingActivityType[]>(["DRY_SWEEPING", "WET_MOPPING"]);

  const toggleActivity = (a: HousekeepingActivityType) =>
    setActivities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const mutation = useMutation({
    mutationFn: () => createHousekeepingArea({
      name, area_type: areaType, location: location || null, expected_activities: activities,
    }),
    onSuccess: () => {
      toast.success("Area added");
      qc.invalidateQueries({ queryKey: ["housekeeping-areas"] });
      qc.invalidateQueries({ queryKey: ["housekeeping-today"] });
      onClose();
    },
    onError: () => toast.error("Failed to add area"),
  });

  return (
    <div className="bg-white rounded-2xl shadow p-5 mb-6 space-y-4">
      <h2 className="font-semibold text-gray-700">New Area</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Block A Ground Floor Corridor"
          className="w-full border rounded-lg px-3 py-2 text-sm" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select value={areaType} onChange={(e) => setAreaType(e.target.value as HousekeepingAreaType)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            {AREA_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Expected daily activities</label>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_TYPES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleActivity(a)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                activities.includes(a) ? "bg-brand text-white border-brand" : "text-gray-600 border-gray-300"
              }`}
            >
              {ACTIVITY_LABEL[a]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          Create
        </button>
        <button onClick={onClose} className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
      </div>
    </div>
  );
}

export function HousekeepingPage() {
  const qc = useQueryClient();
  const [showAddArea, setShowAddArea] = useState(false);

  const { data: today, isLoading } = useQuery({
    queryKey: ["housekeeping-today"],
    queryFn: () => getHousekeepingToday(),
    refetchInterval: 60_000,
  });
  const { data: areas = [] } = useQuery({ queryKey: ["housekeeping-areas"], queryFn: getHousekeepingAreas });
  const { data: recentLogs = [] } = useQuery({ queryKey: ["housekeeping-logs"], queryFn: () => getHousekeepingLogs() });

  const markDone = useMutation({
    mutationFn: (vars: { area_id: number; activity_type: HousekeepingActivityType }) =>
      createHousekeepingLog({
        area_id: vars.area_id, activity_type: vars.activity_type,
        logged_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast.success("Marked done");
      qc.invalidateQueries({ queryKey: ["housekeeping-today"] });
      qc.invalidateQueries({ queryKey: ["housekeeping-logs"] });
    },
    onError: () => toast.error("Failed to log activity"),
  });

  const pct = today && today.total_expected > 0
    ? Math.round((today.total_done / today.total_expected) * 100)
    : null;

  const areaName = (id: number) => areas.find((a) => a.id === id)?.name ?? `#${id}`;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Housekeeping</h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily cleaning checklist — sweeping, mopping, parking, rooms</p>
        </div>
        <button onClick={() => setShowAddArea(true)}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium min-h-[44px]">
          + Add Area
        </button>
      </div>

      {showAddArea && <AddAreaForm onClose={() => setShowAddArea(false)} />}

      {/* Today's summary */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <div className="flex justify-between items-center mb-1">
          <h2 className="font-semibold text-gray-700">Today's Checklist</h2>
          {pct !== null && (
            <span className={`text-sm font-bold ${pct === 100 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
              {today!.total_done}/{today!.total_expected} done ({pct}%)
            </span>
          )}
        </div>
        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
        {!isLoading && today && today.areas.length === 0 && (
          <p className="text-sm text-gray-400 py-6 text-center">
            No areas set up yet — tap "+ Add Area" to start tracking daily cleaning.
          </p>
        )}
      </div>

      {/* Per-area checklists */}
      <div className="space-y-4 mb-6">
        {today?.areas.map((area) => (
          <div key={area.area_id} className={`bg-white rounded-xl shadow-sm p-4 ${area.all_done ? "" : "border-l-4 border-amber-400"}`}>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-semibold text-gray-800">{area.area_name}</h3>
                <span className="text-xs text-gray-400">{area.area_type.replace("_", " ")}</span>
              </div>
              {area.all_done && <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">✓ All done</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {area.activities.map((act) => (
                <button
                  key={act.activity_type}
                  disabled={act.done || markDone.isPending}
                  onClick={() => markDone.mutate({ area_id: area.area_id, activity_type: act.activity_type })}
                  className={`text-xs px-3 py-2 rounded-lg font-medium min-h-[36px] ${
                    act.done
                      ? "bg-green-50 text-green-700 cursor-default"
                      : "bg-gray-100 text-gray-700 hover:bg-brand hover:text-white"
                  }`}
                  title={act.done && act.completed_by_name ? `Done by ${act.completed_by_name}` : "Tap to mark done"}
                >
                  {act.done ? "✓ " : ""}{ACTIVITY_LABEL[act.activity_type]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity history */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-700">Recent Activity</h2>
        </div>
        {recentLogs.length === 0 ? (
          <div className="text-center text-gray-400 py-10 text-sm">No activity logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date/Time</th>
                  <th className="px-4 py-3 text-left">Area</th>
                  <th className="px-4 py-3 text-left">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentLogs.slice(0, 30).map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{new Date(log.logged_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-800">{areaName(log.area_id)}</td>
                    <td className="px-4 py-3 text-gray-600">{ACTIVITY_LABEL[log.activity_type]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
