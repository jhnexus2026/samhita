"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatWithPatient, speechToText, textToSpeech } from "@/lib/api";
import { MessageCircle, Send, Mic, MicOff, Volume2, X } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatDrawer({ documentId }: { documentId: number }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (text: string, speakReply = false) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const data = await chatWithPatient(documentId, text.trim(), history);
      const assistantMsg: Message = {
        role: "assistant",
        content: data.reply,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Auto-speak response when triggered by voice input
      if (speakReply && data.reply) {
        speakText(data.reply);
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
      sendMessage(input);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        stream.getTracks().forEach((t) => t.stop());
        try {
          const data = await speechToText(blob);
          if (data.text) {
            // Auto-send the transcribed message and speak the response
            sendMessage(data.text, true);
          }
        } catch {
          // Silently fail — user can type instead
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      // Mic permission denied
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const speakText = async (text: string) => {
    setSpeaking(true);
    try {
      const data = await textToSpeech(text);
      if (data.audio) {
        const audioBytes = Uint8Array.from(atob(data.audio), (c) =>
          c.charCodeAt(0)
        );
        const blob = new Blob([audioBytes], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.play();
      } else {
        setSpeaking(false);
      }
    } catch {
      setSpeaking(false);
    }
  };

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 transition-colors"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex flex-col w-full sm:max-w-md p-0"
          showCloseButton={false}
        >
          <SheetHeader className="border-b px-4 py-3 flex-row items-center justify-between">
            <div>
              <SheetTitle>Samhita AI Chat</SheetTitle>
              <SheetDescription>
                Ask about this patient&apos;s records
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-12">
                <p className="font-medium mb-2">Welcome to Samhita AI</p>
                <p>Ask me about diagnoses, medications, lab results, billing, or anything in this patient&apos;s record.</p>
                <p className="mt-2 text-xs">Supports English and Hindi</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === "assistant" && (
                    <button
                      onClick={() => speakText(msg.content)}
                      disabled={speaking}
                      className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Volume2 className="h-3 w-3 inline mr-1" />
                      {speaking ? "Speaking..." : "Listen"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3 flex gap-2 items-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={recording ? stopRecording : startRecording}
              className={recording ? "text-red-500 animate-pulse" : ""}
            >
              {recording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this patient..."
              rows={1}
              className="min-h-[40px] max-h-[120px] resize-none"
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="bg-violet-600 hover:bg-violet-700 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
