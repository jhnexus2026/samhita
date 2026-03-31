"use client";

import { useEffect, useState } from "react";
import { getDocuments } from "@/lib/api";
import { DocumentQueue } from "@/components/DocumentQueue";
import { FileText, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useRealtimeTable } from "@/lib/supabase";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = async () => {
    try {
      const data = await getDocuments();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  // Re-fetch when documents table changes via Supabase Realtime
  useRealtimeTable("documents", fetchDocs);

  const doneCount = documents.filter(d => d.status === "done").length;
  const processingCount = documents.filter(d => d.status === "processing" || d.status === "extracting" || d.status === "mapping" || d.status === "analyzing").length;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-neutral-50/50 dark:bg-slate-950/50 transition-colors duration-300">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">All Documents</h1>
            <p className="text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
              Complete document processing history
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2">
          <Badge className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 font-bold px-3 py-1 h-auto">
            {doneCount} processed
          </Badge>
          {processingCount > 0 && (
            <Badge className="bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20 font-bold px-3 py-1 h-auto">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse mr-1.5" />
              {processingCount} processing
            </Badge>
          )}
          <Badge variant="secondary" className="font-bold px-3 py-1 h-auto">
            {documents.length} total
          </Badge>
        </div>
      </motion.div>

      {/* Content */}
      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-32"
        >
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-neutral-200 dark:border-white/10 border-t-blue-500 dark:border-t-blue-400" />
          <p className="mt-4 text-sm text-neutral-400 dark:text-neutral-500 font-medium">Loading documents...</p>
        </motion.div>
      ) : documents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center py-32"
        >
          <div className="h-20 w-20 rounded-3xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-6">
            <FolderOpen className="h-10 w-10 text-blue-400 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">No documents yet</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-sm">
            Upload a clinical document to get started. Processed documents will appear here with their extraction results.
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <DocumentQueue documents={documents} />
        </motion.div>
      )}
    </div>
  );
}
