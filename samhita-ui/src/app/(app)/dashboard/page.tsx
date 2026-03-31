"use client";

import { useEffect, useState, useCallback } from "react";
import { getCases, getCaseStats, getDocuments, getAlerts, getMetrics } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  AlertCircle,
  Clock,
  CheckCircle2,
  Search,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  FileText,
  Stethoscope,
  Users,
  Activity,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { PatientCard } from "@/components/dashboard/PatientCard";
import { AlertFeed } from "@/components/dashboard/AlertFeed";
import { useRealtimeTable } from "@/lib/supabase";

// ─── Admin Dashboard (Billing) ────────────────────────────────────────────

const WORKFLOW_STAGES = [
  "PreAuth", "Submission", "QueryHandling", "Approval", "Admission",
  "BillGeneration", "Enhancement", "Discharge", "Settlement",
  "Reconciliation", "Closure",
];

const STAGE_COLORS: Record<string, string> = {
  PreAuth: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  Submission: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  QueryHandling: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  Approval: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  Admission: "bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400",
  BillGeneration: "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  Enhancement: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  Discharge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400",
  Settlement: "bg-lime-100 text-lime-700 dark:bg-lime-500/10 dark:text-lime-400",
  Reconciliation: "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400",
  Closure: "bg-neutral-100 text-neutral-700 dark:bg-neutral-500/10 dark:text-neutral-400",
};

function AdminDashboard() {
  const [cases, setCases] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const fetchData = async () => {
    try {
      const [casesRes, statsRes, metricsRes] = await Promise.all([
        getCases(
          stageFilter !== "all" ? stageFilter : undefined,
          "active",
          search || undefined
        ).catch(() => ({ cases: [], total: 0 })),
        getCaseStats().catch(() => null),
        getMetrics().catch(() => null),
      ]);
      setCases(casesRes.cases || []);
      setStats(statsRes);
      setMetrics(metricsRes);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [stageFilter, search]);

  // Realtime: re-fetch when cases or alerts change
  useRealtimeTable("cases", fetchData);
  useRealtimeTable("patient_alerts", fetchData);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-10 bg-neutral-200 dark:bg-slate-800 rounded-xl w-80" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-neutral-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
        <div className="h-96 bg-neutral-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  const totalActive = stats?.total_active || cases.length;
  const byStage = stats?.by_stage || {};

  return (
    <div className="p-6 space-y-6 min-h-screen bg-neutral-50/50 dark:bg-slate-950/50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">
              Claims Dashboard
            </h1>
            <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-6 px-2 rounded-md">
              LIVE
            </Badge>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 font-medium">
            TPA claims lifecycle management — billing workstation
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3">
          <Card className="px-4 py-2 flex items-center gap-3 border-neutral-200 dark:border-white/10">
            <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-lg">
              <Briefcase className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                Active Cases
              </p>
              <p className="text-lg font-black text-neutral-900 dark:text-white">
                {totalActive}
              </p>
            </div>
          </Card>
          <Card className="px-4 py-2 flex items-center gap-3 border-neutral-200 dark:border-white/10">
            <div className="bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                Pending Approval
              </p>
              <p className="text-lg font-black text-amber-600 dark:text-amber-400">
                {(byStage.PreAuth || 0) + (byStage.Submission || 0)}
              </p>
            </div>
          </Card>
          <Card className="px-4 py-2 flex items-center gap-3 border-neutral-200 dark:border-white/10">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                Settlement
              </p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {byStage.Settlement || 0}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Stage Pipeline */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        <button
          onClick={() => setStageFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
            stageFilter === "all"
              ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-lg"
              : "bg-white dark:bg-slate-900 border border-neutral-200 dark:border-white/10 text-neutral-500"
          }`}
        >
          All ({totalActive})
        </button>
        {WORKFLOW_STAGES.map((stage) => {
          const count = byStage[stage] || 0;
          return (
            <button
              key={stage}
              onClick={() => setStageFilter(stage === stageFilter ? "all" : stage)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                stageFilter === stage
                  ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-lg"
                  : "bg-white dark:bg-slate-900 border border-neutral-200 dark:border-white/10 text-neutral-500 hover:border-indigo-300"
              }`}
            >
              {stage.replace(/([A-Z])/g, " $1").trim()} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search by patient name, case number, or IP number..."
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm outline-none text-neutral-900 dark:text-white placeholder:text-neutral-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Cases Table */}
      <Card className="border-neutral-200 dark:border-white/10 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-white/5 bg-neutral-50 dark:bg-slate-900/50">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Case #</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Patient</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">TPA / Insurer</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Diagnosis</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Stage</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Created</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {cases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-neutral-400">
                        <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>No cases found. Create a new case or adjust your filters.</p>
                      </td>
                    </tr>
                  ) : (
                    cases.map((c: any) => (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-neutral-50 dark:border-white/[0.02] hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-neutral-900 dark:text-white">
                            {c.case_number}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">
                              {c.patient?.name || "—"}
                            </p>
                            <p className="text-[10px] text-neutral-400">
                              {c.patient?.age && `${c.patient.age}`}
                              {c.patient?.gender && ` / ${c.patient.gender}`}
                              {c.patient?.patient_id_external && ` • ${c.patient.patient_id_external}`}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-neutral-600 dark:text-neutral-300">
                            {c.tpa_name || c.insurance_company || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-neutral-600 dark:text-neutral-300 truncate max-w-[200px] block">
                            {c.primary_diagnosis || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={`text-[10px] uppercase tracking-wider font-bold ${
                              STAGE_COLORS[c.current_stage] || "bg-neutral-100 text-neutral-600"
                            }`}
                          >
                            {c.current_stage?.replace(/([A-Z])/g, " $1").trim()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-400">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/case/${c.id}`}>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                              View
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Subtle Clinical Summary */}
      {metrics && (
        <Card className="border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-slate-900/30">
          <CardContent className="py-3 px-5">
            <div className="flex items-center gap-6 text-xs">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Clinical Snapshot</span>
              <div className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-neutral-400" />
                <span className="text-neutral-500">{metrics.total_documents || 0} docs processed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-neutral-400" />
                <span className="text-neutral-500">Avg confidence: {metrics.average_confidence ? `${(metrics.average_confidence * 100).toFixed(0)}%` : "—"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 text-amber-500" />
                <span className="text-amber-600 dark:text-amber-400">{metrics.documents_needs_review || 0} needs review</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Doctor Dashboard (Clinical) ──────────────────────────────────────────

function DoctorDashboard() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [docsRes, alertsRes, statsRes, metricsRes] = await Promise.all([
        getDocuments().catch(() => []),
        getAlerts().catch(() => []),
        getCaseStats().catch(() => null),
        getMetrics().catch(() => null),
      ]);
      const fetchedDocs = Array.isArray(docsRes) ? docsRes : docsRes.documents || [];
      const clinicalDocs = fetchedDocs.filter((d: any) => d.doc_type !== "bill" && d.doc_type !== "pre_auth");
      setDocuments(clinicalDocs);
      setAlerts(Array.isArray(alertsRes) ? alertsRes : alertsRes.alerts || []);
      setStats(statsRes);
      setMetrics(metricsRes);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-10 bg-neutral-200 dark:bg-slate-800 rounded-xl w-80" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-neutral-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
        <div className="h-96 bg-neutral-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  const totalDocs = metrics?.total_documents || documents.length;
  const processing = documents.filter((d: any) => d.status === "processing" || d.status === "extracting" || d.status === "analyzing").length;
  const needsReview = metrics?.documents_needs_review || documents.filter((d: any) => d.status === "needs_review").length;
  const criticalAlerts = alerts.filter((a: any) => !a.acknowledged && (a.severity === "high" || a.severity === "critical")).length;
  const recentDocs = documents.filter((d: any) => d.status === "done" || d.status === "needs_review").slice(0, 8);
  const byStage = stats?.by_stage || {};

  return (
    <div className="p-6 space-y-6 min-h-screen bg-neutral-50/50 dark:bg-slate-950/50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">
              Patient Dashboard
            </h1>
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-6 px-2 rounded-md">
              LIVE
            </Badge>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 font-medium">
            Clinical intelligence — patient monitoring & document analysis
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3">
          <Card className="px-4 py-2 flex items-center gap-3 border-neutral-200 dark:border-white/10">
            <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-lg">
              <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                Total Documents
              </p>
              <p className="text-lg font-black text-neutral-900 dark:text-white">
                {totalDocs}
              </p>
            </div>
          </Card>
          <Card className="px-4 py-2 flex items-center gap-3 border-neutral-200 dark:border-white/10">
            <div className="bg-blue-50 dark:bg-blue-500/10 p-2 rounded-lg">
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                Processing
              </p>
              <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                {processing}
              </p>
            </div>
          </Card>
          <Card className="px-4 py-2 flex items-center gap-3 border-neutral-200 dark:border-white/10">
            <div className="bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg">
              <ClipboardCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                Needs Review
              </p>
              <p className="text-lg font-black text-amber-600 dark:text-amber-400">
                {needsReview}
              </p>
            </div>
          </Card>
          <Card className="px-4 py-2 flex items-center gap-3 border-neutral-200 dark:border-white/10">
            <div className="bg-red-50 dark:bg-red-500/10 p-2 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                Critical Alerts
              </p>
              <p className="text-lg font-black text-red-600 dark:text-red-400">
                {criticalAlerts}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Content: Patients + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Cards (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Recent Patients
            </h2>
            <Link href="/documents">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                View All <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {recentDocs.length === 0 ? (
            <Card className="border-neutral-200 dark:border-white/10">
              <CardContent className="py-16 text-center">
                <Stethoscope className="h-10 w-10 mx-auto mb-2 text-neutral-200 dark:text-neutral-700" />
                <p className="text-neutral-400">No patient documents processed yet. Upload a document to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentDocs.map((doc: any) => (
                <PatientCard key={doc.id} document={doc} alerts={alerts} />
              ))}
            </div>
          )}
        </div>

        {/* Alert Feed (1/3) */}
        <div className="lg:col-span-1">
          <AlertFeed alerts={alerts} />
        </div>
      </div>

      {/* Subtle Claims Pipeline */}
      {stats && (
        <Card className="border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-slate-900/30">
          <CardContent className="py-3 px-5">
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Claims Pipeline</span>
              {WORKFLOW_STAGES.map((stage) => {
                const count = byStage[stage] || 0;
                if (count === 0) return null;
                return (
                  <div key={stage} className="flex items-center gap-1">
                    <span className="text-neutral-400">{stage.replace(/([A-Z])/g, " $1").trim()}:</span>
                    <span className="font-bold text-neutral-600 dark:text-neutral-300">{count}</span>
                  </div>
                );
              })}
              <Link href="/analytics" className="ml-auto">
                <span className="text-indigo-500 hover:text-indigo-600 font-bold flex items-center gap-1">
                  Full Dashboard <ChevronRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const { role } = useAuth();

  if (role === "doctor") {
    return <DoctorDashboard />;
  }

  return <AdminDashboard />;
}
