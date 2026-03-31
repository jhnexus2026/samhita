"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Mic, 
  ExternalLink,
  ChevronRight,
  Stethoscope
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface PatientCardProps {
  document: any;
  alerts: any[];
}

export function PatientCard({ document, alerts }: PatientCardProps) {
  const patientAlerts = alerts.filter(a => a.document_id === document.id);
  const hasCritical = patientAlerts.some(a => a.severity === "high" || a.severity === "critical");
  const hasModerate = patientAlerts.some(a => a.severity === "medium");
  
  const severity = hasCritical ? "critical" : hasModerate ? "moderate" : "stable";
  
  const severityConfig: Record<string, { color: string, bg: string, label: string, icon: any }> = {
    critical: { 
      color: "text-red-700 dark:text-red-400", 
      bg: "bg-red-50 dark:bg-red-500/10", 
      label: "High Risk", 
      icon: AlertCircle 
    },
    moderate: { 
      color: "text-amber-700 dark:text-amber-400", 
      bg: "bg-amber-50 dark:bg-amber-500/10", 
      label: "Moderate Risk", 
      icon: Clock 
    },
    stable: { 
      color: "text-emerald-700 dark:text-emerald-400", 
      bg: "bg-emerald-50 dark:bg-emerald-500/10", 
      label: "Stable", 
      icon: CheckCircle2 
    }
  };

  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden border-neutral-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-lg transition-all">
        <CardContent className="p-0">
          <div className={`p-4 ${config.bg} border-b border-neutral-100 dark:border-white/5 flex justify-between items-start`}>
            <div className="flex gap-3">
              <div className={`h-10 w-10 rounded-xl ${config.bg} border border-white dark:border-white/10 shadow-sm flex items-center justify-center shrink-0`}>
                <Stethoscope className={`h-5 w-5 ${config.color}`} />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-white leading-tight">
                  {document.patient_name || "Unknown Patient"}
                </h3>
                <div className="mt-0.5 space-y-0.5">
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-tight">ID: #PAT-{document.id.toString().padStart(4, '0')}</p>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium truncate max-w-[160px]" title={document.filename}>📄 {document.filename}</p>
                </div>
              </div>
            </div>
            <Badge variant="outline" className={`${config.bg} ${config.color} border-current text-[10px] uppercase tracking-wider font-bold h-6`}>
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          </div>

          <div className="p-4 space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-neutral-50 dark:bg-white/5 p-2 rounded-lg text-center">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold">Confidence</p>
                <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{(document.confidence_score * 100).toFixed(0)}%</p>
              </div>
              <div className="bg-neutral-50 dark:bg-white/5 p-2 rounded-lg text-center">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold">Alerts</p>
                <p className={`text-sm font-semibold ${patientAlerts.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-700 dark:text-neutral-200'}`}>
                  {patientAlerts.length}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Link href={`/chatbot?id=${document.id}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 h-9">
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
                  Chat
                </Button>
              </Link>
              <Link href={`/voice?id=${document.id}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 h-9">
                  <Mic className="h-3.5 w-3.5 text-rose-500" />
                  Voice
                </Button>
              </Link>
            </div>

            <Link href={`/review/${document.id}`} className="block w-full">
              <Button variant="default" size="sm" className="w-full text-xs gap-1.5 h-9 bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100">
                View Documentation
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
