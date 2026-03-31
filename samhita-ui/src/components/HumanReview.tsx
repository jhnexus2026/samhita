"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface HumanReviewProps {
  document: {
    id: number;
    filename: string;
    original_path: string;
    confidence_score: number;
  };
  entities: Array<{
    id: number;
    entity_text: string;
    entity_type: string;
    normalized_value: string;
    coded_value: string;
    code_system: string;
    code_description: string;
    confidence: number;
    negated: boolean;
  }>;
  onApprove: (entityId: number) => void;
  onReject: (entityId: number) => void;
}

const entityTypeColors: Record<string, string> = {
  DIAGNOSIS: "bg-red-100 text-red-800",
  PROCEDURE: "bg-blue-100 text-blue-800",
  MEDICATION: "bg-purple-100 text-purple-800",
  LAB_TEST: "bg-green-100 text-green-800",
  VITAL: "bg-cyan-100 text-cyan-800",
  DEMOGRAPHIC: "bg-gray-100 text-gray-800",
};

export function HumanReview({
  document,
  entities,
  onApprove,
  onReject,
}: HumanReviewProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            {document.filename}
          </CardTitle>
          <Badge variant="outline" className="bg-orange-100 text-orange-800">
            {entities.length} items to review
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Document confidence: {(document.confidence_score * 100).toFixed(0)}%
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entities.map((entity) => (
            <div
              key={entity.id}
              className="flex items-start gap-4 p-3 rounded-lg border bg-card"
            >
              {/* Entity Info */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    className={entityTypeColors[entity.entity_type] || ""}
                    variant="outline"
                  >
                    {entity.entity_type}
                  </Badge>
                  {entity.negated && (
                    <Badge variant="outline" className="bg-gray-100">
                      NEGATED
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {(entity.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <p className="text-sm font-medium">{entity.entity_text}</p>
                {entity.normalized_value && (
                  <p className="text-xs text-muted-foreground">
                    Normalized: {entity.normalized_value}
                  </p>
                )}
                {entity.coded_value && (
                  <p className="text-xs">
                    <span className="font-mono bg-muted px-1 rounded">
                      {entity.code_system}: {entity.coded_value}
                    </span>
                    {entity.code_description && (
                      <span className="text-muted-foreground ml-1">
                        — {entity.code_description}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 hover:bg-green-50"
                  onClick={() => onApprove(entity.id)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => onReject(entity.id)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
