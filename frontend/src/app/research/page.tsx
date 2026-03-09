"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import {
  runResearch,
  processDocuments,
  analyzeCompany,
  type ResearchResponse,
} from "@/lib/api";
import axios from "axios";
import { Search, Loader2, AlertTriangle, Globe, User, Scale, Newspaper, Building2 } from "lucide-react";
import toast from "react-hot-toast";

export default function ResearchPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [searching,   setSearching]   = useState(false);
  const [analysis,    setAnalysis]    = useState<ResearchResponse | null>(null);
  const [loadStep,    setLoadStep]    = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push("/");
    setCompanyName(localStorage.getItem("credasys_company_name") || "");
    setCompanyId(localStorage.getItem("credasys_company_id") || "");
  }, [user, loading, router]);

  const describeError = (error: unknown): string => {
    if (!axios.isAxiosError(error)) return "Analysis failed. Unexpected error.";
    const status = error.response?.status;
    const detail =
      (error.response?.data as any)?.detail ||
      error.response?.statusText ||
      error.message;

    if (status === 404) {
      return "Research API missing (404). Restart backend from latest code and verify /api/research in /docs.";
    }
    if (status === 401) {
      return "Unauthorized (401). Check Firebase/auth settings.";
    }
    if (status === 422) {
      return "Invalid request (422). Please check company name input.";
    }
    if (status && status >= 500) {
      return `Backend error (${status}): ${detail}`;
    }
    return `Request failed${status ? ` (${status})` : ""}: ${detail}`;
  };

  const loadingSteps = [
    "Initializing research agent...",
    "Scanning financial documents...",
    "Searching web for company news...",
    "Fetching promoter litigation records...",
    "Analysing Indian market outlook (MCA/GST)...",
    "Calculating Five-Cs risk score...",
    "Finalizing AI insights..."
  ];

  const appendRecentAnalysis = (
    analysisId: string,
    scorePayload: any,
    fallbackFlags: string[] = []
  ) => {
    const riskFlags = Array.isArray(scorePayload?.risk_flags)
      ? scorePayload.risk_flags
      : fallbackFlags;

    const entry = {
      analysis_id: analysisId,
      company_name: companyName,
      credit_score: Number(scorePayload?.overall_credit_score ?? scorePayload?.credit_score ?? 0),
      loan_decision: String(scorePayload?.loan_decision || "N/A"),
      risk_flags: riskFlags,
      created_at: new Date().toISOString(),
    };

    try {
      const prev = JSON.parse(localStorage.getItem("credasys_recent_analyses") || "[]");
      const list = Array.isArray(prev) ? prev : [];
      const deduped = list.filter((item: any) => item?.analysis_id !== analysisId);
      const updated = [entry, ...deduped].slice(0, 30);
      localStorage.setItem("credasys_recent_analyses", JSON.stringify(updated));
    } catch {
      localStorage.setItem("credasys_recent_analyses", JSON.stringify([entry]));
    }
  };

  useEffect(() => {
    let interval: any;
    if (searching) {
      setLoadStep(0);
      interval = setInterval(() => {
        setLoadStep((s) => (s < loadingSteps.length - 1 ? s + 1 : s));
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [searching]);

  const handleSearch = async () => {
    if (!companyName.trim()) { toast.error("Enter company name"); return; }
    setSearching(true);
    setAnalysis(null);
    try {
      toast.loading("Running research pipeline...", { id: "process" });
      let result: ResearchResponse;

      if (companyId) {
        try {
          const processResult = await processDocuments(companyId);
          const analysisId = processResult.analysis_id;
          if (analysisId) {
            const legacy = await analyzeCompany(analysisId);
            localStorage.setItem("credasys_analysis_id", analysisId);
            localStorage.setItem("credasys_company_id", companyId);
            localStorage.setItem(
              "credasys_score_data",
              JSON.stringify(legacy?.score || legacy || {}),
            );
            appendRecentAnalysis(
              analysisId,
              legacy?.score || legacy || {},
              legacy?.risk_flags || []
            );
            result = {
              company: companyName,
              research: legacy?.research || {
                company_name: companyName,
                news_summary: "",
                promoter_summary: "",
                sector_summary: "",
                litigation_summary: "",
                regulatory_summary: "",
                risk_flags: [],
              },
              risk_flags:
                legacy?.risk_flags ||
                legacy?.score?.risk_flags ||
                legacy?.research?.risk_flags ||
                [],
              pipeline: [
                "Company Name",
                "Document Processing",
                "Risk Analysis",
                "Research Synthesis",
              ],
            };
          } else {
            result = await runResearch(companyName);
          }
        } catch {
          result = await runResearch(companyName);
        }
      } else {
        result = await runResearch(companyName);
      }

      setAnalysis(result);
      
      // Persist for next steps
      localStorage.setItem("credasys_research_data", JSON.stringify(result.research));
      localStorage.setItem("credasys_company_name", companyName);
      toast.success("Research complete!", { id: "process" });
    } catch (e) {
      console.error(e);
      toast.error(describeError(e), { id: "process" });
    } finally {
      setSearching(false);
    }
  };

  if (loading || !user) return null;

  const research = analysis?.research;
  const insightSections = [
    { key: "news_summary", label: "Recent News & Media", icon: Newspaper },
    { key: "promoter_summary", label: "Promoter Background", icon: User },
    { key: "sector_summary", label: "Sector & Market Trends", icon: Globe },
    { key: "litigation_summary", label: "Litigation History", icon: Scale },
    { key: "regulatory_summary", label: "Regulatory & Compliance", icon: Building2 },
  ] as const;

  const isMeaningfulInsight = (value: unknown) => {
    if (typeof value !== "string") return false;
    const text = value.trim();
    if (!text) return false;
    const blockedPatterns = [
      "no data available",
      "no significant information found",
      "not available",
      "n/a",
      "insufficient information",
    ];
    return !blockedPatterns.some((pattern) => text.toLowerCase().includes(pattern));
  };

  const visibleInsights = insightSections.filter((section) => isMeaningfulInsight(research?.[section.key]));

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Navbar />
      <Sidebar />
      <main className="app-main">
        <div className="max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight">Research Insights</h1>
            <p className="text-slate-400 mt-1">Automated web research via AI-powered search agent</p>
          </div>

          {/* Search bar */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  className="input-field pl-10"
                  placeholder="Company name (e.g. ABC Steel Pvt Ltd)"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <button onClick={handleSearch} disabled={searching} className="btn-primary flex items-center gap-2 disabled:opacity-50 min-w-[140px] justify-center">
                {searching ? <><Loader2 className="w-4 h-4 animate-spin" />Researching...</> : <><Search className="w-4 h-4" />Run Research</>}
              </button>
            </div>
            
            {searching && (
              <div className="mt-6 p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-soft)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">AI Analysis in Progress</span>
                  <span className="text-xs text-slate-500">{Math.round(((loadStep + 1) / loadingSteps.length) * 100)}%</span>
                </div>
                <div className="w-full bg-[var(--bg-surface-alt)] rounded-full h-1.5 mb-4">
                  <div 
                    className="bg-cyan-400 h-1.5 rounded-full transition-all duration-1000 ease-out" 
                    style={{ width: `${((loadStep + 1) / loadingSteps.length) * 100}%` }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-cyan-300 animate-spin" />
                  <p className="text-sm text-slate-200 animate-pulse">{loadingSteps[loadStep]}</p>
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          {analysis && research && (
            <div className="space-y-6 animate-fade-in">
              {/* WOW Feature: Risk Alerts Panel */}
              {analysis?.risk_flags && analysis.risk_flags.length > 0 && (
                <div className="glass-card p-6 border-l-4 border-red-500 bg-red-500/5">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                    <h2 className="text-lg font-bold text-red-500">Critical Risk Alerts</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.risk_flags.map((flag, idx) => (
                      <div key={idx} className="flex gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-slate-300">{flag}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Research sections */}
              <div className="grid grid-cols-1 gap-4">
                {visibleInsights.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 group hover:border-cyan-400/40 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center transition-all">
                          <Icon className="w-5 h-5 text-cyan-300" />
                        </div>
                        <h3 className="font-bold text-slate-100">{label}</h3>
                      </div>
                      <span className="text-[10px] font-bold text-cyan-300/60 uppercase tracking-widest">AI SUMMARY</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-chill">{research[key]}</p>
                  </div>
                ))}
                {visibleInsights.length === 0 && (
                  <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
                    <p className="text-sm text-slate-400">
                      No research insights are currently available for this company.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-center pt-4">
                <a href="/risk" className="btn-primary flex items-center gap-2 px-8 py-4 text-lg">
                  Next: Visualize Risk Analysis
                </a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


