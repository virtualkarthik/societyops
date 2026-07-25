import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getComplianceDocs, createComplianceDoc, uploadDocFile } from "../../api/compliance";

function ExpiryBadge({ expiry }: { expiry: string | null }) {
  if (!expiry) return <span className="text-xs text-gray-400">No expiry</span>;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  const color = days < 0 ? "bg-red-100 text-red-700" : days <= 30 ? "bg-orange-100 text-orange-700" : days <= 90 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}</span>;
}

export function CompliancePage() {
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({ queryKey: ["compliance-docs"], queryFn: () => getComplianceDocs() });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ doc_type: "", title: "", issue_date: "", expiry_date: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const doc = await createComplianceDoc({
        doc_type: form.doc_type,
        title: form.title,
        issue_date: form.issue_date || undefined,
        expiry_date: form.expiry_date || undefined,
        notes: form.notes || undefined,
      });
      if (file) await uploadDocFile(doc.id, file);
      return doc;
    },
    onSuccess: () => {
      toast.success("Document added");
      qc.invalidateQueries({ queryKey: ["compliance-docs"] });
      setShowForm(false);
      setForm({ doc_type: "", title: "", issue_date: "", expiry_date: "", notes: "" });
      setFile(null);
    },
    onError: () => toast.error("Failed to add document"),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Compliance Vault</h1>
        <button onClick={() => setShowForm(true)}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium min-h-[44px]">
          + Add Document
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-700">New Compliance Document</h2>
          {[
            ["doc_type", "Document Type", "text"],
            ["title", "Title", "text"],
            ["issue_date", "Issue Date", "date"],
            ["expiry_date", "Expiry Date", "date"],
            ["notes", "Notes", "text"],
          ].map(([field, label, type]) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} value={form[field as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload File (PDF/Image)</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
              Save
            </button>
            <button onClick={() => setShowForm(false)}
              className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {isLoading && <div className="text-center text-gray-400 py-10">Loading…</div>}

      <div className="space-y-3">
        {docs.map((doc) => (
          <div key={doc.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
            <div>
              <div className="font-medium text-gray-800">{doc.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{doc.doc_type} {doc.issue_date && `· Issued: ${doc.issue_date}`}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <ExpiryBadge expiry={doc.expiry_date} />
              {doc.file && (
                <a href={doc.file} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-brand underline">View</a>
              )}
            </div>
          </div>
        ))}
        {!isLoading && docs.length === 0 && (
          <div className="text-center text-gray-400 py-10">No compliance documents found</div>
        )}
      </div>
    </div>
  );
}
