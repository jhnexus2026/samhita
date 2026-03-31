"use client";

import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/lib/auth";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-neutral-50 dark:bg-slate-950 transition-colors duration-300">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen">{children}</main>
      </div>
    </AuthProvider>
  );
}
