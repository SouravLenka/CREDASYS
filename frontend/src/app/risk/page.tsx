"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { getLatestAnalysis } from "@/lib/api";
import { AlertTriangle, BarChart3, CheckCircle, FileText, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

interface ScoreData {
  character_score: number;
  capacity_score: number;
  capital_score: number;
  collateral_score: number;
  conditions_score: number;
  overall_credit_score: number;
  risk_category: string;
  explanation: string[];
  score_breakdown: {
    ratios: {
      debt_to_revenue: number;
      current_ratio: number;
      dscr: number;
    };
  };
}

const dimensionLabels: { key: keyof ScoreData; label: string }[] = [
  { key: "character_score", label: "Character" },
  { key: "capacity_score", label: "Capacity" },
  { key: "capital_score", label: "Capital" },
  { key: "collateral_score", label: "Collateral" },
  { key: "conditions_score", label: "Conditions" },
];

export default function RiskPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [companyName, setCompanyName] = useState("Company");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
      return;
    }

    const load = async () => {
      try {
        const latest = await getLatestAnalysis();
        const breakdown: any = latest?.score_breakdown || {};
        const flags: string[] = Array.isArray(latest?.risk_flags) ? latest.risk_flags : [];

        setCompanyName(latest?.company_name || localStorage.getItem("credasys_company_name") || "Company");
        setScoreData({
          character_score: Number(latest?.character_score ?? breakdown?.character ?? 0),
          capacity_score: Number(latest?.capacity_score ?? breakdown?.capacity ?? 0),
          capital_score: Number(latest?.capital_score ?? breakdown?.capital ?? 0),
          collateral_score: Number(latest?.collateral_score ?? breakdown?.collateral ?? 0),
          conditions_score: Number(latest?.conditions_score ?? breakdown?.conditions ?? 0),
          overall_credit_score: Number(latest?.overall_credit_score ?? 0),
          risk_category: latest?.risk_category || "High",
          explanation: flags.length ? flags : ["No major risk flags detected"],
          score_breakdown: {
            ratios: {
              debt_to_revenue: Number(breakdown?.ratios?.debt_to_revenue ?? 0),
              current_ratio: Number(breakdown?.ratios?.current_ratio ?? 1),
              dscr: Number(breakdown?.ratios?.dscr ?? 1),
            },
          },
        });
      } catch {
        const stored = localStorage.getItem("credasys_score_data");
        if (!stored) return;

        try {
          const raw = JSON.parse(stored);
          const breakdown = raw?.score_breakdown || {};
          const overall = Number(raw?.overall_credit_score ?? raw?.credit_score ?? 0) || 0;
          const flags: string[] = Array.isArray(raw?.risk_flags) ? raw.risk_flags : [];
          const loanDecision = String(raw?.loan_decision || "").toUpperCase();
          const riskCategory =
            overall >= 80 || loanDecision === "APPROVE"
              ? "Low"
              : overall >= 60 || loanDecision === "CONDITIONAL APPROVAL"
                ? "Moderate"
                : "High";

          setCompanyName(localStorage.getItem("credasys_company_name") || "Company");
          setScoreData({
            character_score: Number(breakdown?.character ?? breakdown?.qualitative ?? 0),
            capacity_score: Number(breakdown?.capacity ?? breakdown?.financial_strength ?? 0),
            capital_score: Number(breakdown?.capital ?? breakdown?.tax_compliance ?? 0),
            collateral_score: Number(breakdown?.collateral ?? breakdown?.bank_behavior ?? 0),
            conditions_score: Number(breakdown?.conditions ?? breakdown?.credit_bureau ?? 0),
            overall_credit_score: overall,
            risk_category: riskCategory,
            explanation: flags.length ? flags : ["No major risk flags detected"],
            score_breakdown: {
              ratios: {
                debt_to_revenue: Number(breakdown?.ratios?.debt_to_revenue ?? 0),
                current_ratio: Number(breakdown?.ratios?.current_ratio ?? 1),
                dscr: Number(breakdown?.ratios?.dscr ?? 1),
              },
            },
          });
        } catch {
          setScoreData(null);
        }
      }
    };

    load();
  }, [user, loading, router]);

  const riskTone = scoreData?.risk_category?.toLowerCase().includes("low")
    ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
    : scoreData?.risk_category?.toLowerCase().includes("moderate") ||
        scoreData?.risk_category?.toLowerCase().includes("medium")
      ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
      : "text-rose-300 border-rose-500/30 bg-rose-500/10";

  const fiveCData = useMemo(() => {
    if (!scoreData) return [];
    return dimensionLabels.map(({ key, label }) => ({
      name: label,
      score: Number(scoreData[key] as number) || 0,
    }));
  }, [scoreData]);

  const ratioData = useMemo(() => {
    if (!scoreData) return [];
    const debtRatioPercent = Math.max(0, Number((scoreData.score_breakdown.ratios.debt_to_revenue * 100).toFixed(1)));
    const currentRatioPercent = Math.max(0, Number(Math.min(100, (scoreData.score_breakdown.ratios.current_ratio / 3) * 100).toFixed(1)));
    const dscrPercent = Math.max(0, Number(Math.min(100, (scoreData.score_breakdown.ratios.dscr / 3) * 100).toFixed(1)));
    return [
      { name: "Debt/Rev %", value: Math.min(100, debtRatioPercent), display: `${debtRatioPercent.toFixed(1)}%` },
      { name: "Current Ratio", value: currentRatioPercent, display: scoreData.score_breakdown.ratios.current_ratio.toFixed(2) },
      { name: "DSCR", value: dscrPercent, display: scoreData.score_breakdown.ratios.dscr.toFixed(2) },
    ];
  }, [scoreData]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Navbar />
      <Sidebar />
      <main className="app-main">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight">Risk Analytics</h1>
            <p className="text-slate-400 mt-1">Five-C credit assessment for {companyName}</p>
          </div>

          {!scoreData ? (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-12 text-center">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No score data yet</p>
              <p className="text-slate-500 text-sm mb-4">Run research and analysis first.</p>
              <a href="/research" className="btn-primary">Go to Research</a>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-300">Overall Credit Score</p>
                    <TrendingUp className="w-4 h-4 text-cyan-300" />
                  </div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart
                        innerRadius="68%"
                        outerRadius="100%"
                        data={[{ name: "Score", value: Math.max(0, Math.min(100, scoreData.overall_credit_score)) }]}
                        startAngle={180}
                        endAngle={0}
                      >
                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                        <RadialBar dataKey="value" cornerRadius={12} fill="var(--accent)" background={{ fill: "var(--bg-surface-alt)" }} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="-mt-5 text-center text-5xl font-black text-white">
                    {scoreData.overall_credit_score.toFixed(0)}
                    <span className="text-base text-slate-500">/100</span>
                  </p>
                  <div className="mt-3 flex justify-center">
                    <div className={`inline-flex px-4 py-2 rounded-xl border font-semibold ${riskTone}`}>
                      {scoreData.risk_category} Risk
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
                  <h3 className="font-semibold text-white mb-4">5C Dimension Scores</h3>
                  <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fiveCData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10 }} />
                        <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="#60a5fa" maxBarSize={52}>
                          <LabelList dataKey="score" position="top" fill="#cbd5e1" fontSize={11} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
                  <h3 className="font-semibold text-white mb-4">Financial Ratio Benchmarks</h3>
                  <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ratioData} margin={{ top: 20, right: 12, left: -8, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10 }} />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#34d399" maxBarSize={64}>
                          <LabelList dataKey="display" position="top" fill="#cbd5e1" fontSize={11} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
                  <h3 className="font-semibold text-white mb-4">Risk Flags</h3>
                  <div className="space-y-2 max-h-56 overflow-auto pr-1">
                    {scoreData.explanation.map((flag, idx) => (
                      <div key={`${flag}-${idx}`} className="flex gap-2 items-start p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-soft)]">
                        {flag.toLowerCase().includes("no major") ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        )}
                        <p className="text-sm text-slate-300">{flag}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <a href="/report" className="btn-primary flex items-center gap-2 px-8 py-4 text-lg">
                  <FileText className="w-5 h-5" /> Generate CAM Report
                </a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


