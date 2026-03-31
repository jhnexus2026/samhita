"use client";

import { useEffect, useState } from "react";
import { getReviewQueue, updateEntity } from "@/lib/api";
import { HumanReview } from "@/components/HumanReview";
import { ClipboardCheck, ShieldCheck, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function ReviewPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    try {
      const data = await getReviewQueue();
      setQueue(data.review_queue || []);
    } catch (err) {
      console.error("Failed to fetch review queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleApprove = async (entityId: number) => {
    await updateEntity(entityId, { reviewer_approved: true });
    fetchQueue();
  };

  const handleReject = async (entityId: number) => {
    await updateEntity(entityId, { reviewer_approved: false });
    fetchQueue();
  };

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
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <ClipboardCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">Human Review</h1>
            <p className="text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
              Review and approve low-confidence entity extractions
            </p>
          </div>
        </div>
        {queue.length > 0 && (
          <Badge className="bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 font-bold px-3 py-1 h-auto">
            {queue.length} pending review{queue.length > 1 ? "s" : ""}
          </Badge>
        )}
      </motion.div>

      {/* Content */}
      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-32"
        >
          <div className="relative">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-neutral-200 dark:border-white/10 border-t-indigo-600 dark:border-t-indigo-400" />
          </div>
          <p className="mt-4 text-sm text-neutral-400 dark:text-neutral-500 font-medium">Loading review queue...</p>
        </motion.div>
      ) : queue.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center py-32"
        >
          <div className="h-20 w-20 rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-6">
            <ShieldCheck className="h-10 w-10 text-emerald-500 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">All clear</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-sm">
            No documents need review right now. Documents with confidence below 85% will appear here for verification.
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-6"
        >
          {queue.map((item) => (
            <HumanReview
              key={item.document.id}
              document={item.document}
              entities={item.entities_to_review}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
