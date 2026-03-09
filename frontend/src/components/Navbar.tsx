"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { signOutUser } from "@/lib/firebase";
import { LogOut, User, Moon, Sun } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import toast from "react-hot-toast";

export default function Navbar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOutUser();
    toast.success("Signed out");
    router.push("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur border-b border-theme" style={{ background: "color-mix(in srgb, var(--bg-primary) 94%, transparent)" }}>
      <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <BrandLogo size={32} />
          <span className="font-bold text-lg text-theme">CREDASYS</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-all theme-surface text-theme-muted hover:accent-text"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full theme-surface flex items-center justify-center">
                  <User className="w-4 h-4 text-theme" />
                </div>
                <span className="text-sm text-theme-muted hidden md:block">{user.displayName || user.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg text-theme-muted hover:text-red-500 hover:bg-red-500/10 transition-all"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
