"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Siren, UserCheck } from "lucide-react";
import { acknowledgeAlert } from "@/lib/api";

interface AlertBannerProps {
  alerts: Array<{
    id: number;
    document_id: number;
    patient_name: string;
    severity: string;
    flagged_findings: string;
    acknowledged: boolean;
  }>;
  onRefresh: () => void;
}

export function AlertBanner({ alerts, onRefresh }: AlertBannerProps) {
  const handleAcknowledge = async (alertId: number) => {
    try {
      await acknowledgeAlert(alertId);
      onRefresh();
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const isCritical = alert.severity === "critical";
        let findings: string[] = [];
        try {
          findings = JSON.parse(alert.flagged_findings || "[]");
        } catch {
          findings = [];
        }

        return (
          <Card
            key={alert.id}
            className={`border-2 ${
              isCritical
                ? "border-red-500 bg-red-50"
                : "border-orange-400 bg-orange-50"
            }`}
          >
            <CardContent className="flex items-start gap-4 py-4">
              <div
                className={`p-2 rounded-full ${
                  isCritical ? "bg-red-200" : "bg-orange-200"
                }`}
              >
                {isCritical ? (
                  <Siren className="h-6 w-6 text-red-700" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-orange-700" />
                )}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-bold uppercase ${
                      isCritical ? "text-red-700" : "text-orange-700"
                    }`}
                  >
                    {alert.severity} Patient
                  </span>
                  <span className="text-sm font-medium">
                    — {alert.patient_name || "Unknown"}
                  </span>
                </div>
                {findings.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {findings.slice(0, 5).map((finding, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded ${
                          isCritical
                            ? "bg-red-200 text-red-800"
                            : "bg-orange-200 text-orange-800"
                        }`}
                      >
                        {finding}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className={`shrink-0 ${
                  isCritical
                    ? "border-red-500 text-red-700 hover:bg-red-100"
                    : "border-orange-500 text-orange-700 hover:bg-orange-100"
                }`}
                onClick={() => handleAcknowledge(alert.id)}
              >
                <UserCheck className="h-4 w-4 mr-1" />
                Acknowledge
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
