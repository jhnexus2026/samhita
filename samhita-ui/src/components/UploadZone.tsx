"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Image, CheckCircle2, XCircle, Loader2, Type } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { uploadDocument, uploadText } from "@/lib/api";

interface FileUpload {
  file: File | { name: string; size: number; type: string };
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  result?: any;
  error?: string;
}

export function UploadZone() {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [textUploading, setTextUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      status: "pending" as const,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);

    // Upload each file
    newFiles.forEach((fileUpload, index) => {
      const fileIndex = files.length + index;
      uploadFile(fileUpload.file as File, fileIndex);
    });
  }, [files.length]);

  const uploadFile = async (file: File, index: number) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: "uploading", progress: 30 } : f))
    );

    try {
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, progress: 60 } : f))
      );
      const result = await uploadDocument(file);
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "done", progress: 100, result } : f
        )
      );
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, status: "error", error: err.message || "Upload failed" }
            : f
        )
      );
    }
  };

  const handleTextUpload = async () => {
    if (!pastedText.trim()) return;
    
    setTextUploading(true);
    const mockFile = { name: "Pasted_Clinical_Note.txt", size: pastedText.length, type: "text/plain" };
    const newIndex = files.length;
    
    setFiles((prev) => [
      ...prev,
      { file: mockFile, status: "uploading", progress: 50 }
    ]);

    try {
      const result = await uploadText(pastedText);
      setFiles((prev) =>
        prev.map((f, i) =>
          i === newIndex ? { ...f, status: "done", progress: 100, result } : f
        )
      );
      setPastedText(""); // Clear text on success
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === newIndex
            ? { ...f, status: "error", error: err.message || "Upload failed" }
            : f
        )
      );
    } finally {
      setTextUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    multiple: true,
  });

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "done"));
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
          <TabsTrigger value="upload">Upload Documents</TabsTrigger>
          <TabsTrigger value="paste">Paste Raw Text</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Card
              {...getRootProps()}
              className={`cursor-pointer border-2 border-dashed transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <input {...getInputProps()} />
                <motion.div
                  animate={isDragActive ? { y: -10, scale: 1.1 } : { y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                </motion.div>
                <h3 className="text-lg font-semibold">
                  {isDragActive ? "Drop files here" : "Drag & drop hospital documents"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  PDF, PNG, JPG files accepted. Supports discharge summaries, lab reports, prescriptions, bills.
                </p>
                <Button variant="outline" className="mt-4">Browse Files</Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="paste">
          <Card className="border-2 border-muted">
            <CardContent className="flex flex-col py-6 gap-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Type className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Instant Clinical Processing (Bypasses OCR)</h3>
              </div>
              <Textarea 
                placeholder="Paste raw doctor's notes, clinical history, or unformatted text here. This routes directly to the high-speed NLP engine for instant results..."
                className="min-h-[200px] resize-y font-mono text-sm"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
              <div className="flex justify-end">
                <Button onClick={handleTextUpload} disabled={!pastedText.trim() || textUploading}>
                  {textUploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                  ) : (
                    "Process Raw Data"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Processing Queue ({files.filter((f) => f.status === "done").length}/{files.length} complete)
            </h3>
            {files.some((f) => f.status === "done") && (
              <Button variant="ghost" size="sm" onClick={clearCompleted}>
                Clear completed
              </Button>
            )}
          </div>

          <AnimatePresence>
            {files.map((fileUpload, index) => (
              <motion.div
                key={`${fileUpload.file.name}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardContent className="flex items-center gap-4 py-3">
                    {/* Icon */}
                    {fileUpload.file.type === "application/pdf" ? (
                      <FileText className="h-8 w-8 text-red-500 shrink-0" />
                    ) : fileUpload.file.type === "text/plain" ? (
                      <Type className="h-8 w-8 text-indigo-500 shrink-0" />
                    ) : (
                      <Image className="h-8 w-8 text-blue-500 shrink-0" />
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {fileUpload.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(fileUpload.file.size / 1024).toFixed(1)} KB
                      </p>

                      {/* Progress Bar */}
                      {fileUpload.status === "uploading" && (
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${fileUpload.progress}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      )}

                      {/* Result info */}
                      {fileUpload.result && (
                        <p className="text-xs text-green-600 mt-1">
                          Document #{fileUpload.result.id} — {fileUpload.result.page_count} page(s) queued
                          {fileUpload.file.type === "text/plain" && " via high-speed NLP"}
                        </p>
                      )}
                      {fileUpload.error && (
                        <p className="text-xs text-destructive mt-1">{fileUpload.error}</p>
                      )}
                    </div>

                    {/* Status Icon */}
                    {fileUpload.status === "uploading" && (
                      <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                    )}
                    {fileUpload.status === "done" && (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    )}
                    {fileUpload.status === "error" && (
                      <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
