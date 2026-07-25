import { useTranslation } from "react-i18next";
import type { SyncStatus } from "../api/types";

interface Props {
  status: SyncStatus;
}

const styles: Record<SyncStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  synced: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export function SyncStatusBadge({ status }: Props) {
  const { t } = useTranslation();
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {t(`sync.${status}`)}
    </span>
  );
}
