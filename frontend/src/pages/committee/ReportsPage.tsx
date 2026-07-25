import { useState } from "react";
import toast from "react-hot-toast";

function downloadPdf(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

function ReportCard({ title, description, url, filename }: {
  title: string; description: string; url: string; filename: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Report generation failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      downloadPdf(objUrl, filename);
      URL.revokeObjectURL(objUrl);
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <button onClick={handleDownload} disabled={loading}
        className="bg-brand text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-60 min-h-[44px]">
        {loading ? "Generating…" : "Download PDF"}
      </button>
    </div>
  );
}

export function ReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Reports</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <ReportCard
          title="TNPCB Inspection Pack"
          description="CTO details, STP operational logs (last 30), lab test trend, removal efficiency, and breach summary."
          url="/api/v1/reports/tnpcb"
          filename="tnpcb_inspection_pack.pdf"
        />
        <ReportCard
          title="AGM Operations Summary"
          description="Full operations & compliance summary — PPM stats, asset health, compliance doc status."
          url="/api/v1/reports/agm"
          filename="agm_summary.pdf"
        />
        <ReportCard
          title="Audit Trail Export"
          description="Tamper-evident chronological record of all create/update/delete actions."
          url="/api/v1/reports/audit"
          filename="audit_trail.pdf"
        />
      </div>
    </div>
  );
}
