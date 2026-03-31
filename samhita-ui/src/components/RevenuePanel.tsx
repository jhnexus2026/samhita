"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, TrendingUp, AlertCircle } from "lucide-react";

interface RevenuePanelProps {
  revenue: {
    total_missed_revenue: number;
    total_phantom_billed: number;
    net_revenue_impact: number;
    total_alerts: number;
    documents_with_issues: number;
    per_document: any[];
  } | null;
}

export function RevenuePanel({ revenue }: RevenuePanelProps) {
  if (!revenue || revenue.total_alerts === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Revenue Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Revenue data will appear after documents are processed and reconciled.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          Revenue Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main stat */}
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-sm text-green-700">Revenue Recovered</p>
          <p className="text-3xl font-bold text-green-700 flex items-center justify-center">
            <IndianRupee className="h-6 w-6" />
            {revenue.net_revenue_impact.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <p className="text-xs text-orange-700">Missed Charges</p>
            <p className="text-lg font-semibold text-orange-700">
              {revenue.total_missed_revenue.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-xs text-red-700">Phantom Billing</p>
            <p className="text-lg font-semibold text-red-700">
              {revenue.total_phantom_billed.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
          <span className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {revenue.total_alerts} alerts found
          </span>
          <span>{revenue.documents_with_issues} documents affected</span>
        </div>

        {/* Per document breakdown */}
        {revenue.per_document.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Per Document</p>
            {revenue.per_document.slice(0, 5).map((doc: any) => (
              <div
                key={doc.document_id}
                className="flex items-center justify-between text-sm py-1 border-b last:border-0"
              >
                <span className="truncate max-w-[150px]">{doc.filename}</span>
                <span className="text-green-600 font-medium">
                  +{doc.missed_revenue.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
