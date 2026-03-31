"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getDocuments, chatWithPatient, textToSpeech } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  MessageCircle,
  Loader2,
  Bot,
  User,
  Sparkles,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatbotPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-neutral-400">Loading...</div>}>
      <ChatbotContent />
    </Suspense>
  );
}

function ChatbotContent() {
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDocuments()
      .then((data) => {
        const docs = (data.documents || []).filter(
          (d: any) => d.status === "done" || d.status === "needs_review"
        );
        setDocuments(docs);
        // Auto-select from URL param (e.g. /chatbot?id=3)
        const idParam = searchParams.get("id");
        if (idParam) {
          const id = Number(idParam);
          if (docs.some((d: any) => d.id === id)) {
            setSelectedDocId(id);
          }
        }
      })
      .catch(console.error);
  }, [searchParams]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !selectedDocId) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const data = await chatWithPatient(selectedDocId, input.trim(), history);
      const reply = data.reply;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply },
      ]);
      
      // Voice chat responds back in voice as well
      try {
        const ttsResult = await textToSpeech(reply, "en-IN"); // Defaulting to en-IN for text chat
        if (ttsResult.audio) {
          const audioBytes = Uint8Array.from(atob(ttsResult.audio), (c) => c.charCodeAt(0));
          const audioBlob = new Blob([audioBytes], { type: "audio/wav" });
          const url = URL.createObjectURL(audioBlob);
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          audio.play().catch(e => console.warn("Auto-play prevented", e));
        }
      } catch (err) {
        console.warn("TTS playback failed:", err);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="p-6 h-[calc(100vh-0px)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start gap-4 mb-2">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">Samhita AI Chatbot</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
              Ask questions about any patient&apos;s clinical records
            </p>
          </div>
        </div>
      </div>

      {/* Patient Selector */}
      <Card className="mb-4 border-violet-200 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-500/5">
        <CardContent className="py-3 flex items-center gap-4">
          <Sparkles className="h-5 w-5 text-violet-600 shrink-0" />
          <div className="flex-1">
            <label className="text-xs font-medium text-violet-700 dark:text-violet-400 uppercase tracking-wide">
              Select Patient Record
            </label>
            <select
              className="mt-1 block w-full rounded-lg border-violet-200 dark:border-violet-500/20 bg-white dark:bg-slate-900 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:ring-violet-500 text-neutral-900 dark:text-white"
              value={selectedDocId ?? ""}
              onChange={(e) => {
                setSelectedDocId(Number(e.target.value) || null);
                setMessages([]);
              }}
            >
              <option value="">— Choose a processed document —</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  #{doc.id} — {doc.filename} (
                  {(doc.confidence_score * 100).toFixed(0)}% confidence)
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {!selectedDocId && (
              <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                <div>
                  <Bot className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Select a patient above</p>
                  <p className="text-sm mt-1">
                    I&apos;ll answer questions about their diagnoses,
                    medications, lab results, and billing.
                  </p>
                </div>
              </div>
            )}

            {selectedDocId && messages.length === 0 && !loading && (
              <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                <div>
                  <Bot className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">
                    Chatting about: {selectedDoc?.filename}
                  </p>
                  <p className="text-sm mt-2">
                    Try asking:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3 justify-center">
                    {[
                      "What are the diagnoses?",
                      "Summarize this patient",
                      "Any billing issues?",
                      "List all medications",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setInput(q);
                        }}
                        className="text-xs bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 px-3 py-1.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-500/20 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white"
                        : "bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-neutral-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center shrink-0 mt-1">
                      <User className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-neutral-100 dark:bg-white/10 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="border-t border-neutral-200 dark:border-white/10 p-4 flex gap-3 items-end bg-white dark:bg-slate-900 transition-colors duration-300">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedDocId
                  ? "Ask about this patient..."
                  : "Select a patient first..."
              }
              disabled={!selectedDocId}
              rows={1}
              className="min-h-[44px] max-h-[120px] resize-none"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || loading || !selectedDocId}
              className="bg-violet-600 hover:bg-violet-700 shrink-0 h-11 w-11"
              size="icon"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
