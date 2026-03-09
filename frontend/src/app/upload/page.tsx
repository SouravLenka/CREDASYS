"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { useDropzone } from "react-dropzone";
import { uploadDocuments } from "@/lib/api";
import axios from "axios";
import { Upload, File, X, CheckCircle, AlertCircle, Loader2, Building2 } from "lucide-react";
import toast from "react-hot-toast";

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  chunks?: number;
}

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [companyId,   setCompanyId]   = useState("");
  const [files,       setFiles]       = useState<UploadedFile[]>([]);
  const [uploading,   setUploading]   = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/");
    // Generate a company ID on mount
    setCompanyId(Math.random().toString(36).slice(2, 12));
  }, [user, loading, router]);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...accepted.map((f) => ({ file: f, status: "pending" as const })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/plain": [".txt"],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const describeError = (error: unknown): string => {
    if (!axios.isAxiosError(error)) return "Upload failed due to unexpected error.";
    const status = error.response?.status;
    const detail =
      (error.response?.data as any)?.detail ||
      error.response?.statusText ||
      error.message;
    if (!status) return "Network error. Check backend URL/port and CORS.";
    return `Upload failed (${status}): ${detail}`;
  };

  const handleUpload = async () => {
    if (!companyName.trim()) { toast.error("Enter a company name first."); return; }
    if (files.length === 0)  { toast.error("Add at least one file.");       return; }

    setUploading(true);
    setFiles((prev) => prev.map((f) => ({ ...f, status: "uploading" })));

    try {
      const rawFiles = files.map((f) => f.file);
      const result   = await uploadDocuments(companyName, companyId, rawFiles);

      setFiles((prev) =>
        prev.map((f, i) => {
          const doc = result.documents[i];
          if (!doc) return f;
          return {
            ...f,
            status: doc.status === "success" ? "success" : "error",
            error:  doc.error,
            chunks: doc.num_chunks,
          };
        })
      );
      toast.success(`${result.documents.filter((d) => d.status === "success").length} file(s) uploaded!`);
      // Store company ID for subsequent analysis
      localStorage.setItem("credasys_company_id",   result.company_id);
      localStorage.setItem("credasys_company_name", companyName);
      const successCount = result.documents.filter((d) => d.status === "success").length;
      const prevTotal = Number(localStorage.getItem("credasys_docs_uploaded_total") || "0");
      localStorage.setItem("credasys_docs_uploaded_total", String(prevTotal + successCount));
    } catch (e: unknown) {
      const msg = describeError(e);
      toast.error(msg);
      setFiles((prev) => prev.map((f) => ({ ...f, status: "error", error: msg })));
    } finally {
      setUploading(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Navbar />
      <Sidebar />
      <main className="app-main">
        <div className="max-w-3xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight">Upload Documents</h1>
            <p className="text-slate-400 mt-1">Supported: PDF, CSV, Excel, TXT (max 50 MB each)</p>
          </div>

          {/* Company */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 mb-6">
            <label className="text-sm font-medium text-slate-300 mb-2 block">Company Name *</label>
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-slate-500 flex-shrink-0" />
              <input
                className="input-field"
                placeholder="e.g. Tata Motors Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">Company ID: <code className="text-cyan-300">{companyId}</code></p>
          </div>

          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-10 text-center cursor-pointer border-2 border-dashed transition-all duration-200 mb-6
              ${isDragActive ? "border-cyan-400 bg-[var(--bg-surface-alt)]" : "border-[var(--accent-soft)]/50 hover:border-cyan-400/60 hover:bg-[var(--bg-surface-alt)]"}`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-cyan-300 mx-auto mb-3" />
            {isDragActive
              ? <p className="text-cyan-300 font-medium">Drop files here...</p>
              : <>
                  <p className="text-slate-300 font-medium mb-1">Drag & drop files here</p>
                  <p className="text-slate-500 text-sm">or click to browse</p>
                </>
            }
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 mb-6 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-soft)]">
                  <File className="w-4 h-4 text-cyan-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{f.file.name}</p>
                    <p className="text-xs text-slate-500">{(f.file.size / 1024).toFixed(0)} KB</p>
                    {f.chunks !== undefined && (
                      <p className="text-xs text-green-400">{f.chunks} chunks indexed</p>
                    )}
                    {f.error && <p className="text-xs text-red-400">{f.error}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {f.status === "pending"   && <div className="w-2 h-2 rounded-full bg-slate-500" />}
                    {f.status === "uploading" && <Loader2 className="w-4 h-4 text-cyan-300 animate-spin" />}
                    {f.status === "success"   && <CheckCircle className="w-4 h-4 text-green-400" />}
                    {f.status === "error"     && <AlertCircle className="w-4 h-4 text-red-400" />}
                    {f.status === "pending" && (
                      <button onClick={() => removeFile(i)} className="p-1 hover:text-red-400 text-slate-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleUpload} disabled={uploading || files.length === 0} className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4" />Upload & Ingest</>}
            </button>
            <a href="/research" className="btn-outline">Proceed to Research</a>
          </div>
        </div>
      </main>
    </div>
  );
}


