import api from "./client";
import type { User } from "./types";

export async function login(email: string, password: string): Promise<string> {
  const res = await api.post<{ access_token: string }>("/auth/login", { email, password });
  return res.data.access_token;
}

export async function getMe(): Promise<User> {
  const res = await api.get<User>("/auth/me");
  return res.data;
}
