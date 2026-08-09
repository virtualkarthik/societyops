import api from "./client";
import type { HousekeepingArea, HousekeepingSchedule, HousekeepingLog, HousekeepingToday } from "./types";

export const getHousekeepingAreas = () =>
  api.get<HousekeepingArea[]>("/housekeeping/areas").then((r) => r.data);

export const createHousekeepingArea = (data: Partial<HousekeepingArea>) =>
  api.post<HousekeepingArea>("/housekeeping/areas", data).then((r) => r.data);

export const updateHousekeepingArea = (id: number, data: Partial<HousekeepingArea>) =>
  api.patch<HousekeepingArea>(`/housekeeping/areas/${id}`, data).then((r) => r.data);

export const getHousekeepingSchedules = (area_id?: number) =>
  api.get<HousekeepingSchedule[]>("/housekeeping/schedules", { params: area_id ? { area_id } : {} }).then((r) => r.data);

export const createHousekeepingSchedule = (data: Partial<HousekeepingSchedule>) =>
  api.post<HousekeepingSchedule>("/housekeeping/schedules", data).then((r) => r.data);

export const updateHousekeepingSchedule = (id: number, data: Partial<HousekeepingSchedule>) =>
  api.patch<HousekeepingSchedule>(`/housekeeping/schedules/${id}`, data).then((r) => r.data);

export const getHousekeepingLogs = (params?: { area_id?: number; date_from?: string; date_to?: string }) =>
  api.get<HousekeepingLog[]>("/housekeeping/logs", { params }).then((r) => r.data);

export const createHousekeepingLog = (data: Partial<HousekeepingLog>) =>
  api.post<HousekeepingLog>("/housekeeping/logs", data).then((r) => r.data);

export const getHousekeepingToday = (for_date?: string) =>
  api.get<HousekeepingToday>("/housekeeping/today", { params: for_date ? { for_date } : {} }).then((r) => r.data);
