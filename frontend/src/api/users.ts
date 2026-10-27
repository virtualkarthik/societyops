import api from "./client";
import type { User, UserRole, UserWithPassword } from "./types";

export interface UserInput {
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
}

export const getUsers = () => api.get<User[]>("/users").then((r) => r.data);
export const createUser = (data: UserInput) => api.post<UserWithPassword>("/users", data).then((r) => r.data);
export const updateUser = (id: number, data: Partial<UserInput> & { is_active?: boolean }) =>
  api.patch<User>(`/users/${id}`, data).then((r) => r.data);
export const resetUserPassword = (id: number) =>
  api.post<UserWithPassword>(`/users/${id}/reset-password`).then((r) => r.data);
export const changeOwnPassword = (current_password: string | null, new_password: string) =>
  api.post("/auth/change-password", { current_password, new_password });

// FastAPI returns `detail` as a string for HTTPException and as a list for validation errors.
export function apiErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, "");
  return fallback;
}
