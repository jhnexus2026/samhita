"use client";

import { UploadZone } from "@/components/UploadZone";
import { Upload, Sparkles, FileText, Image, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function UploadPage() {
  return (
    <div className="p-6 space-y-8 min-h-screen bg-neutral-50/50 dark:bg-slate-950/50 transition-colors duration-300">
      {/* Enhanced Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Upload className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">Analyze Documents</h1>
            <p className="text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
              Upload clinical documents for AI-powered extraction and normalization
            </p>
          </div>
        </div>

        {/* Quick stats pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { icon: FileText, label: "PDF", color: "text-red-500 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10" },
            { icon: Image, label: "Images", color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10" },
            { icon: Zap, label: "Raw Text", color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10" },
          ].map((item, i) => (
            <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${item.bg} border border-transparent`}>
              <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
              <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">{item.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Pipeline info strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 dark:from-indigo-500/5 dark:via-violet-500/5 dark:to-purple-500/5 border border-indigo-100 dark:border-indigo-500/10"
      >
        <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
          <span className="font-bold">AI Pipeline:</span>{" "}
          Upload → OCR/Vision → Entity Extraction → Code Normalization (ICD-10, CPT, LOINC) → FHIR R4 Assembly → Revenue Reconciliation
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <UploadZone />
      </motion.div>
    </div>
  );
}
