"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDocument, getExportUrl, retryDocument } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileJson, FileSpreadsheet, FileText, RotateCcw, BookOpen } from "lucide-react";
import ChatDrawer from "@/components/ChatDrawer";
import { VoiceMic } from "@/components/VoiceMic";
import { DocumentPreview } from "@/components/DocumentPreview";

export default function DocumentDetailPage() {
  const params = useParams();
  const docId = Number(params.id);
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) return;
    getDocument(docId)
      .then(setDoc)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [docId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Document not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{doc.filename}</h1>
          <p className="text-muted-foreground">
            Document #{doc.id} &middot; {doc.page_count} page(s) &middot;
            Confidence: {(doc.confidence_score * 100).toFixed(0)}%
          </p>
          {doc.error_message && (
            <p className="text-sm text-red-500 mt-1">Error: {doc.error_message}</p>
          )}
        </div>
        <div className="flex gap-2">
          {doc.status === "error" && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await retryDocument(doc.id);
                  window.location.reload();
                } catch (e) {
                  console.error("Retry failed:", e);
                }
              }}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Retry
            </Button>
          )}
          {(doc.status === "done" || doc.status === "needs_review") && (
            <>
              <a href={getExportUrl("fhir", doc.id)} target="_blank">
                <Button variant="outline" size="sm">
                  <FileJson className="h-4 w-4 mr-1" /> FHIR JSON
                </Button>
              </a>
              <a href={getExportUrl("fhir-pdf", doc.id)} target="_blank">
                <Button variant="outline" size="sm">
                  <BookOpen className="h-4 w-4 mr-1" /> FHIR PDF
                </Button>
              </a>
              <a href={getExportUrl("ayushman", doc.id)} target="_blank">
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-1" /> PMJAY Preauth
                </Button>
              </a>
              <a href={getExportUrl("csv", doc.id)} target="_blank">
                <Button variant="outline" size="sm">
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
                </Button>
              </a>
              <a href={getExportUrl("pdf", doc.id)} target="_blank">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" /> Summary PDF
                </Button>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Split Panel: Document Preview + Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Document Image Preview */}
        <DocumentPreview
          pageImages={doc.page_images || []}
          filename={doc.filename}
        />

        {/* Right: Extracted Data */}
        <Tabs defaultValue="entities">
          <TabsList>
            <TabsTrigger value="entities">Entities ({doc.entities?.length || 0})</TabsTrigger>
            <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
            <TabsTrigger value="fhir">FHIR Bundle</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          </TabsList>

          <TabsContent value="entities" className="mt-4">
            <Card>
              <CardContent className="p-4 max-h-[65vh] overflow-auto">
                {doc.entities?.length > 0 ? (
                  <div className="space-y-2">
                    {doc.entities.map((e: any) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{e.entity_type}</Badge>
                            {e.negated && <Badge variant="secondary">NEGATED</Badge>}
                            <span className="text-sm font-medium">{e.entity_text}</span>
                          </div>
                          {e.normalized_value && (
                            <p className="text-xs text-muted-foreground">
                              {e.normalized_value}
                            </p>
                          )}
                          {e.coded_value && (
                            <p className="text-xs font-mono">
                              {e.code_system}: {e.coded_value}
                              {e.code_description && ` — ${e.code_description}`}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-sm font-medium ${
                              e.confidence >= 0.85
                                ? "text-green-600"
                                : e.confidence >= 0.5
                                ? "text-orange-500"
                                : "text-red-500"
                            }`}
                          >
                            {(e.confidence * 100).toFixed(0)}%
                          </span>
                          {e.needs_review && (
                            <p className="text-xs text-orange-500">Needs review</p>
                          )}
                          {e.reviewer_approved === true && (
                            <p className="text-xs text-green-600">Approved</p>
                          )}
                          {e.reviewer_approved === false && (
                            <p className="text-xs text-red-500">Rejected</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No entities extracted yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="extracted" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <pre className="text-xs overflow-auto max-h-[600px] whitespace-pre-wrap bg-muted p-4 rounded-lg">
                  {doc.extracted_data
                    ? JSON.stringify(doc.extracted_data, null, 2)
                    : "No extraction data available."}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fhir" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <pre className="text-xs overflow-auto max-h-[600px] whitespace-pre-wrap bg-muted p-4 rounded-lg">
                  {doc.fhir_bundle
                    ? JSON.stringify(doc.fhir_bundle, null, 2)
                    : "FHIR bundle not generated yet."}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation" className="mt-4">
            <Card>
              <CardContent className="p-4">
                {doc.reconciliation_alerts?.length > 0 ? (
                  <div className="space-y-3">
                    {doc.reconciliation_alerts.map((alert: any, i: number) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border-l-4 ${
                          alert.alert_type === "MISSED_CHARGE"
                            ? "border-l-orange-500 bg-orange-50"
                            : alert.alert_type === "PHANTOM_BILLING"
                            ? "border-l-red-500 bg-red-50"
                            : "border-l-yellow-500 bg-yellow-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{alert.alert_type}</Badge>
                          <Badge variant="outline">{alert.severity}</Badge>
                        </div>
                        <p className="text-sm">{alert.description}</p>
                        {alert.estimated_impact > 0 && (
                          <p className="text-sm font-bold text-green-700 mt-1">
                            Estimated Impact: ₹{alert.estimated_impact.toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No reconciliation alerts.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ChatDrawer documentId={docId} />
      <VoiceMic documentId={docId} />
    </div>
  );
}
