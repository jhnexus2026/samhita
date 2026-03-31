"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Download, FileJson, FileSpreadsheet, RotateCcw } from "lucide-react";
import { getExportUrl, retryDocument } from "@/lib/api";

const statusColors: Record<string, string> = {
  queued: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  extracting: "bg-blue-100 text-blue-800",
  analyzing: "bg-purple-100 text-purple-800",
  mapping: "bg-indigo-100 text-indigo-800",
  structuring: "bg-cyan-100 text-cyan-800",
  reconciling: "bg-teal-100 text-teal-800",
  done: "bg-green-100 text-green-800",
  needs_review: "bg-orange-100 text-orange-800",
  error: "bg-red-100 text-red-800",
};

interface DocumentQueueProps {
  documents: any[];
  compact?: boolean;
}

export function DocumentQueue({ documents, compact }: DocumentQueueProps) {
  const displayDocs = compact ? documents.slice(0, 5) : documents;

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {displayDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No documents uploaded yet
            </p>
          ) : (
            <div className="space-y-2">
              {displayDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.pipeline_step}
                    </p>
                  </div>
                  <Badge className={statusColors[doc.status] || ""} variant="outline">
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Pages</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No documents yet. Upload a file to get started.
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {doc.filename}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={statusColors[doc.status] || ""}
                      variant="outline"
                    >
                      {doc.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {doc.pipeline_step}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-medium ${
                        doc.confidence_score >= 0.85
                          ? "text-green-600"
                          : doc.confidence_score >= 0.5
                          ? "text-orange-500"
                          : "text-red-500"
                      }`}
                    >
                      {doc.confidence_score
                        ? `${(doc.confidence_score * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell>{doc.page_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {doc.created_at
                      ? new Date(doc.created_at).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/documents/${doc.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {doc.status === "done" || doc.status === "needs_review" ? (
                        <>
                          <a href={getExportUrl("fhir", doc.id)} target="_blank">
                            <Button variant="ghost" size="sm" title="FHIR JSON">
                              <FileJson className="h-4 w-4" />
                            </Button>
                          </a>
                          <a href={getExportUrl("csv", doc.id)} target="_blank">
                            <Button variant="ghost" size="sm" title="CSV">
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                          </a>
                          <a href={getExportUrl("pdf", doc.id)} target="_blank">
                            <Button variant="ghost" size="sm" title="PDF Report">
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        </>
                      ) : null}
                      {doc.status === "error" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Retry"
                          onClick={async () => {
                            try {
                              await retryDocument(doc.id);
                              window.location.reload();
                            } catch (e) {
                              console.error("Retry failed:", e);
                            }
                          }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
