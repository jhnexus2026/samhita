"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronRight, Bell } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface AlertFeedProps {
  alerts: any[];
}

export function AlertFeed({ alerts }: AlertFeedProps) {
  const criticalAlerts = alerts
    .filter(a => !a.acknowledged)
    .sort((a, b) => (a.severity === "high" || a.severity === "critical" ? -1 : 1));

  return (
    <Card className="h-full flex flex-col border-neutral-200 dark:border-white/10">
      <CardHeader className="py-4 border-b border-neutral-100 dark:border-white/5 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Critical Feed</CardTitle>
        </div>
        <Badge variant="secondary" className="bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 font-bold">
          {criticalAlerts.length}
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <div className="h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-3">
            <AnimatePresence>
              {criticalAlerts.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-neutral-400 dark:text-neutral-500">All clear — no pending alerts.</p>
                </div>
              ) : (
                criticalAlerts.map((alert, i) => (
                  <motion.div
                    key={alert.id || i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link href={`/review/${alert.document_id}`}>
                      <div className={`p-3 rounded-xl border transition-all hover:shadow-md cursor-pointer ${
                        alert.severity === "high" || alert.severity === "critical"
                        ? "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 hover:border-red-300 dark:hover:border-red-500/40"
                        : "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 hover:border-amber-300 dark:hover:border-amber-500/40"
                      }`}>
                        <div className="flex justify-between items-start mb-1">
                          <Badge className={
                            alert.severity === "high" || alert.severity === "critical"
                            ? "bg-red-600 text-white"
                            : "bg-amber-500 text-white"
                          }>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">Recently</span>
                        </div>
                        <p className="text-xs font-bold text-neutral-900 dark:text-white line-clamp-2 mb-2">
                          {alert.title || alert.type}
                        </p>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-2">
                          {alert.description}
                        </p>
                        <div className="mt-2 flex items-center justify-end text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          Review Patient <ChevronRight className="h-3 w-3" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
