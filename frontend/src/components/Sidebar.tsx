"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Upload, Search, BarChart3, FileText,
} from "lucide-react";
import { clsx } from "clsx";

const links = [
  { href: "/dashboard",  label: "Dashboard",   icon: LayoutDashboard },
  { href: "/upload",     label: "Upload Docs", icon: Upload },
  { href: "/research",   label: "Research",    icon: Search },
  { href: "/risk",       label: "Risk Score",  icon: BarChart3 },
  { href: "/report",     label: "CAM Report",  icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-16 bottom-0 w-60 backdrop-blur border-r border-theme flex flex-col py-6 px-3"
      style={{ background: "color-mix(in srgb, var(--bg-primary) 94%, transparent)" }}
    >
      <nav className="flex flex-col gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200",
                active
                  ? "theme-panel accent-text border"
                  : "text-theme-muted hover:text-theme hover:theme-panel"
              )}
            >
              <Icon className={clsx("w-5 h-5", active ? "accent-text" : "text-theme-muted")} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
