"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { signInWithGoogle } from "@/lib/firebase";
import { ArrowRight, Shield, Zap, FileText, BarChart3, Search, Upload, Moon, Sun } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import toast from "react-hot-toast";

const features = [
  { icon: Upload, title: "Document Ingestion", desc: "PDF, CSV, Excel, TXT inputs parsed and indexed for analysis." },
  { icon: Search, title: "Research Agent", desc: "Web research for legal, compliance, and market risk signals." },
  { icon: BarChart3, title: "5C Risk Scoring", desc: "Explainable credit scoring across Character, Capacity, Capital, Collateral, Conditions." },
  { icon: FileText, title: "CAM Reports", desc: "Generate downloadable CAM reports in PDF and DOCX." },
  { icon: Shield, title: "Secure Access", desc: "Google-based authentication and isolated company-level workflows." },
  { icon: Zap, title: "Real-Time Pipeline", desc: "FastAPI backend with dynamic dashboard, risk, research, and reports." },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.push("/dashboard");
  }, [user, loading, router]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch {
      toast.error("Sign-in failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-slate-100">
      <div className="absolute inset-0 pointer-events-none">
        <div className="blob w-[420px] h-[420px] bg-cyan-600 top-[-80px] left-[15%]" />
        <div className="blob w-[360px] h-[360px] bg-blue-700 bottom-[-60px] right-[10%]" style={{ animationDelay: "1.5s" }} />
      </div>

      <nav className="relative z-10 max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrandLogo size={36} />
          <span className="font-bold text-xl text-white">CREDASYS</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg theme-surface text-theme-muted hover:accent-text transition-all"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={handleLogin} className="btn-outline text-sm">Sign In</button>
        </div>
      </nav>

      <section className="relative z-10 max-w-6xl mx-auto px-8 pt-16 pb-20">
        <div className="rounded-full inline-flex items-center gap-2 px-4 py-2 border border-[var(--accent-soft)] bg-[var(--bg-card)] text-cyan-300 text-sm mb-8">
          <Zap className="w-4 h-4" />
          AI corporate credit decision engine
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
          Intelligent Credit Decisions
          <span className="block text-cyan-300">for Corporate Lending</span>
        </h1>

        <p className="text-slate-300 text-lg max-w-3xl mb-10">
          Analyze uploaded company documents, enrich with external research, score risk on 5C principles,
          and generate CAM-ready recommendations through one unified workflow.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <button onClick={handleLogin} className="btn-primary flex items-center gap-2">
            Continue with Google <ArrowRight className="w-4 h-4" />
          </button>
          <a href="#features" className="btn-outline">Explore Features</a>
        </div>
      </section>

      <section id="features" className="relative z-10 max-w-6xl mx-auto px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-cyan-300" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 text-center py-6 text-slate-500 text-sm border-t border-[var(--border-color)]">
        CREDASYS - Hackathon Build
      </footer>
    </div>
  );
}


