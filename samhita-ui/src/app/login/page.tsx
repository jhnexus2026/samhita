"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Lock, ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const CREDENTIALS: Record<string, { password: string; role: "doctor" | "admin" }> = {
        "doctor@hospital.org": { password: "doctor123", role: "doctor" },
        "admin@hospital.org": { password: "admin123", role: "admin" },
      };

      const user = CREDENTIALS[email.toLowerCase()];
      if (!user || user.password !== password) {
        setError("Invalid email or password. Try doctor@hospital.org or admin@hospital.org");
        return;
      }

      localStorage.setItem(
        "samhita_auth",
        JSON.stringify({ email: email.toLowerCase(), role: user.role, loggedIn: true })
      );
      router.push("/dashboard");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-neutral-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #4338ca 0%, #6366f1 25%, #7c3aed 50%, #8b5cf6 75%, #4338ca 100%)",
            backgroundSize: "400% 400%",
            animation: "bgGradientShift 12s ease infinite",
          }}
        />
        {/* Noise overlay */}
        <div className="absolute inset-0 opacity-[0.15]" style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        {/* Floating shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-[15%] left-[10%] w-64 h-64 rounded-full bg-white/10 blur-3xl" style={{ animation: "shapeFloat 20s ease-in-out infinite" }} />
          <div className="absolute bottom-[20%] right-[15%] w-80 h-80 rounded-full bg-purple-300/10 blur-3xl" style={{ animation: "shapeFloat2 25s ease-in-out infinite" }} />
          <div className="absolute top-[60%] left-[30%] w-40 h-40 rounded-full bg-indigo-200/10 blur-2xl" style={{ animation: "shapeFloat 18s ease-in-out infinite reverse" }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo */}
          <div>
            <span className="text-2xl font-bold tracking-tighter uppercase">SAMHITA</span>
            <p className="text-sm text-white/60 mt-1">Clinical Intelligence Layer</p>
          </div>

          {/* Hero text */}
          <div className="max-w-md">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-bold tracking-tight leading-tight mb-6"
            >
              Structured data from
              <br />
              unstructured chaos.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-lg text-white/70 leading-relaxed mb-10"
            >
              AI-powered clinical document processing that transforms discharge summaries, handwritten notes, and lab reports into billing-ready data.
            </motion.p>

            {/* Feature pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col gap-3"
            >
              {[
                { icon: Zap, text: "OCR + AI extraction in seconds" },
                { icon: ShieldCheck, text: "Human-in-the-loop verification" },
                { icon: Sparkles, text: "FHIR R4 compliant output" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-white/80">{item.text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Footer */}
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Samhita — Enterprise clinical data intelligence
          </p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/25">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">SAMHITA</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Clinical Intelligence Layer</p>
          </div>

          <Card className="border-neutral-200 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-none bg-white dark:bg-slate-900">
            <CardContent className="p-8">
              <div className="mb-8">
                <div className="hidden lg:flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Welcome back</h1>
                  </div>
                </div>
                <h1 className="lg:hidden text-xl font-bold text-neutral-900 dark:text-white text-center mb-1">Welcome back</h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 lg:ml-[52px]">
                  Sign in to access your clinical workspace
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="billing@hospital.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 bg-neutral-50 dark:bg-slate-800 border-neutral-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 bg-neutral-50 dark:bg-slate-800 border-neutral-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all rounded-xl"
                  />
                </div>
                {error && (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
                    <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/25 rounded-xl transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30 active:scale-[0.98]"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign In <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
                <p className="text-xs text-center text-neutral-400 dark:text-neutral-500 mt-6">
                  Demo: doctor@hospital.org / doctor123 or admin@hospital.org / admin123
                </p>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
