import api from "./client";
import type { Asset, AssetAnomaly } from "./types";

export const getAssets = () => api.get<Asset[]>("/assets").then((r) => r.data);
export const getAsset = (id: number) => api.get<Asset>(`/assets/${id}`).then((r) => r.data);
export const getAssetAnomalies = () => api.get<AssetAnomaly[]>("/assets/anomalies").then((r) => r.data);
export const createAsset = (data: Partial<Asset>) => api.post<Asset>("/assets", data).then((r) => r.data);
export const updateAsset = (id: number, data: Partial<Asset>) => api.patch<Asset>(`/assets/${id}`, data).then((r) => r.data);
export const deleteAsset = (id: number) => api.delete(`/assets/${id}`);
export const getAssetQrUrl = (id: number) => `/api/v1/assets/${id}/qr.png`;
