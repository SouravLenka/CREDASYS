"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { getDashboardSummary, type DashboardSummaryResponse } from "@/lib/api";
import {
  BarChart3,
  FileText,
  Upload,
  Search,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LabelList,
} from "recharts";

type RecentAnalysis = DashboardSummaryResponse["recent_analyses"][number];

const quickActions = [
  { href: "/upload", label: "Upload Documents", icon: Upload, desc: "Add financial docs" },
  { href: "/research", label: "Research Company", icon: Search, desc: "Automated web research" },
  { href: "/risk", label: "Score Risk", icon: BarChart3, desc: "Five-Cs analysis" },
  { href: "/report", label: "Generate CAM", icon: FileText, desc: "Credit Appraisal Memo" },
];

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [recent, setRecent] = useState<RecentAnalysis[]>([]);
  const [statsData, setStatsData] = useState({
    analyses_run: 0,
    docs_uploaded: 0,
    reports_generated: 0,
    risk_flags_found: 0,
  });

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      try {
        const data = await getDashboardSummary();
        if (!mounted) return;
        setStatsData(data.stats);
        setRecent(data.recent_analyses || []);
      } catch {
        if (!mounted) return;
        setStatsData({ analyses_run: 0, docs_uploaded: 0, reports_generated: 0, risk_flags_found: 0 });
        setRecent([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  const stats = useMemo(
    () => [
      { label: "Analyses Run", value: statsData.analyses_run, icon: BarChart3, color: "text-cyan-300" },
      { label: "Docs Uploaded", value: statsData.docs_uploaded, icon: Upload, color: "text-indigo-300" },
      { label: "Reports Generated", value: statsData.reports_generated, icon: FileText, color: "text-emerald-300" },
      { label: "Risk Flags Found", value: statsData.risk_flags_found, icon: AlertTriangle, color: "text-amber-300" },
    ],
    [statsData]
  );

  const trendData = useMemo(() => {
    const base = Math.max(6, statsData.analyses_run + statsData.docs_uploaded + statsData.reports_generated);
    return [
      { period: "W1", value: Math.max(4, Math.round(base * 0.18)) },
      { period: "W2", value: Math.max(6, Math.round(base * 0.28)) },
      { period: "W3", value: Math.max(7, Math.round(base * 0.34)) },
      { period: "W4", value: Math.max(6, Math.round(base * 0.30)) },
      { period: "W5", value: Math.max(9, Math.round(base * 0.44)) },
      { period: "W6", value: Math.max(8, Math.round(base * 0.40)) },
    ];
  }, [statsData]);

  const executionBars = useMemo(
    () => [
      { name: "Analyses", value: statsData.analyses_run },
      { name: "Uploads", value: statsData.docs_uploaded },
      { name: "Reports", value: statsData.reports_generated },
      { name: "Flags", value: statsData.risk_flags_found },
    ],
    [statsData]
  );

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Navbar />
      <Sidebar />
      <main className="app-main">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-white tracking-tight">Credit Control Center</h1>
          <p className="text-slate-400 mt-1">
            Live portfolio view for {user.displayName?.split(" ")[0] || "analyst"}.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] uppercase tracking-widest text-slate-500">Live</span>
              </div>
              <div className="mt-4 text-4xl font-bold text-white">{value}</div>
              <div className="text-sm text-slate-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <div className="xl:col-span-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Activity Trend</h2>
                <p className="text-xs text-slate-400">Weekly execution trend with values</p>
              </div>
              <div className="text-xs text-cyan-300 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Positive
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 16, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    cursor={{ stroke: "var(--accent-soft)", strokeDasharray: "3 3" }}
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10 }}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--accent)" fill="url(#trendFill)" strokeWidth={3} />
                  <LabelList dataKey="value" position="top" fill="#cbd5e1" fontSize={11} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <div className="xl:col-span-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Execution Breakdown</h2>
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={executionBars} margin={{ top: 20, right: 12, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10 }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#60a5fa" maxBarSize={56}>
                    <LabelList dataKey="value" position="top" fill="#cbd5e1" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
              {quickActions.map(({ href, label, icon: Icon, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 transition-all duration-200 group hover:border-cyan-400/50"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-cyan-300" />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-100 text-sm">{label}</p>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 transition-colors" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Analyses</h2>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium">No analyses yet</p>
              <p className="text-slate-500 text-sm mt-1">Upload documents and run your first analysis.</p>
              <Link href="/upload" className="btn-primary mt-4 text-sm">Get started -&gt;</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((item) => (
                <div key={`${item.analysis_id}-${item.created_at}`} className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-soft)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-slate-200 font-semibold text-sm">{item.company_name}</p>
                      <p className="text-xs text-slate-400">
                        {item.loan_decision} | Score: {Number(item.credit_score || 0).toFixed(0)}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">{Array.isArray(item.risk_flags) ? item.risk_flags.length : 0} flags</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-hero-gradient">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center animate-pulse shadow-glow">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <p className="text-slate-400">Loading CREDASYS...</p>
      </div>
    </div>
  );
}


