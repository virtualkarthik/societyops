import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  getHousekeepingAreas, createHousekeepingArea,
  getHousekeepingSchedules, createHousekeepingSchedule,
  getHousekeepingToday, createHousekeepingLog, getHousekeepingLogs,
} from "../../api/housekeeping";
import { getBlocks, createBlock, getFloors, createFloor, getCommonAreas, createCommonArea } from "../../api/locations";
import type { HousekeepingAreaType, HousekeepingActivityType, HousekeepingFrequency } from "../../api/types";

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
const FREQUENCIES: HousekeepingFrequency[] = ["DAILY", "ALTERNATE_DAYS", "WEEKLY", "FORTNIGHTLY", "CUSTOM_DAYS"];
const FREQUENCY_LABEL: Record<HousekeepingFrequency, string> = {
  DAILY: "Daily",
  ALTERNATE_DAYS: "Alternate Days",
  WEEKLY: "Weekly",
  FORTNIGHTLY: "Fortnightly",
  CUSTOM_DAYS: "Custom",
};

function PropertyStructurePanel() {
  const qc = useQueryClient();
  const { data: blocks = [] } = useQuery({ queryKey: ["blocks"], queryFn: getBlocks });
  const { data: floors = [] } = useQuery({ queryKey: ["floors"], queryFn: () => getFloors() });
  const { data: commonAreas = [] } = useQuery({ queryKey: ["common-areas"], queryFn: getCommonAreas });

  const [blockName, setBlockName] = useState("");
  const [floorBlockId, setFloorBlockId] = useState("");
  const [floorName, setFloorName] = useState("");
  const [caName, setCaName] = useState("");
  const [caBlockId, setCaBlockId] = useState("");

  const addBlock = useMutation({
    mutationFn: () => createBlock({ name: blockName }),
    onSuccess: () => { toast.success("Block added"); setBlockName(""); qc.invalidateQueries({ queryKey: ["blocks"] }); },
    onError: () => toast.error("Failed to add block"),
  });
  const addFloor = useMutation({
    mutationFn: () => createFloor({ block_id: Number(floorBlockId), name: floorName }),
    onSuccess: () => { toast.success("Floor added"); setFloorName(""); qc.invalidateQueries({ queryKey: ["floors"] }); },
    onError: () => toast.error("Failed to add floor"),
  });
  const addCommonArea = useMutation({
    mutationFn: () => createCommonArea({ name: caName, block_id: caBlockId ? Number(caBlockId) : null }),
    onSuccess: () => { toast.success("Common area added"); setCaName(""); setCaBlockId(""); qc.invalidateQueries({ queryKey: ["common-areas"] }); },
    onError: () => toast.error("Failed to add common area"),
  });

  const blockName2 = (id: number) => blocks.find((b) => b.id === id)?.name ?? `#${id}`;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 mb-6 space-y-6">
      <h2 className="font-semibold text-gray-700">Property Structure</h2>

      {/* Blocks */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Blocks</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {blocks.map((b) => (
            <span key={b.id} className="text-xs bg-brand-light text-brand px-2.5 py-1 rounded-full">{b.name}</span>
          ))}
          {blocks.length === 0 && <span className="text-xs text-gray-400">No blocks yet.</span>}
        </div>
        <div className="flex gap-2">
          <input type="text" value={blockName} onChange={(e) => setBlockName(e.target.value)}
            placeholder="e.g. Block A" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <button onClick={() => addBlock.mutate()} disabled={!blockName || addBlock.isPending}
            className="bg-brand text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60">+ Add</button>
        </div>
      </div>

      {/* Floors */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Floors</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {floors.map((f) => (
            <span key={f.id} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
              {blockName2(f.block_id)} — {f.name}
            </span>
          ))}
          {floors.length === 0 && <span className="text-xs text-gray-400">No floors yet.</span>}
        </div>
        <div className="flex gap-2">
          <select value={floorBlockId} onChange={(e) => setFloorBlockId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-36">
            <option value="">Block…</option>
            {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input type="text" value={floorName} onChange={(e) => setFloorName(e.target.value)}
            placeholder="e.g. 3rd Floor" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <button onClick={() => addFloor.mutate()} disabled={!floorName || !floorBlockId || addFloor.isPending}
            className="bg-brand text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60">+ Add</button>
        </div>
      </div>

      {/* Common Areas */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Common Areas</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {commonAreas.map((c) => (
            <span key={c.id} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
              {c.name}{c.block_id ? ` (${blockName2(c.block_id)})` : ""}
            </span>
          ))}
          {commonAreas.length === 0 && <span className="text-xs text-gray-400">No common areas yet.</span>}
        </div>
        <div className="flex gap-2">
          <input type="text" value={caName} onChange={(e) => setCaName(e.target.value)}
            placeholder="e.g. Main Garden, Clubhouse" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <select value={caBlockId} onChange={(e) => setCaBlockId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-40">
            <option value="">Society-wide</option>
            {blocks.map((b) => <option key={b.id} value={b.id}>{b.name} only</option>)}
          </select>
          <button onClick={() => addCommonArea.mutate()} disabled={!caName || addCommonArea.isPending}
            className="bg-brand text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60">+ Add</button>
        </div>
      </div>
    </div>
  );
}

function AddAreaForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: blocks = [] } = useQuery({ queryKey: ["blocks"], queryFn: getBlocks });
  const { data: floors = [] } = useQuery({ queryKey: ["floors"], queryFn: () => getFloors() });
  const { data: commonAreas = [] } = useQuery({ queryKey: ["common-areas"], queryFn: getCommonAreas });

  const [name, setName] = useState("");
  const [areaType, setAreaType] = useState<HousekeepingAreaType>("CORRIDOR");
  const [locationMode, setLocationMode] = useState<"block_floor" | "common_area" | "none">("block_floor");
  const [blockId, setBlockId] = useState("");
  const [floorId, setFloorId] = useState("");
  const [commonAreaId, setCommonAreaId] = useState("");

  const floorsForBlock = floors.filter((f) => String(f.block_id) === blockId);

  const mutation = useMutation({
    mutationFn: () => createHousekeepingArea({
      name, area_type: areaType,
      block_id: locationMode === "block_floor" && blockId ? Number(blockId) : null,
      floor_id: locationMode === "block_floor" && floorId ? Number(floorId) : null,
      common_area_id: locationMode === "common_area" && commonAreaId ? Number(commonAreaId) : null,
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
          placeholder="e.g. Ground Floor Corridor"
          className="w-full border rounded-lg px-3 py-2 text-sm" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select value={areaType} onChange={(e) => setAreaType(e.target.value as HousekeepingAreaType)}
          className="w-full border rounded-lg px-3 py-2 text-sm">
          {AREA_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
        <div className="flex gap-2 mb-2">
          {(["block_floor", "common_area", "none"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setLocationMode(m)}
              className={`text-xs px-3 py-1.5 rounded-full border ${locationMode === m ? "bg-brand text-white border-brand" : "text-gray-600 border-gray-300"}`}>
              {m === "block_floor" ? "Block + Floor" : m === "common_area" ? "Common Area" : "Unassigned"}
            </button>
          ))}
        </div>
        {locationMode === "block_floor" && (
          <div className="grid grid-cols-2 gap-3">
            <select value={blockId} onChange={(e) => { setBlockId(e.target.value); setFloorId(""); }}
              className="border rounded-lg px-3 py-2 text-sm">
              <option value="">Block…</option>
              {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={floorId} onChange={(e) => setFloorId(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" disabled={!blockId}>
              <option value="">Floor…</option>
              {floorsForBlock.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}
        {locationMode === "common_area" && (
          <select value={commonAreaId} onChange={(e) => setCommonAreaId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select common area…</option>
            {commonAreas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
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

function AddScheduleForm({ areaId, onClose }: { areaId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [activityType, setActivityType] = useState<HousekeepingActivityType>("DRY_SWEEPING");
  const [frequency, setFrequency] = useState<HousekeepingFrequency>("DAILY");
  const [customDays, setCustomDays] = useState("");

  const mutation = useMutation({
    mutationFn: () => createHousekeepingSchedule({
      area_id: areaId, activity_type: activityType, frequency,
      custom_interval_days: frequency === "CUSTOM_DAYS" ? Number(customDays) || 1 : null,
    }),
    onSuccess: () => {
      toast.success("Schedule added");
      qc.invalidateQueries({ queryKey: ["housekeeping-schedules"] });
      qc.invalidateQueries({ queryKey: ["housekeeping-today"] });
      onClose();
    },
    onError: () => toast.error("Failed to add schedule — this activity may already be scheduled for this area"),
  });

  return (
    <div className="bg-gray-50 border rounded-lg p-3 mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select value={activityType} onChange={(e) => setActivityType(e.target.value as HousekeepingActivityType)}
          className="border rounded-lg px-2 py-1.5 text-xs">
          {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{ACTIVITY_LABEL[a]}</option>)}
        </select>
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as HousekeepingFrequency)}
          className="border rounded-lg px-2 py-1.5 text-xs">
          {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
        </select>
      </div>
      {frequency === "CUSTOM_DAYS" && (
        <input type="number" min={1} value={customDays} onChange={(e) => setCustomDays(e.target.value)}
          placeholder="Every N days" className="w-full border rounded-lg px-2 py-1.5 text-xs" />
      )}
      <div className="flex gap-2">
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="bg-brand text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60">Save</button>
        <button onClick={onClose} className="border px-3 py-1.5 rounded-lg text-xs">Cancel</button>
      </div>
    </div>
  );
}

function AreaManagementRow({ areaId, areaName }: { areaId: number; areaName: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const { data: schedules = [] } = useQuery({
    queryKey: ["housekeeping-schedules", areaId],
    queryFn: () => getHousekeepingSchedules(areaId),
  });

  return (
    <div className="border rounded-lg p-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-800">{areaName}</span>
        <button onClick={() => setShowAdd((s) => !s)} className="text-xs text-brand underline">
          {showAdd ? "Close" : "+ Schedule"}
        </button>
      </div>
      {schedules.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {schedules.map((s) => (
            <span key={s.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              {ACTIVITY_LABEL[s.activity_type]} · {FREQUENCY_LABEL[s.frequency]}
              {s.frequency === "CUSTOM_DAYS" ? ` (${s.custom_interval_days}d)` : ""}
            </span>
          ))}
        </div>
      )}
      {showAdd && <AddScheduleForm areaId={areaId} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

export function HousekeepingPage() {
  const qc = useQueryClient();
  const [showAddArea, setShowAddArea] = useState(false);
  const [showManage, setShowManage] = useState(false);

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

  const areaName = useMemo(() => {
    const m = new Map(areas.map((a) => [a.id, a.name]));
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [areas]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Housekeeping</h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily/weekly cleaning checklist — sweeping, mopping, parking, rooms</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowManage((s) => !s)}
            className="border border-brand text-brand px-3 py-2 rounded-lg text-sm font-medium min-h-[44px]">
            {showManage ? "Hide Setup" : "Setup"}
          </button>
          <button onClick={() => setShowAddArea(true)}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium min-h-[44px]">
            + Add Area
          </button>
        </div>
      </div>

      {showManage && (
        <>
          <PropertyStructurePanel />
          <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
            <h2 className="font-semibold text-gray-700 mb-3">Areas & Schedules</h2>
            <div className="space-y-2">
              {areas.map((a) => <AreaManagementRow key={a.id} areaId={a.id} areaName={a.name} />)}
              {areas.length === 0 && <p className="text-sm text-gray-400">No areas yet — tap "+ Add Area" above.</p>}
            </div>
          </div>
        </>
      )}

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
            Nothing due today. Set up areas and schedules via "Setup" above.
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
                <span className="text-xs text-gray-400">{area.location_label} · {area.area_type.replace("_", " ")}</span>
              </div>
              {area.all_done && <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">✓ All done</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {area.activities.map((act) => (
                <button
                  key={act.schedule_id}
                  disabled={act.done || markDone.isPending}
                  onClick={() => markDone.mutate({ area_id: area.area_id, activity_type: act.activity_type })}
                  className={`text-xs px-3 py-2 rounded-lg font-medium min-h-[36px] ${
                    act.done
                      ? "bg-green-50 text-green-700 cursor-default"
                      : act.overdue
                      ? "bg-red-50 text-red-700 hover:bg-red-600 hover:text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-brand hover:text-white"
                  }`}
                  title={act.done && act.completed_by_name ? `Done by ${act.completed_by_name}` : "Tap to mark done"}
                >
                  {act.done ? "✓ " : act.overdue ? "⚠ " : ""}{ACTIVITY_LABEL[act.activity_type]}
                  <span className="opacity-60"> · {FREQUENCY_LABEL[act.frequency]}</span>
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
