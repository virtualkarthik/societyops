import api from "./client";
import type { ComplianceDoc } from "./types";

export const getComplianceDocs = (params?: { expiring_within_days?: number }) =>
  api.get<ComplianceDoc[]>("/compliance/docs", { params }).then((r) => r.data);

export const createComplianceDoc = (data: Partial<ComplianceDoc>) =>
  api.post<ComplianceDoc>("/compliance/docs", data).then((r) => r.data);

export const uploadDocFile = (doc_id: number, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post(`/compliance/docs/${doc_id}/file`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
