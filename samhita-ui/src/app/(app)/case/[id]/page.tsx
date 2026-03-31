"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getCase,
  getCaseHistory,
  getClaimProbability,
  getBills,
  getSettlement,
  advanceCase,
  getCasePdfUrl,
  getCaseTat,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  Clock,
  ChevronRight,
  FileText,
  IndianRupee,
  AlertTriangle,
  Download,
  ArrowRight,
  TrendingUp,
  Shield,
  User,
  Calendar,
  Briefcase,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const WORKFLOW_STAGES = [
  "PreAuth", "Submission", "QueryHandling", "Approval", "Admission",
  "BillGeneration", "Enhancement", "Discharge", "Settlement",
  "Reconciliation", "Closure",
];

const STAGE_ICONS: Record<string, string> = {
  PreAuth: "shield", Submission: "send", QueryHandling: "help",
  Approval: "check", Admission: "building", BillGeneration: "receipt",
  Enhancement: "plus", Discharge: "logout", Settlement: "banknote",
  Reconciliation: "scale", Closure: "archive",
};

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = Number(params.id);
  const [caseData, setCaseData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [probability, setProbability] = useState<any>(null);
  const [bills, setBills] = useState<any>(null);
  const [settlement, setSettlement] = useState<any>(null);
  const [tat, setTat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  const fetchAll = async () => {
    try {
      const [c, h, p, b, s, t] = await Promise.all([
        getCase(caseId).catch(() => null),
        getCaseHistory(caseId).catch(() => ({ transitions: [] })),
        getClaimProbability(caseId).catch(() => null),
        getBills(caseId).catch(() => null),
        getSettlement(caseId).catch(() => null),
        getCaseTat(caseId).catch(() => null),
      ]);
      setCaseData(c);
      setHistory(h?.transitions || []);
      setProbability(p);
      setBills(b);
      setSettlement(s);
      setTat(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) fetchAll();
  }, [caseId]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-10 bg-neutral-200 dark:bg-slate-800 rounded-xl w-80" />
        <div className="h-20 bg-neutral-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-96 bg-neutral-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  if (!caseData) {
    return <div className="p-6 text-center text-neutral-400">Case not found.</div>;
  }

  const currentStageIdx = WORKFLOW_STAGES.indexOf(caseData.current_stage);

  const handleAdvance = async (toStage: string) => {
    setAdvancing(true);
    try {
      await advanceCase(caseId, toStage);
      await fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to advance case");
    } finally {
      setAdvancing(false);
    }
  };

  // Find next valid stage
  const nextStageIdx = currentStageIdx + 1;
  const nextStage = nextStageIdx < WORKFLOW_STAGES.length ? WORKFLOW_STAGES[nextStageIdx] : null;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-neutral-50/50 dark:bg-slate-950/50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/dashboard" className="text-neutral-400 hover:text-neutral-600 text-sm">
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3 text-neutral-300" />
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">
              {caseData.case_number}
            </h1>
            <Badge
              className={`text-xs uppercase tracking-wider font-bold ${
                caseData.status === "active"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {caseData.status}
            </Badge>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400">
            <span className="font-medium">{caseData.patient?.name}</span>
            {caseData.patient?.age && ` • ${caseData.patient.age}`}
            {caseData.patient?.gender && ` • ${caseData.patient.gender}`}
            {caseData.tpa_name && ` • ${caseData.tpa_name}`}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <a href={getCasePdfUrl(caseId, "pre_auth")} target="_blank">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Pre-Auth PDF
            </Button>
          </a>
          <a href={getCasePdfUrl(caseId, "bill_summary")} target="_blank">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Bill PDF
            </Button>
          </a>
          {nextStage && caseData.status === "active" && (
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => handleAdvance(nextStage)}
              disabled={advancing}
            >
              Advance to {nextStage.replace(/([A-Z])/g, " $1").trim()}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Timeline Stepper */}
      <Card className="border-neutral-200 dark:border-white/10 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {WORKFLOW_STAGES.map((stage, idx) => {
              const isPast = idx < currentStageIdx;
              const isCurrent = idx === currentStageIdx;
              const isFuture = idx > currentStageIdx;
              const hasTransition = history.some(t => t.to_stage === stage);

              return (
                <div key={stage} className="flex items-center shrink-0">
                  <div className="flex flex-col items-center">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCurrent
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-100 dark:ring-indigo-500/20"
                          : isPast
                          ? "bg-emerald-500 text-white"
                          : "bg-neutral-200 dark:bg-slate-700 text-neutral-400"
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <p
                      className={`mt-1 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${
                        isCurrent
                          ? "text-indigo-600 dark:text-indigo-400"
                          : isPast
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-neutral-400"
                      }`}
                    >
                      {stage.replace(/([A-Z])/g, " $1").trim()}
                    </p>
                  </div>
                  {idx < WORKFLOW_STAGES.length - 1 && (
                    <div
                      className={`h-0.5 w-8 mx-1 mt-[-16px] ${
                        isPast ? "bg-emerald-400" : "bg-neutral-200 dark:bg-slate-700"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Case Info + Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-neutral-200 dark:border-white/10">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Stage</p>
                <p className="text-sm font-bold text-neutral-900 dark:text-white mt-1">
                  {caseData.current_stage?.replace(/([A-Z])/g, " $1").trim()}
                </p>
              </CardContent>
            </Card>
            <Card className="border-neutral-200 dark:border-white/10">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Approved</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {caseData.pre_auth?.approved_amount
                    ? `INR ${caseData.pre_auth.approved_amount.toLocaleString("en-IN")}`
                    : "—"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-neutral-200 dark:border-white/10">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Billed</p>
                <p className="text-sm font-bold text-violet-600 dark:text-violet-400 mt-1">
                  {bills?.total_billed
                    ? `INR ${bills.total_billed.toLocaleString("en-IN")}`
                    : "—"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-neutral-200 dark:border-white/10">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Utilization</p>
                <p className={`text-sm font-bold mt-1 ${
                  (bills?.utilization_pct || 0) > 90
                    ? "text-red-600"
                    : (bills?.utilization_pct || 0) > 70
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}>
                  {bills?.utilization_pct ? `${bills.utilization_pct}%` : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Case Details</TabsTrigger>
              <TabsTrigger value="bills">Bills ({bills?.bills?.length || 0})</TabsTrigger>
              <TabsTrigger value="documents">Documents ({caseData.documents?.length || 0})</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-4">
              <Card className="border-neutral-200 dark:border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-neutral-500">Patient Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-neutral-400">Name:</span> <span className="font-medium text-neutral-900 dark:text-white">{caseData.patient?.name}</span></div>
                  <div><span className="text-neutral-400">Age:</span> <span className="font-medium">{caseData.patient?.age || "—"}</span></div>
                  <div><span className="text-neutral-400">Gender:</span> <span className="font-medium">{caseData.patient?.gender || "—"}</span></div>
                  <div><span className="text-neutral-400">Hospital ID:</span> <span className="font-medium">{caseData.patient?.patient_id_external || "—"}</span></div>
                  <div><span className="text-neutral-400">ABHA ID:</span> <span className="font-medium">{caseData.patient?.abha_id || "—"}</span></div>
                </CardContent>
              </Card>

              <Card className="border-neutral-200 dark:border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-neutral-500">Insurance & Clinical</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-neutral-400">TPA:</span> <span className="font-medium">{caseData.tpa_name || "—"}</span></div>
                  <div><span className="text-neutral-400">Policy #:</span> <span className="font-medium">{caseData.policy_number || "—"}</span></div>
                  <div><span className="text-neutral-400">Insurer:</span> <span className="font-medium">{caseData.insurance_company || "—"}</span></div>
                  <div><span className="text-neutral-400">Diagnosis:</span> <span className="font-medium">{caseData.primary_diagnosis || "—"}</span></div>
                  <div><span className="text-neutral-400">Procedure:</span> <span className="font-medium">{caseData.primary_procedure || "—"}</span></div>
                  <div><span className="text-neutral-400">Admission:</span> <span className="font-medium">{caseData.admission_date ? new Date(caseData.admission_date).toLocaleDateString("en-IN") : "—"}</span></div>
                  <div><span className="text-neutral-400">Discharge:</span> <span className="font-medium">{caseData.discharge_date ? new Date(caseData.discharge_date).toLocaleDateString("en-IN") : "—"}</span></div>
                </CardContent>
              </Card>

              {caseData.pre_auth && (
                <Card className="border-neutral-200 dark:border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-neutral-500">Pre-Authorization</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-neutral-400">Requested:</span> <span className="font-medium">INR {(caseData.pre_auth.requested_amount || 0).toLocaleString("en-IN")}</span></div>
                    <div><span className="text-neutral-400">Approved:</span> <span className="font-bold text-emerald-600">{caseData.pre_auth.approved_amount ? `INR ${caseData.pre_auth.approved_amount.toLocaleString("en-IN")}` : "Pending"}</span></div>
                    <div><span className="text-neutral-400">Status:</span> <Badge className="text-xs">{caseData.pre_auth.approval_status}</Badge></div>
                    <div><span className="text-neutral-400">Reference:</span> <span className="font-medium">{caseData.pre_auth.approval_reference || "—"}</span></div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="bills" className="mt-4">
              <Card className="border-neutral-200 dark:border-white/10">
                <CardContent className="p-4">
                  {bills?.bills?.length > 0 ? (
                    <div className="space-y-4">
                      {bills.bills.map((bill: any) => (
                        <div key={bill.id} className="border border-neutral-100 dark:border-white/5 rounded-xl p-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{bill.bill_number}</span>
                              <Badge variant="outline" className="text-[10px]">{bill.bill_type}</Badge>
                              <Badge variant="outline" className="text-[10px]">{bill.status}</Badge>
                            </div>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              INR {bill.total_amount.toLocaleString("en-IN")}
                            </span>
                          </div>
                          {bill.items?.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {bill.items.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs text-neutral-500">
                                  <span>{item.description} {item.code && `(${item.code})`} x{item.quantity}</span>
                                  <span>INR {item.amount.toLocaleString("en-IN")}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-neutral-400 py-8">No bills created yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card className="border-neutral-200 dark:border-white/10">
                <CardContent className="p-4">
                  {caseData.documents?.length > 0 ? (
                    <div className="space-y-2">
                      {caseData.documents.map((doc: any) => (
                        <Link
                          key={doc.id}
                          href={`/documents/${doc.id}`}
                          className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-neutral-400" />
                            <div>
                              <p className="text-sm font-medium">{doc.filename}</p>
                              <p className="text-[10px] text-neutral-400 uppercase">{doc.doc_type} • {doc.status}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-bold ${
                              (doc.confidence_score || 0) >= 0.85 ? "text-emerald-600" :
                              (doc.confidence_score || 0) >= 0.5 ? "text-amber-600" : "text-red-500"
                            }`}>
                              {((doc.confidence_score || 0) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-neutral-400 py-8">No documents attached.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card className="border-neutral-200 dark:border-white/10">
                <CardContent className="p-4">
                  {history.length > 0 ? (
                    <div className="space-y-3">
                      {history.map((t: any, i: number) => (
                        <div key={i} className="flex gap-3 items-start">
                          <div className="mt-1 h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                            <ArrowRight className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-sm">
                              <span className="font-medium">{t.from_stage}</span>
                              <span className="text-neutral-400 mx-2">&rarr;</span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">{t.to_stage}</span>
                            </p>
                            <p className="text-[10px] text-neutral-400">
                              {t.action} • by {t.performed_by} • {t.created_at ? new Date(t.created_at).toLocaleString("en-IN") : ""}
                            </p>
                            {t.notes && <p className="text-xs text-neutral-500 mt-0.5">{t.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-neutral-400 py-8">No transitions recorded.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Claim Probability */}
          {probability && (
            <Card className="border-neutral-200 dark:border-white/10 overflow-hidden">
              <div className={`p-4 ${
                probability.probability >= 75
                  ? "bg-emerald-50 dark:bg-emerald-500/5"
                  : probability.probability >= 50
                  ? "bg-amber-50 dark:bg-amber-500/5"
                  : "bg-red-50 dark:bg-red-500/5"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Claim Probability</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className={`text-4xl font-black ${
                    probability.probability >= 75
                      ? "text-emerald-600 dark:text-emerald-400"
                      : probability.probability >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {probability.probability}%
                  </span>
                  <Badge className="text-[10px] mb-1">{probability.probability_label}</Badge>
                </div>
              </div>
              {probability.suggestions?.length > 0 && (
                <CardContent className="p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Improve Probability</p>
                  {probability.suggestions.map((s: any, i: number) => (
                    <div key={i} className="flex gap-2 items-start text-xs">
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-neutral-700 dark:text-neutral-300">{s.action} <span className="text-red-500 font-bold">{s.impact}</span></p>
                        <p className="text-neutral-400 text-[10px]">{s.tip}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* TAT Tracking */}
          {tat && (
            <Card className="border-neutral-200 dark:border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" /> Turnaround Time
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Total TAT</span>
                  <span className="font-bold">{tat.total_tat_days} days</span>
                </div>
                {tat.overdue_count > 0 && (
                  <div className="flex items-center gap-1 text-red-500 text-xs font-bold">
                    <AlertTriangle className="h-3 w-3" />
                    {tat.overdue_count} stage(s) overdue
                  </div>
                )}
                <div className="space-y-1 mt-2">
                  {tat.stages?.slice(-5).map((s: any, i: number) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className={s.overdue ? "text-red-500 font-medium" : "text-neutral-500"}>
                        {s.stage}
                      </span>
                      <span className={s.overdue ? "text-red-500 font-bold" : "text-neutral-400"}>
                        {s.duration_hours < 24
                          ? `${s.duration_hours}h`
                          : `${(s.duration_hours / 24).toFixed(1)}d`}
                        {s.overdue && " !!"}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Settlement Summary */}
          {settlement?.settlements?.length > 0 && (
            <Card className="border-neutral-200 dark:border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-2">
                  <IndianRupee className="h-3.5 w-3.5" /> Settlement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {settlement.settlements.map((s: any) => (
                  <div key={s.id} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Billed</span>
                      <span>INR {s.billed_amount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Settled</span>
                      <span className="font-bold text-emerald-600">INR {s.settled_amount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Deductions</span>
                      <span className="text-red-500">INR {s.total_deductions.toLocaleString("en-IN")}</span>
                    </div>
                    {s.deductions?.length > 0 && (
                      <div className="mt-1 pl-2 border-l-2 border-neutral-100 dark:border-white/5 space-y-0.5">
                        {s.deductions.map((d: any, i: number) => (
                          <div key={i} className="flex justify-between text-[10px] text-neutral-400">
                            <span>{d.reason}</span>
                            <span>-{d.amount.toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
