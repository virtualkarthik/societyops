import api from "./client";
import type { Block, Floor, CommonArea } from "./types";

export const getBlocks = () => api.get<Block[]>("/locations/blocks").then((r) => r.data);
export const createBlock = (data: Partial<Block>) => api.post<Block>("/locations/blocks", data).then((r) => r.data);

export const getFloors = (block_id?: number) =>
  api.get<Floor[]>("/locations/floors", { params: block_id ? { block_id } : {} }).then((r) => r.data);
export const createFloor = (data: Partial<Floor>) => api.post<Floor>("/locations/floors", data).then((r) => r.data);

export const getCommonAreas = () => api.get<CommonArea[]>("/locations/common-areas").then((r) => r.data);
export const createCommonArea = (data: Partial<CommonArea>) =>
  api.post<CommonArea>("/locations/common-areas", data).then((r) => r.data);
