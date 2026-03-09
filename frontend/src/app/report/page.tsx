"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { fetchCamReport, getLatestAnalysis } from "@/lib/api";
import { FileText, Download, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

export default function ReportPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<{ pdf_url: string; docx_url: string } | null>(null);
  const [companyName, setCompanyName] = useState("Company");
  const [companyId, setCompanyId] = useState("");
  const [hasData,     setHasData]     = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
      return;
    }

    if (!user) return;
    let mounted = true;

    (async () => {
      try {
        const latest = await getLatestAnalysis();
        if (!mounted) return;
        setCompanyName(latest.company_name || "Company");
        setCompanyId(latest.company_id || "");
        setHasData((latest.status || "").toLowerCase() === "complete");
      } catch {
        if (!mounted) return;
        setCompanyName(localStorage.getItem("credasys_company_name") || "Company");
        setCompanyId(localStorage.getItem("credasys_company_id") || "");
        const hasScore = !!localStorage.getItem("credasys_score_data");
        setHasData(hasScore);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, loading, router]);

  const handleGenerate = async () => {
    if (!companyId) {
      toast.error("Run analysis first.");
      return;
    }

    setGenerating(true);
    try {
      const [pdfBlob, docxBlob] = await Promise.all([
        fetchCamReport(companyId, "pdf"),
        fetchCamReport(companyId, "docx"),
      ]);

      const pdfUrl = URL.createObjectURL(pdfBlob);
      const docxUrl = URL.createObjectURL(docxBlob);

      if (report?.pdf_url) URL.revokeObjectURL(report.pdf_url);
      if (report?.docx_url) URL.revokeObjectURL(report.docx_url);

      setReport({
        pdf_url: pdfUrl,
        docx_url: docxUrl,
      });
      const prevReports = Number(localStorage.getItem("credasys_reports_generated_total") || "0");
      localStorage.setItem("credasys_reports_generated_total", String(prevReports + 1));
      toast.success("CAM report generated!");
    } catch (e) {
      toast.error("Report generation failed. Ensure analysis is complete and backend is running.");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (report?.pdf_url) URL.revokeObjectURL(report.pdf_url);
      if (report?.docx_url) URL.revokeObjectURL(report.docx_url);
    };
  }, [report]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Navbar />
      <Sidebar />
      <main className="app-main">
        <div className="max-w-3xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight">CAM Report</h1>
            <p className="text-slate-400 mt-1">Generate a professional Credit Appraisal Memo for {companyName}</p>
          </div>

          {!hasData ? (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-12 text-center">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No analysis data found</p>
              <p className="text-slate-500 text-sm mb-4">Run your analysis first.</p>
              <a href="/research" className="btn-primary">Go to Research</a>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Report preview card */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center">
                    <FileText className="w-5 h-5 text-cyan-300" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-200">Credit Appraisal Memo</h2>
                    <p className="text-sm text-slate-400">Borrower: {companyName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    "Borrower Overview",
                    "Industry Analysis",
                    "Financial Analysis",
                    "Promoter Background",
                    "Risk Analysis",
                    "Credit Recommendation",
                  ].map((section) => (
                    <div key={section} className="flex items-center gap-2 text-sm text-slate-400">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      {section}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50 w-full justify-center"
                >
                  {generating
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                    : <><FileText className="w-4 h-4" />Generate CAM Report</>}
                </button>
              </div>

              {/* Downloads */}
              {report && (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 animate-fade-in">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <h3 className="font-semibold text-green-400">Report Ready!</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={report.pdf_url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                        <Download className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200 text-sm">Download PDF</p>
                        <p className="text-xs text-slate-500">Credit Appraisal Memo</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-500 ml-auto group-hover:text-red-400" />
                    </a>

                    <a
                      href={report.docx_url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Download className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200 text-sm">Download DOCX</p>
                        <p className="text-xs text-slate-500">Editable Word Document</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-500 ml-auto group-hover:text-blue-400" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


