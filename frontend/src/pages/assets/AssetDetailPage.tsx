import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getAsset, updateAsset, getAssetAnomalies } from "../../api/assets";
import type { Asset } from "../../api/types";
import { ServiceLogPage } from "../operator/ServiceLogPage";

type EditForm = {
  name: string;
  location: string;
  make: string;
  model: string;
  serial_number: string;
  capacity_value: string;
  capacity_unit: string;
  install_date: string;
  warranty_expiry: string;
  purchase_date: string;
  purchase_cost: string;
  purchased_from: string;
  amc_vendor: string;
  amc_expiry: string;
  notes: string;
};

function toForm(asset: Asset): EditForm {
  return {
    name: asset.name,
    location: asset.location ?? "",
    make: asset.make ?? "",
    model: asset.model ?? "",
    serial_number: asset.serial_number ?? "",
    capacity_value: asset.capacity_value != null ? String(asset.capacity_value) : "",
    capacity_unit: asset.capacity_unit ?? "",
    install_date: asset.install_date ?? "",
    warranty_expiry: asset.warranty_expiry ?? "",
    purchase_date: asset.purchase_date ?? "",
    purchase_cost: asset.purchase_cost != null ? String(asset.purchase_cost) : "",
    purchased_from: asset.purchased_from ?? "",
    amc_vendor: asset.amc_vendor ?? "",
    amc_expiry: asset.amc_expiry ?? "",
    notes: asset.notes ?? "",
  };
}

const FIELD_LABELS: Record<keyof EditForm, string> = {
  name: "Name",
  location: "Location",
  make: "Make",
  model: "Model",
  serial_number: "Serial Number",
  capacity_value: "Capacity",
  capacity_unit: "Capacity Unit",
  install_date: "Install Date",
  warranty_expiry: "Warranty Expiry",
  purchase_date: "Purchase Date",
  purchase_cost: "Purchase Cost (₹)",
  purchased_from: "Purchased From",
  amc_vendor: "AMC Vendor",
  amc_expiry: "AMC Expiry",
  notes: "Notes",
};

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-800 mt-0.5">{value || "—"}</dd>
    </div>
  );
}

function EditAssetForm({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<EditForm>(toForm(asset));
  const set = (k: keyof EditForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () =>
      updateAsset(asset.id, {
        name: form.name,
        location: form.location || null,
        make: form.make || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        capacity_value: form.capacity_value ? Number(form.capacity_value) : null,
        capacity_unit: form.capacity_unit || null,
        install_date: form.install_date || null,
        warranty_expiry: form.warranty_expiry || null,
        purchase_date: form.purchase_date || null,
        purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
        purchased_from: form.purchased_from || null,
        amc_vendor: form.amc_vendor || null,
        amc_expiry: form.amc_expiry || null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      toast.success("Asset updated");
      qc.invalidateQueries({ queryKey: ["asset", String(asset.id)] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      onClose();
    },
    onError: () => toast.error("Failed to update asset"),
  });

  const dateFields: (keyof EditForm)[] = ["install_date", "warranty_expiry", "purchase_date", "amc_expiry"];
  const textFields = (Object.keys(FIELD_LABELS) as (keyof EditForm)[]).filter(
    (k) => !dateFields.includes(k) && k !== "notes"
  );

  return (
    <div className="bg-white rounded-2xl shadow p-5 mb-6 space-y-4">
      <h2 className="font-semibold text-gray-700">Edit Asset</h2>
      <div className="grid grid-cols-2 gap-3">
        {textFields.map((k) => (
          <div key={k}>
            <label className="block text-xs font-medium text-gray-700 mb-1">{FIELD_LABELS[k]}</label>
            <input
              type={k === "capacity_value" || k === "purchase_cost" ? "number" : "text"}
              value={form[k]}
              onChange={(e) => set(k, e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        ))}
        {dateFields.map((k) => (
          <div key={k}>
            <label className="block text-xs font-medium text-gray-700 mb-1">{FIELD_LABELS[k]}</label>
            <input
              type="date"
              value={form[k]}
              onChange={(e) => set(k, e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.name}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
        >
          Save
        </button>
        <button onClick={onClose} className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
      </div>
    </div>
  );
}

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const { data: asset, isLoading } = useQuery({
    queryKey: ["asset", id],
    queryFn: () => getAsset(Number(id)),
    enabled: !!id,
  });
  const { data: anomalies = [] } = useQuery({ queryKey: ["asset-anomalies"], queryFn: getAssetAnomalies });
  const anomaly = anomalies.find((a) => a.asset_id === Number(id));

  if (isLoading) return <div className="text-center text-gray-400 py-10">Loading asset…</div>;
  if (!asset) return <div className="text-center text-gray-400 py-10">Asset not found.</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/assets" className="text-sm text-brand hover:underline">← Back to Assets</Link>

      {anomaly && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-3 flex gap-3 items-start">
          <span className="text-red-500 text-lg">⚠</span>
          <div>
            <p className="font-semibold text-red-700 text-sm">Abnormal activity detected</p>
            <p className="text-xs text-red-600 mt-0.5">
              {anomaly.event_count} repair/breakdown service records in the last {anomaly.window_days} days
              {anomaly.last_event_date ? ` — most recent on ${anomaly.last_event_date}` : ""}. This asset may need
              root-cause investigation rather than repeat fixes.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mt-3 mb-6">
        <div>
          <span className="text-xs font-semibold text-brand bg-brand-light px-2 py-0.5 rounded-full">
            {asset.type}
          </span>
          {!asset.is_active && (
            <span className="ml-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
          )}
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{asset.name}</h1>
          {asset.location && <p className="text-sm text-gray-500 mt-0.5">📍 {asset.location}</p>}
        </div>
        <div className="flex gap-2">
          <Link
            to={`/assets/${asset.id}/log`}
            className="border border-brand text-brand px-3 py-2 rounded-lg text-sm font-medium min-h-[40px] flex items-center"
          >
            Quick Log
          </Link>
          <button
            onClick={() => setEditing((e) => !e)}
            className="bg-brand text-white px-3 py-2 rounded-lg text-sm font-medium min-h-[40px]"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {editing && <EditAssetForm asset={asset} onClose={() => setEditing(false)} />}

      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Asset Details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <DetailRow label="Make" value={asset.make} />
          <DetailRow label="Model" value={asset.model} />
          <DetailRow label="Serial Number" value={asset.serial_number} />
          <DetailRow
            label="Capacity"
            value={asset.capacity_value != null ? `${asset.capacity_value} ${asset.capacity_unit ?? ""}`.trim() : null}
          />
          <DetailRow label="Install Date" value={asset.install_date} />
          <DetailRow label="Warranty Expiry" value={asset.warranty_expiry} />
          <DetailRow label="Purchase Date" value={asset.purchase_date} />
          <DetailRow
            label="Purchase Cost"
            value={asset.purchase_cost != null ? `₹${asset.purchase_cost}` : null}
          />
          <DetailRow label="Purchased From" value={asset.purchased_from} />
          <DetailRow label="AMC Vendor" value={asset.amc_vendor} />
          <DetailRow label="AMC Expiry" value={asset.amc_expiry} />
        </dl>
        {asset.notes && (
          <div className="mt-4 pt-4 border-t">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Notes</dt>
            <dd className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{asset.notes}</dd>
          </div>
        )}
      </div>

      <ServiceLogPage fixedAssetId={asset.id} />
    </div>
  );
}
