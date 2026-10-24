import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { syncOutbox, retryFailed } from "../offline/sync";
import { useState } from "react";

export function OnlineIndicator() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await retryFailed();
      await syncOutbox();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          online ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-green-500" : "bg-red-500"}`} />
        {online ? t("sync.online") : t("sync.offline")}
      </span>
      {online && (
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-xs text-white underline disabled:opacity-50"
        >
          {syncing ? "Syncing…" : t("sync.sync_now")}
        </button>
      )}
    </div>
  );
}
