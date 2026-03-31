"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle2, AlertTriangle, BarChart3 } from "lucide-react";

interface MetricsPanelProps {
  metrics: {
    total_documents: number;
    documents_processed: number;
    documents_in_queue: number;
    documents_needs_review: number;
    average_confidence: number;
    high_confidence_pct: number;
    medium_confidence_pct: number;
    low_confidence_pct: number;
  } | null;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  const stats = [
    {
      label: "Total Documents",
      value: metrics?.total_documents ?? 0,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Processed",
      value: metrics?.documents_processed ?? 0,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "In Queue",
      value: metrics?.documents_in_queue ?? 0,
      icon: BarChart3,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Needs Review",
      value: metrics?.documents_needs_review ?? 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Confidence Breakdown */}
      {metrics && metrics.average_confidence > 0 && (
        <Card className="col-span-2 md:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Accuracy Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Average Confidence</span>
                  <span className="font-bold">
                    {(metrics.average_confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                  <div
                    className="bg-green-500 h-full"
                    style={{ width: `${metrics.high_confidence_pct}%` }}
                    title={`High: ${metrics.high_confidence_pct}%`}
                  />
                  <div
                    className="bg-orange-400 h-full"
                    style={{ width: `${metrics.medium_confidence_pct}%` }}
                    title={`Medium: ${metrics.medium_confidence_pct}%`}
                  />
                  <div
                    className="bg-red-400 h-full"
                    style={{ width: `${metrics.low_confidence_pct}%` }}
                    title={`Low: ${metrics.low_confidence_pct}%`}
                  />
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    High ({metrics.high_confidence_pct.toFixed(0)}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-orange-400 rounded-full" />
                    Medium ({metrics.medium_confidence_pct.toFixed(0)}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-400 rounded-full" />
                    Low ({metrics.low_confidence_pct.toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
