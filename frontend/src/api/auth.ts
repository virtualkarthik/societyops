import api from "./client";
import type { User } from "./types";

/** `identifier` is an email or a phone number. */
export async function login(identifier: string, password: string): Promise<string> {
  const res = await api.post<{ access_token: string }>("/auth/login", { login: identifier, password });
  return res.data.access_token;
}

export async function getMe(): Promise<User> {
  const res = await api.get<User>("/auth/me");
  return res.data;
}
