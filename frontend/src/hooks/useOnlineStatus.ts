import { useState, useEffect } from "react";
import { syncOutbox } from "../offline/sync";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const setOnlineTrue = () => {
      setOnline(true);
      // Trigger sync when coming back online
      syncOutbox().catch(console.error);
    };
    const setOnlineFalse = () => setOnline(false);

    window.addEventListener("online", setOnlineTrue);
    window.addEventListener("offline", setOnlineFalse);
    return () => {
      window.removeEventListener("online", setOnlineTrue);
      window.removeEventListener("offline", setOnlineFalse);
    };
  }, []);

  return online;
}
