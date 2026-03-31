"use client";

import { useEffect, useState } from "react";
import { getAlerts, acknowledgeAlert } from "@/lib/api";
import { AlertBanner } from "@/components/AlertBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Bell, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const data = await getAlerts();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const unacknowledged = alerts.filter((a) => !a.acknowledged);
  const acknowledged = alerts.filter((a) => a.acknowledged);

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
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
            <Bell className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">Patient Alerts</h1>
            <p className="text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
              Critical and serious findings requiring acknowledgement
            </p>
          </div>
        </div>

        {/* Alert counts */}
        <div className="flex gap-2">
          {unacknowledged.length > 0 && (
            <Badge className="bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20 font-bold px-3 py-1 h-auto">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {unacknowledged.length} active
            </Badge>
          )}
          {acknowledged.length > 0 && (
            <Badge variant="secondary" className="font-bold px-3 py-1 h-auto">
              <UserCheck className="h-3 w-3 mr-1" />
              {acknowledged.length} resolved
            </Badge>
          )}
        </div>
      </motion.div>

      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-32"
        >
          <div className="relative">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-neutral-200 dark:border-white/10 border-t-red-500 dark:border-t-red-400" />
          </div>
          <p className="mt-4 text-sm text-neutral-400 dark:text-neutral-500 font-medium">Scanning for alerts...</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {unacknowledged.length > 0 && (
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-sm font-black text-red-700 dark:text-red-400 uppercase tracking-wider">
                  Unacknowledged ({unacknowledged.length})
                </h2>
              </div>
              <AlertBanner alerts={unacknowledged} onRefresh={fetchAlerts} />
            </div>
          )}

          {unacknowledged.length === 0 && (
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
                No active alerts. Critical and high-severity patient findings will appear here in real-time.
              </p>
            </motion.div>
          )}

          {acknowledged.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                Acknowledged ({acknowledged.length})
              </h2>
              <AnimatePresence>
                {acknowledged.map((alert) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="opacity-60 hover:opacity-80 transition-opacity border-neutral-200 dark:border-white/10">
                      <CardContent className="flex items-center gap-4 py-3">
                        <Badge variant="outline" className="text-xs">{alert.severity}</Badge>
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{alert.patient_name}</span>
                        <span className="text-xs text-neutral-400 dark:text-neutral-500 ml-auto">
                          Acknowledged by {alert.acknowledged_by} at{" "}
                          {new Date(alert.acknowledged_at).toLocaleString()}
                        </span>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
