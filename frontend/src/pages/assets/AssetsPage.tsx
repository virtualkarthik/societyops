import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getAssets, createAsset } from "../../api/assets";
import api from "../../api/client";
import type { AssetType } from "../../api/types";

const ASSET_TYPES: AssetType[] = ["STP","BOREWELL","SUMP","OHT","DG","LIFT","FIRE","PUMP","TRANSFORMER","SOLAR","WATER_METER","OTHER"];

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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "STP" as AssetType, name: "", location: "", make: "", model: "" });
  const [qrModal, setQrModal] = useState<{ id: number; name: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createAsset(form),
    onSuccess: () => {
      toast.success("Asset created");
      qc.invalidateQueries({ queryKey: ["assets"] });
      setShowForm(false);
      setForm({ type: "STP", name: "", location: "", make: "", model: "" });
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
          {(["name", "location", "make", "model"] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{field}</label>
              <input type="text" value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required={field === "name"} />
            </div>
          ))}
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

      {isLoading && <div className="text-center text-gray-400 py-10">Loading…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {assets.map((asset) => (
          <div key={asset.id} className="bg-white rounded-xl shadow-sm p-4">
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
                onClick={() => setQrModal({ id: asset.id, name: asset.name })}
                className="text-xs text-brand underline hover:text-brand-dark"
              >
                QR
              </button>
            </div>
            <h3 className="font-semibold text-gray-800 mt-1">{asset.name}</h3>
            {asset.location && <p className="text-xs text-gray-500 mt-0.5">📍 {asset.location}</p>}
            {asset.make && <p className="text-xs text-gray-400">{asset.make} {asset.model}</p>}
            {asset.amc_expiry && (
              <p className="text-xs mt-1">
                AMC expires: <span className={new Date(asset.amc_expiry) < new Date() ? "text-red-600" : "text-gray-600"}>
                  {asset.amc_expiry}
                </span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
