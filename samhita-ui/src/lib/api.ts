import axios from "axios";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
});

// --- Upload ---
export async function uploadDocument(file: File, caseId?: number, docType?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (caseId) formData.append("case_id", caseId.toString());
  if (docType) formData.append("doc_type", docType);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function uploadPreAuth(file: File, data: Record<string, any>) {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, String(value));
    }
  });
  const res = await fetch(`${API_BASE}/api/upload/pre-auth`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Pre-auth upload failed");
  return res.json();
}

export async function uploadText(text: string, caseId?: number, docType?: string) {
  const res = await fetch(`${API_BASE}/api/upload/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, case_id: caseId, doc_type: docType }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Upload failed");
  }
  return res.json();
}

// --- Documents ---
export async function getDocuments(status?: string) {
  const params = status ? { status } : {};
  const res = await api.get("/api/documents", { params });
  return res.data;
}

export async function getDocument(id: number) {
  const res = await api.get(`/api/documents/${id}`);
  return res.data;
}

export async function getDocumentAccuracy(id: number) {
  const res = await api.get(`/api/documents/${id}/accuracy`);
  return res.data;
}

export async function retryDocument(id: number) {
  const res = await api.post(`/api/documents/${id}/retry`);
  return res.data;
}

export async function getDocumentExplanations(id: number) {
  const res = await api.get(`/api/documents/${id}/explanations`);
  return res.data;
}

export async function explainCode(code: string, codeSystem: string = "ICD-10", description: string = "") {
  const res = await api.get(`/api/explain/${code}`, { params: { code_system: codeSystem, description } });
  return res.data;
}

// --- Cases ---
export async function getCases(stage?: string, status?: string, search?: string) {
  const params: Record<string, string> = {};
  if (stage) params.stage = stage;
  if (status) params.status = status;
  if (search) params.search = search;
  const res = await api.get("/api/cases", { params });
  return res.data;
}

export async function getCase(id: number) {
  const res = await api.get(`/api/cases/${id}`);
  return res.data;
}

export async function createCase(data: Record<string, any>) {
  const res = await api.post("/api/cases", data);
  return res.data;
}

export async function updateCase(id: number, data: Record<string, any>) {
  const res = await api.patch(`/api/cases/${id}`, data);
  return res.data;
}

export async function advanceCase(id: number, toStage: string, action?: string, notes?: string) {
  const res = await api.post(`/api/cases/${id}/advance`, {
    to_stage: toStage,
    action: action || `advanced_to_${toStage}`,
    notes: notes || "",
  });
  return res.data;
}

export async function getCaseHistory(id: number) {
  const res = await api.get(`/api/cases/${id}/history`);
  return res.data;
}

export async function getCaseStats() {
  const res = await api.get("/api/cases/stats");
  return res.data;
}

export async function getCaseStages() {
  const res = await api.get("/api/cases/stages");
  return res.data;
}

export async function getClaimProbability(caseId: number) {
  const res = await api.get(`/api/cases/${caseId}/probability`);
  return res.data;
}

export async function getCaseTat(caseId: number) {
  const res = await api.get(`/api/cases/${caseId}/tat`);
  return res.data;
}

export function getCasePdfUrl(caseId: number, type: "pre_auth" | "bill_summary" | "settlement") {
  return `${API_BASE}/api/cases/${caseId}/pdf/${type}`;
}

// --- Claims Lifecycle ---
export async function getPreAuth(caseId: number) {
  const res = await api.get(`/api/claims/${caseId}/pre-auth`);
  return res.data;
}

export async function updatePreAuth(caseId: number, data: Record<string, any>) {
  const res = await api.patch(`/api/claims/${caseId}/pre-auth`, data);
  return res.data;
}

export async function approveCase(caseId: number, data: { approved_amount: number; approval_reference?: string; validity_days?: number; conditions?: string; notes?: string }) {
  const res = await api.post(`/api/claims/${caseId}/approve`, data);
  return res.data;
}

export async function admitPatient(caseId: number, data: { admission_date: string; ip_number?: string; notes?: string }) {
  const res = await api.post(`/api/claims/${caseId}/admit`, data);
  return res.data;
}

export async function getBills(caseId: number) {
  const res = await api.get(`/api/claims/${caseId}/bills`);
  return res.data;
}

export async function createBill(caseId: number, data: { bill_type?: string; items?: any[]; notes?: string }) {
  const res = await api.post(`/api/claims/${caseId}/bills`, data);
  return res.data;
}

export async function addBillItem(caseId: number, billId: number, item: Record<string, any>) {
  const res = await api.post(`/api/claims/${caseId}/bills/${billId}/items`, item);
  return res.data;
}

export async function requestEnhancement(caseId: number, data: { additional_amount: number; reason: string; notes?: string }) {
  const res = await api.post(`/api/claims/${caseId}/enhance`, data);
  return res.data;
}

export async function dischargePatient(caseId: number, data: { discharge_date: string; discharge_summary_doc_id?: number; notes?: string }) {
  const res = await api.post(`/api/claims/${caseId}/discharge`, data);
  return res.data;
}

export async function createSettlement(caseId: number, data: Record<string, any>) {
  const res = await api.post(`/api/claims/${caseId}/settlement`, data);
  return res.data;
}

export async function getSettlement(caseId: number) {
  const res = await api.get(`/api/claims/${caseId}/settlement`);
  return res.data;
}

export async function recordPayment(caseId: number, data: { payment_type: string; amount: number; reference_number?: string; payment_date?: string; notes?: string }) {
  const res = await api.post(`/api/claims/${caseId}/payment`, data);
  return res.data;
}

export async function getPayments(caseId: number) {
  const res = await api.get(`/api/claims/${caseId}/payments`);
  return res.data;
}

export async function reconcileCase(caseId: number) {
  const res = await api.post(`/api/claims/${caseId}/reconcile`);
  return res.data;
}

export async function closeCase(caseId: number, notes?: string) {
  const res = await api.post(`/api/claims/${caseId}/close`, null, { params: { notes: notes || "" } });
  return res.data;
}

// --- Review ---
export async function getReviewQueue() {
  const res = await api.get("/api/review-queue");
  return res.data;
}

export async function updateEntity(
  entityId: number,
  update: {
    reviewer_approved?: boolean;
    coded_value?: string;
    entity_text?: string;
    normalized_value?: string;
  }
) {
  const res = await api.patch(`/api/entities/${entityId}`, update);
  return res.data;
}

// --- Exports ---
export function getExportUrl(type: "fhir" | "ayushman" | "csv" | "pdf" | "fhir-pdf", docId: number) {
  return `${API_BASE}/api/export/${type}/${docId}`;
}

// --- Analytics ---
export async function getMetrics() {
  const res = await api.get("/api/metrics");
  return res.data;
}

export async function getRevenueAnalytics() {
  const res = await api.get("/api/revenue-analytics");
  return res.data;
}

// --- Alerts ---
export async function getAlerts() {
  const res = await api.get("/api/alerts");
  return res.data;
}

export async function acknowledgeAlert(alertId: number) {
  const res = await api.patch(`/api/alerts/${alertId}/acknowledge`);
  return res.data;
}

// --- Chat ---
export async function chatWithPatient(
  docId: number,
  message: string,
  history: { role: string; content: string }[]
) {
  const res = await api.post(`/api/chat/${docId}`, { message, history });
  return res.data;
}

// --- Voice ---
export async function textToSpeech(text: string, language = "hi-IN") {
  const res = await api.post("/api/voice/tts", { text, language });
  return res.data;
}

export async function speechToText(audioBlob: Blob, language = "hi-IN") {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.wav");
  formData.append("language", language);
  const res = await api.post("/api/voice/stt", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export default api;
