"use client";

import { useEffect, useState } from "react";
import { getMetrics, getRevenueAnalytics } from "@/lib/api";
import { MetricsPanel } from "@/components/MetricsPanel";
import { RevenuePanel } from "@/components/RevenuePanel";

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [m, r] = await Promise.all([
          getMetrics().catch(() => null),
          getRevenueAnalytics().catch(() => null),
        ]);
        setMetrics(m);
        setRevenue(r);
      } catch (err) {
        console.error(err);
      }
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          System-wide accuracy metrics and revenue analytics
        </p>
      </div>

      <MetricsPanel metrics={metrics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenuePanel revenue={revenue} />
        <div className="space-y-4">
          {metrics && (
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold">System Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total documents</span>
                  <span className="font-medium">{metrics.total_documents}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processed</span>
                  <span className="font-medium">{metrics.documents_processed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average confidence</span>
                  <span className="font-medium">
                    {(metrics.average_confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">High confidence</span>
                  <span className="text-green-600 font-medium">
                    {metrics.high_confidence_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Needs review</span>
                  <span className="text-orange-500 font-medium">
                    {metrics.documents_needs_review}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
