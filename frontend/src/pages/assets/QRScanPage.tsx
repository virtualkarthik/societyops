import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/client";
import type { Asset } from "../../api/types";

export function QRScanPage() {
  const { qr_token } = useParams<{ qr_token: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!qr_token) return;
    api.get<Asset[]>("/assets").then((res) => {
      const asset = res.data.find((a) => a.qr_token === qr_token);
      if (asset) {
        navigate(`/assets/${asset.id}/log`, { replace: true });
      } else {
        navigate("/assets", { replace: true });
      }
    }).catch(() => navigate("/assets", { replace: true }));
  }, [qr_token, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center text-gray-500">
        <div className="text-4xl mb-3">📷</div>
        <p>Looking up asset…</p>
      </div>
    </div>
  );
}
