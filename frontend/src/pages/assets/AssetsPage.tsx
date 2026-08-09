import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getAssets, createAsset, getAssetAnomalies } from "../../api/assets";
import api from "../../api/client";
import type { AssetType } from "../../api/types";

const ASSET_TYPES: AssetType[] = ["STP","BOREWELL","SUMP","OHT","DG","LIFT","FIRE","PUMP","TRANSFORMER","SOLAR","WATER_METER","LAMP_POST","OTHER"];
type StatusFilter = "all" | "active" | "inactive";

function QRModal({ assetId, assetName, onClose }: { assetId: number; assetName: string; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useState(() => {
    api.get(`/assets/${assetId}/qr.png`, { responseType: "blob" })
      .then((r) => setQrUrl(URL.createObjectURL(r.data)))
      .catch(() => setError(true));
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold text-gray-800 mb-1">{assetName}</h2>
        <p className="text-xs text-gray-500 mb-4">Scan to log operations for this asset</p>
        {error && <p className="text-red-500 text-sm">Failed to load QR code</p>}
        {!qrUrl && !error && <div className="w-48 h-48 mx-auto bg-gray-100 rounded animate-pulse" />}
        {qrUrl && (
          <>
            <img src={qrUrl} alt={`QR code for ${assetName}`} className="w-48 h-48 mx-auto border rounded" />
            <a
              href={qrUrl}
              download={`qr-${assetName.replace(/\s+/g, '-')}.png`}
              className="mt-3 inline-block text-sm text-brand underline"
            >
              Download PNG
            </a>
          </>
        )}
        <button onClick={onClose} className="mt-4 w-full border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
          Close
        </button>
      </div>
    </div>
  );
}

export function AssetsPage() {
  const qc = useQueryClient();
  const { data: assets = [], isLoading } = useQuery({ queryKey: ["assets"], queryFn: getAssets });
  const { data: anomalies = [] } = useQuery({ queryKey: ["asset-anomalies"], queryFn: getAssetAnomalies });
  const anomalyByAsset = useMemo(() => new Map(anomalies.map((a) => [a.asset_id, a])), [anomalies]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: "STP" as AssetType,
    name: "",
    location: "",
    make: "",
    model: "",
    serial_number: "",
    purchase_date: "",
    purchase_cost: "",
    purchased_from: "",
  });
  const [qrModal, setQrModal] = useState<{ id: number; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (statusFilter === "active" && !a.is_active) return false;
      if (statusFilter === "inactive" && a.is_active) return false;
      if (q) {
        const haystack = [a.name, a.location, a.make, a.model, a.serial_number]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [assets, search, typeFilter, statusFilter]);

  const createMutation = useMutation({
    mutationFn: () =>
      createAsset({
        type: form.type,
        name: form.name,
        location: form.location || null,
        make: form.make || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        purchase_date: form.purchase_date || null,
        purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
        purchased_from: form.purchased_from || null,
      }),
    onSuccess: () => {
      toast.success("Asset created");
      qc.invalidateQueries({ queryKey: ["assets"] });
      setShowForm(false);
      setForm({
        type: "STP", name: "", location: "", make: "", model: "",
        serial_number: "", purchase_date: "", purchase_cost: "", purchased_from: "",
      });
    },
    onError: () => toast.error("Failed to create asset"),
  });

  return (
    <div>
      {qrModal && (
        <QRModal assetId={qrModal.id} assetName={qrModal.name} onClose={() => setQrModal(null)} />
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Asset Registry</h1>
        <button onClick={() => setShowForm(true)}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium min-h-[44px]">
          + Add Asset
        </button>
      </div>

      {anomalies.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-500">⚠</span>
            <h2 className="font-semibold text-red-700 text-sm">
              {anomalies.length} Asset{anomalies.length > 1 ? "s" : ""} With Abnormal Activity
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {anomalies.map((a) => (
              <Link
                key={a.asset_id}
                to={`/assets/${a.asset_id}`}
                className="flex justify-between items-center bg-white border border-red-100 rounded-lg px-3 py-2 text-sm hover:border-red-300 transition-colors"
              >
                <span className="text-gray-800 truncate mr-2">{a.asset_name}</span>
                <span className="text-red-600 text-xs font-medium whitespace-nowrap">
                  {a.event_count} in {a.window_days}d
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl shadow p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-700">New Asset</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AssetType }))}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {(["name", "location", "make", "model", "serial_number", "purchased_from"] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{field.replace("_", " ")}</label>
              <input type="text" value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required={field === "name"} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Cost (₹)</label>
              <input type="number" value={form.purchase_cost} onChange={(e) => setForm((f) => ({ ...f, purchase_cost: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.name}
              className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
              Create
            </button>
            <button onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, location, make, model, serial…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm min-h-[40px]"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AssetType | "all")}
          className="border rounded-lg px-3 py-2 text-sm min-h-[40px] sm:w-44"
        >
          <option value="all">All Types</option>
          {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="border rounded-lg px-3 py-2 text-sm min-h-[40px] sm:w-36"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {isLoading && <div className="text-center text-gray-400 py-10">Loading…</div>}

      {!isLoading && filteredAssets.length === 0 && (
        <div className="text-center text-gray-400 py-10 text-sm">
          {assets.length === 0 ? 'No assets yet — tap "+ Add Asset" to create one.' : "No assets match your search/filters."}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredAssets.map((asset) => {
          const anomaly = anomalyByAsset.get(asset.id);
          return (
            <Link
              key={asset.id}
              to={`/assets/${asset.id}`}
              className={`block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer ${anomaly ? "ring-1 ring-red-300" : ""}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-xs font-semibold text-brand bg-brand-light px-2 py-0.5 rounded-full">
                    {asset.type}
                  </span>
                  {!asset.is_active && (
                    <span className="ml-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQrModal({ id: asset.id, name: asset.name }); }}
                  className="text-xs text-brand underline hover:text-brand-dark"
                >
                  QR
                </button>
              </div>
              <h3 className="font-semibold text-gray-800 mt-1">{asset.name}</h3>
              {asset.location && <p className="text-xs text-gray-500 mt-0.5">📍 {asset.location}</p>}
              {asset.make && <p className="text-xs text-gray-400">{asset.make} {asset.model}</p>}
              {asset.serial_number && <p className="text-xs text-gray-400">S/N: {asset.serial_number}</p>}
              {asset.amc_expiry && (
                <p className="text-xs mt-1">
                  AMC expires: <span className={new Date(asset.amc_expiry) < new Date() ? "text-red-600" : "text-gray-600"}>
                    {asset.amc_expiry}
                  </span>
                </p>
              )}
              {anomaly && (
                <p className="text-xs font-medium text-red-600 bg-red-50 mt-2 px-2 py-1 rounded-lg">
                  ⚠ {anomaly.event_count} repairs/breakdowns in {anomaly.window_days}d — anomaly
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
