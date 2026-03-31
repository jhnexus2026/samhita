"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { API_BASE } from "@/lib/api";

interface DocumentPreviewProps {
  pageImages: string[];
  filename: string;
}

export function DocumentPreview({ pageImages, filename }: DocumentPreviewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(100);

  if (!pageImages || pageImages.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No document preview available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{filename}</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.max(50, z - 25))}
              disabled={zoom <= 50}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              disabled={zoom >= 200}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {pageImages.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {pageImages.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((p) => Math.min(pageImages.length - 1, p + 1))
              }
              disabled={currentPage === pageImages.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-2 overflow-auto" style={{ maxHeight: "70vh", minHeight: "50vh" }}>
        {pageImages[currentPage].endsWith(".txt") ? (
          <iframe
            src={`${API_BASE}${pageImages[currentPage]}`}
            className="w-full h-full min-h-[50vh] bg-white border rounded shadow-sm"
          />
        ) : (
          <img
            src={`${API_BASE}${pageImages[currentPage]}`}
            alt={`Page ${currentPage + 1}`}
            className="mx-auto border rounded shadow-sm transition-all"
            style={{ width: `${zoom}%`, maxWidth: `${zoom}%` }}
          />
        )}
      </CardContent>
    </Card>
  );
}
