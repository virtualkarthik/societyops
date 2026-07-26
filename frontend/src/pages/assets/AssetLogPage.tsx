import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAsset } from "../../api/assets";
import { STPLogPage } from "../operator/STPLogPage";
import { WaterLogPage } from "../operator/WaterLogPage";
import { DGLogPage } from "../operator/DGLogPage";
import { ServiceLogPage } from "../operator/ServiceLogPage";

export function AssetLogPage() {
  const { id } = useParams<{ id: string }>();
  const { data: asset } = useQuery({ queryKey: ["asset", id], queryFn: () => getAsset(Number(id)) });

  if (!asset) return <div className="text-center text-gray-400 py-10">Loading asset…</div>;

  return (
    <div>
      <div className="mb-4 bg-brand-light rounded-xl p-4">
        <span className="text-xs font-semibold text-brand">{asset.type}</span>
        <h2 className="text-lg font-bold text-gray-800">{asset.name}</h2>
        {asset.location && <p className="text-sm text-gray-500">📍 {asset.location}</p>}
      </div>
      {["STP"].includes(asset.type) && <STPLogPage />}
      {["BOREWELL", "SUMP", "OHT", "WATER_METER"].includes(asset.type) && <WaterLogPage />}
      {["DG"].includes(asset.type) && <DGLogPage />}
      <div className="mt-6">
        <ServiceLogPage fixedAssetId={asset.id} />
      </div>
    </div>
  );
}
