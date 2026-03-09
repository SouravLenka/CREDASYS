import axios from "axios";
import { getIdToken } from "./firebase";

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function getBaseUrl() {
  if (typeof window === "undefined") return DEFAULT_BASE_URL;
  return localStorage.getItem("credasys_backend_url") || DEFAULT_BASE_URL;
}

function getCandidateBases() {
  const primary = getBaseUrl().replace(/\/+$/, "");
  const swapHost = primary.includes("127.0.0.1")
    ? primary.replace("127.0.0.1", "localhost")
    : primary.includes("localhost")
      ? primary.replace("localhost", "127.0.0.1")
      : primary;

  return Array.from(
    new Set([
      primary,
      swapHost,
      "http://127.0.0.1:8000",
      "http://localhost:8000",
    ]),
  );
}

const api = axios.create({ baseURL: DEFAULT_BASE_URL });

api.interceptors.request.use(async (config) => {
  try {
    const token = await getIdToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;
    const isNetworkError = error?.code === "ERR_NETWORK";
    const alreadyRetried = Boolean((config as any)?._hostRetryDone);

    if (!config || !isNetworkError || alreadyRetried) {
      return Promise.reject(error);
    }

    const currentBase = (config.baseURL || getBaseUrl()) as string;
    let altBase = "";
    if (currentBase.includes("127.0.0.1")) altBase = currentBase.replace("127.0.0.1", "localhost");
    if (currentBase.includes("localhost")) altBase = currentBase.replace("localhost", "127.0.0.1");

    if (!altBase || altBase === currentBase) {
      return Promise.reject(error);
    }

    (config as any)._hostRetryDone = true;
    config.baseURL = altBase;
    return api.request(config);
  },
);

export interface UploadResponse {
  company_id: string;
  company_name: string;
  documents: {
    filename: string;
    status: string;
    error?: string;
    num_chunks?: number;
  }[];
}

export async function uploadDocuments(
  companyName: string,
  companyId: string,
  files: File[],
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("company_name", companyName);
  form.append("company_id", companyId);
  files.forEach((f) => form.append("files", f));

  const token = await getIdToken().catch(() => "");
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "multipart/form-data",
  };

  const paths = ["/api/upload", "/upload-documents"];
  let lastError: unknown;

  for (const base of getCandidateBases()) {
    for (const path of paths) {
      try {
        const { data } = await axios.post<UploadResponse>(`${base}${path}`, form, {
          headers,
          params: { company_name: companyName },
          timeout: 60000,
        });
        return data;
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError;
}

export interface AnalysisResponse {
  company_id: string;
  processed_count: number;
  analysis_id: string;
  extracted_fields: string[];
}

export async function processDocuments(
  companyId: string,
): Promise<AnalysisResponse> {
  const token = await getIdToken().catch(() => "");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let lastError: unknown;
  for (const base of getCandidateBases()) {
    try {
      const { data } = await axios.post<AnalysisResponse>(
        `${base}/api/process?company_id=${companyId}`,
        null,
        { headers, timeout: 30000 },
      );
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function analyzeCompany(analysisId: string): Promise<any> {
  const token = await getIdToken().catch(() => "");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let lastError: unknown;
  for (const base of getCandidateBases()) {
    try {
      const { data } = await axios.post(
        `${base}/api/analyze?analysis_id=${analysisId}`,
        null,
        { headers, timeout: 60000 },
      );
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export interface ResearchResponse {
  company: string;
  research: {
    company_name: string;
    news_summary: string;
    promoter_summary: string;
    sector_summary: string;
    litigation_summary: string;
    regulatory_summary: string;
    risk_flags: string[];
  };
  risk_flags: string[];
  pipeline: string[];
}

export async function runResearch(companyName: string): Promise<ResearchResponse> {
  const token = await getIdToken().catch(() => "");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const candidates = ["/api/research", "/research"];

  let lastError: unknown;
  for (const base of getCandidateBases()) {
    for (const path of candidates) {
      try {
        const { data } = await axios.post<ResearchResponse>(
          `${base}${path}`,
          { company_name: companyName },
          { headers: authHeaders, timeout: 30000 },
        );
        return data;
      } catch (err: any) {
        lastError = err;
        const status = err?.response?.status;
        if (status && status !== 404) break;
      }
    }
  }
  throw lastError;
}

export interface ReportResponse {
  analysis_id: string;
  pdf_url: string;
  docx_url: string;
}

export async function generateReport(
  companyId: string,
  format: "pdf" | "docx" = "pdf",
): Promise<void> {
  const base = getCandidateBases()[0];
  window.open(`${base}/api/cam/${companyId}?format=${format}`, "_blank");
}

export async function fetchCamReport(
  companyId: string,
  format: "pdf" | "docx" = "pdf",
): Promise<Blob> {
  const token = await getIdToken().catch(() => "");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let lastError: unknown;
  for (const base of getCandidateBases()) {
    try {
      const { data } = await axios.get(`${base}/api/cam/${companyId}?format=${format}`, {
        headers,
        responseType: "blob",
        timeout: 60000,
      });
      return data as Blob;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export interface DashboardSummaryResponse {
  stats: {
    analyses_run: number;
    docs_uploaded: number;
    reports_generated: number;
    risk_flags_found: number;
  };
  recent_analyses: {
    analysis_id: string;
    company_id: string;
    company_name: string;
    credit_score: number;
    loan_decision: string;
    risk_flags: string[];
    risk_category: string;
    created_at: string;
  }[];
}

export interface LatestAnalysisResponse {
  analysis_id: string;
  company_id: string;
  company_name: string;
  status: string;
  loan_decision: string;
  overall_credit_score: number;
  risk_category: string;
  character_score: number;
  capacity_score: number;
  capital_score: number;
  collateral_score: number;
  conditions_score: number;
  risk_flags: string[];
  score_breakdown: Record<string, any>;
}

export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  const token = await getIdToken().catch(() => "");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let lastError: unknown;
  for (const base of getCandidateBases()) {
    try {
      const { data } = await axios.get<DashboardSummaryResponse>(`${base}/api/dashboard-summary`, {
        headers,
        timeout: 30000,
      });
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function getLatestAnalysis(): Promise<LatestAnalysisResponse> {
  const token = await getIdToken().catch(() => "");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let lastError: unknown;
  for (const base of getCandidateBases()) {
    try {
      const { data } = await axios.get<LatestAnalysisResponse>(`${base}/api/analysis/latest`, {
        headers,
        timeout: 30000,
      });
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function getRiskScore(companyId: string) {
  const { data } = await api.get(`/api/cam/${companyId}`);
  return data;
}

export default api;

