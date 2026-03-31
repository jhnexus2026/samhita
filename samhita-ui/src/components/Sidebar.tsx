"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  ClipboardCheck,
  AlertTriangle,
  FileText,
  Home,
  MessageCircle,
  Mic,
  Activity,
  Briefcase,
  BarChart3,
  Stethoscope,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";

const doctorNav = [
  { href: "/dashboard", label: "Patient Dashboard", icon: Stethoscope },
  { href: "/upload", label: "Upload Document", icon: Upload },
  { href: "/review", label: "Verify & Review", icon: ClipboardCheck },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/documents", label: "All Documents", icon: FileText },
  { href: "/chatbot", label: "Clinical AI Chat", icon: MessageCircle },
  { href: "/voice", label: "Voice Assistant", icon: Mic },
];

const doctorSecondary = [
  { href: "/analytics", label: "Claims Tracker", icon: Briefcase },
];

const adminNav = [
  { href: "/dashboard", label: "Claims Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Document", icon: Upload },
  { href: "/review", label: "Verify & Review", icon: ClipboardCheck },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/documents", label: "All Documents", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/chatbot", label: "Billing AI Chat", icon: MessageCircle },
];

const adminSecondary = [
  { href: "/voice", label: "Voice Assistant", icon: Mic },
];

export function Sidebar() {
  const pathname = usePathname();
  const { email, role, logout } = useAuth();

  const isDoctor = role === "doctor";
  const navItems = isDoctor ? doctorNav : adminNav;
  const secondaryItems = isDoctor ? doctorSecondary : adminSecondary;
  const subtitle = isDoctor ? "Clinical Intelligence" : "Billing Intelligence";

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-neutral-200/80 dark:border-white/[0.06] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl flex flex-col transition-colors duration-300">
      {/* Logo */}
      <div className="p-6 border-b border-neutral-100 dark:border-white/[0.04]">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow duration-300">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 dark:from-white to-neutral-600 dark:to-neutral-400">
              SAMHITA
            </span>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium -mt-0.5 tracking-wide uppercase">{subtitle}</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 mb-2 ${
            pathname === "/"
              ? "bg-neutral-100 dark:bg-white/[0.06] text-neutral-900 dark:text-white"
              : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/[0.04] hover:text-neutral-700 dark:hover:text-neutral-200"
          }`}
        >
          <Home className="h-4 w-4" />
          Home
        </Link>

        <div className="h-px bg-neutral-100 dark:bg-white/[0.04] mb-2 mx-3" />

        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/[0.04] hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              <item.icon className={`h-4 w-4 transition-colors ${isActive ? "" : "group-hover:text-indigo-500 dark:group-hover:text-indigo-400"}`} />
              {item.label}
            </Link>
          );
        })}

        {/* Secondary links */}
        {secondaryItems.length > 0 && (
          <>
            <div className="h-px bg-neutral-100 dark:bg-white/[0.04] my-2 mx-3" />
            {secondaryItems.map((item) => {
              const isActive =
                pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-neutral-100 dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-300"
                      : "text-neutral-400 dark:text-neutral-500 hover:bg-neutral-50 dark:hover:bg-white/[0.04] hover:text-neutral-600 dark:hover:text-neutral-400"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-100 dark:border-white/[0.04] space-y-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider truncate">{email}</p>
            <p className="text-[10px] text-neutral-300 dark:text-neutral-600 capitalize">{role}</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle size="sm" />
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
