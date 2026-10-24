import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBranding } from "../api/auth";
import { useAuth } from "./useAuth";

const CACHE_KEY = "society_name";

function readCache(): string | null {
  try { return localStorage.getItem(CACHE_KEY); } catch { return null; }
}

/**
 * The apartment's name: from the logged-in user when available, otherwise the
 * public branding endpoint (login screen). Cached so it still shows offline.
 */
export function useSocietyName(): string | null {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["branding"],
    queryFn: getBranding,
    enabled: !user,
    staleTime: 60 * 60 * 1000,
  });
  const name = user?.society_name ?? data?.society_name ?? readCache();

  useEffect(() => {
    if (!name) return;
    try { localStorage.setItem(CACHE_KEY, name); } catch { /* storage unavailable */ }
    document.title = `${name} · SocietyOps`;
    // iOS "Add to Home Screen" uses this as the app's label
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", name);
  }, [name]);

  return name;
}
