"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getDocuments, chatWithPatient, speechToText, textToSpeech } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Loader2,
  Volume2,
  Bot,
  User,
  Sparkles,
  Globe,
  Phone,
  PhoneOff,
  MessageSquare,
  Radio,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  isVoice?: boolean;
}

const LANGUAGES = [
  { code: "hi-IN", label: "हिन्दी (Hindi)" },
  { code: "bho-IN", label: "भोजपुरी (Bhojpuri)" },
  { code: "mai-IN", label: "मैथिली (Maithili)" },
  { code: "mag-IN", label: "मगही (Magahi)" },
  { code: "en-IN", label: "English (India)" },
  { code: "bn-IN", label: "বাংলা (Bengali)" },
  { code: "ta-IN", label: "தமிழ் (Tamil)" },
  { code: "te-IN", label: "తెలుగు (Telugu)" },
  { code: "mr-IN", label: "मराठी (Marathi)" },
  { code: "gu-IN", label: "ગુજરાતી (Gujarati)" },
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)" },
  { code: "ml-IN", label: "മലയാളം (Malayalam)" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)" },
];

// ─── Push-to-Talk Voice Chat Tab ─────────────────────────────────────────────
function VoiceChatTab({
  selectedDocId,
  selectedDoc,
  language,
}: {
  selectedDocId: number | null;
  selectedDoc: any;
  language: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [playing, setPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
  }, [selectedDocId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const startRecording = async () => {
    if (!selectedDocId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        setProcessing(true);
        setProcessingStep("Transcribing your speech...");

        try {
          const sttResult = await speechToText(blob, language);
          const transcript = sttResult.text || "";

          if (!transcript) {
            setProcessing(false);
            setProcessingStep("");
            return;
          }

          setMessages((prev) => [
            ...prev,
            { role: "user", content: transcript, isVoice: true },
          ]);

          setProcessingStep("Thinking...");
          const chatResult = await chatWithPatient(selectedDocId, transcript, []);
          const reply = chatResult.reply || "";

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: reply, isVoice: true },
          ]);

          setProcessingStep("Speaking response...");
          try {
            const ttsResult = await textToSpeech(reply, language);
            if (ttsResult.audio) {
              setPlaying(true);
              const audioBytes = Uint8Array.from(atob(ttsResult.audio), (c) =>
                c.charCodeAt(0)
              );
              const audioBlob = new Blob([audioBytes], { type: "audio/wav" });
              const url = URL.createObjectURL(audioBlob);
              const audio = new Audio(url);
              audio.onended = () => {
                setPlaying(false);
                URL.revokeObjectURL(url);
              };
              await audio.play();
            }
          } catch {
            // TTS is optional
          }
        } catch (err) {
          console.error("Voice pipeline error:", err);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Sorry, I couldn't process that. Please try again.",
            },
          ]);
        } finally {
          setProcessing(false);
          setProcessingStep("");
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const speakMessage = async (text: string) => {
    setPlaying(true);
    try {
      const ttsResult = await textToSpeech(text, language);
      if (ttsResult.audio) {
        const audioBytes = Uint8Array.from(atob(ttsResult.audio), (c) =>
          c.charCodeAt(0)
        );
        const audioBlob = new Blob([audioBytes], { type: "audio/wav" });
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audio.onended = () => {
          setPlaying(false);
          URL.revokeObjectURL(url);
        };
        await audio.play();
      } else {
        setPlaying(false);
      }
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {!selectedDocId && (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <Mic className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a patient above</p>
              <p className="text-sm mt-1">
                Then press the microphone button and speak your question
              </p>
            </div>
          </div>
        )}

        {selectedDocId && messages.length === 0 && !processing && (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <Mic className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">
                Ready: {selectedDoc?.filename}
              </p>
              <p className="text-sm mt-2">
                Press the big microphone button below and ask a question in{" "}
                {LANGUAGES.find((l) => l.code === language)?.label}
              </p>
              <p className="text-xs mt-2 text-indigo-500">
                Voice → Transcribe → AI Answer → Speak Back
              </p>
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
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-neutral-200"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && (
                  <button
                    onClick={() => speakMessage(msg.content)}
                    disabled={playing}
                    className="mt-2 flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                  >
                    <Volume2 className="h-3 w-3" />
                    {playing ? "Speaking..." : "Replay"}
                  </button>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center shrink-0 mt-1">
                  <User className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {processing && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-neutral-100 dark:bg-white/10 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-indigo-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                {processingStep}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Big Mic Button */}
      <div className="border-t border-neutral-200 dark:border-white/10 p-6 flex flex-col items-center gap-3 bg-white dark:bg-slate-900 transition-colors duration-300">
        <Button
          size="lg"
          disabled={!selectedDocId || processing || playing}
          onClick={recording ? stopRecording : startRecording}
          className={`rounded-full w-20 h-20 shadow-xl transition-all duration-300 ${
            recording
              ? "bg-red-500 hover:bg-red-600 animate-pulse scale-110"
              : processing
              ? "bg-yellow-500 hover:bg-yellow-600"
              : playing
              ? "bg-green-500 hover:bg-green-600"
              : "bg-gradient-to-br from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700"
          }`}
        >
          {processing ? (
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          ) : playing ? (
            <Volume2 className="h-8 w-8 text-white" />
          ) : recording ? (
            <MicOff className="h-8 w-8 text-white" />
          ) : (
            <Mic className="h-8 w-8 text-white" />
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          {recording
            ? "🔴 Recording... Click to stop"
            : processing
            ? processingStep
            : playing
            ? "🔊 Playing response..."
            : selectedDocId
            ? "Click to speak"
            : "Select a patient first"}
        </p>
      </div>
    </div>
  );
}

// ─── Live Call Tab (Browser-side VAD + Continuous Conversation) ───────────────
function LiveCallTab({
  selectedDocId,
  selectedDoc,
  language,
}: {
  selectedDocId: number | null;
  selectedDoc: any;
  language: string;
}) {
  const [callActive, setCallActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [playing, setPlaying] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);
  const callActiveRef = useRef(false);

  useEffect(() => {
    setMessages([]);
    if (callActive) endCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Audio level animation
  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current && callActiveRef.current) {
      const data = new Uint8Array(analyserRef.current.fftSize);
      analyserRef.current.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const val = (data[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / data.length);
      setAudioLevel(Math.min(rms * 3, 1));
      animFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, []);

  const processAudioSegment = useCallback(
    async (audioBlob: Blob) => {
      if (!selectedDocId || isProcessingRef.current) return;
      isProcessingRef.current = true;
      setProcessing(true);

      try {
        // Step 1: STT
        setProcessingStep("Listening...");
        const sttResult = await speechToText(audioBlob, language);
        const transcript = (sttResult.text || "").trim();

        if (!transcript || transcript.length < 2) {
          setProcessing(false);
          isProcessingRef.current = false;
          return;
        }

        setMessages((prev) => [
          ...prev,
          { role: "user", content: transcript, isVoice: true },
        ]);

        // Step 2: Chat
        setProcessingStep("Thinking...");
        const chatResult = await chatWithPatient(selectedDocId, transcript, []);
        const reply = chatResult.reply || "";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply, isVoice: true },
        ]);

        // Step 3: TTS
        setProcessingStep("Speaking...");
        try {
          const ttsResult = await textToSpeech(reply, language);
          if (ttsResult.audio) {
            setPlaying(true);
            const audioBytes = Uint8Array.from(atob(ttsResult.audio), (c) =>
              c.charCodeAt(0)
            );
            const ttsBlob = new Blob([audioBytes], { type: "audio/wav" });
            const url = URL.createObjectURL(ttsBlob);
            const audio = new Audio(url);
            await new Promise<void>((resolve) => {
              audio.onended = () => {
                setPlaying(false);
                URL.revokeObjectURL(url);
                resolve();
              };
              audio.onerror = () => {
                setPlaying(false);
                resolve();
              };
              audio.play().catch(() => {
                setPlaying(false);
                resolve();
              });
            });
          }
        } catch {
          // TTS optional
        }
      } catch (err) {
        console.error("Live call pipeline error:", err);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I didn't catch that. Please try again.",
          },
        ]);
      } finally {
        setProcessing(false);
        setProcessingStep("");
        isProcessingRef.current = false;
      }
    },
    [selectedDocId, language]
  );

  const startCall = async () => {
    if (!selectedDocId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;
      callActiveRef.current = true;
      setCallActive(true);
      setCallDuration(0);
      setMessages([
        {
          role: "assistant",
          content: `🎙️ Live call started. I'm listening in ${
            LANGUAGES.find((l) => l.code === language)?.label || language
          }. Speak naturally — I'll respond when you pause.`,
          isVoice: true,
        },
      ]);

      // Audio analyser for visualization
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      updateAudioLevel();

      // Timer
      callTimerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

      // Start continuous recording with silence detection
      startListeningLoop(stream);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const startListeningLoop = (stream: MediaStream) => {
    if (!callActiveRef.current) return;

    setListening(true);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    let hasData = false;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        hasData = true;
      }
    };

    mediaRecorder.onstop = async () => {
      setListening(false);
      if (hasData && callActiveRef.current) {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        // Only process if the blob is large enough (not just silence)
        if (blob.size > 1000) {
          await processAudioSegment(blob);
        }
      }
      // Continue listening loop
      if (callActiveRef.current && streamRef.current?.active) {
        startListeningLoop(streamRef.current);
      }
    };

    mediaRecorder.start(250); // Collect data every 250ms

    // Auto-stop after a period of recording to send for processing
    // Use silence detection: stop after 3 seconds of recording
    silenceTimerRef.current = setTimeout(() => {
      if (mediaRecorder.state === "recording" && callActiveRef.current) {
        mediaRecorder.stop();
      }
    }, 4000); // Record 4-second chunks
  };

  const endCall = () => {
    callActiveRef.current = false;
    setCallActive(false);
    setListening(false);
    setProcessing(false);
    setPlaying(false);
    setAudioLevel(0);

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    analyserRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      callActiveRef.current = false;
      endCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {!selectedDocId && (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <Phone className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a patient above</p>
              <p className="text-sm mt-1">
                Then start a live call for hands-free conversation
              </p>
            </div>
          </div>
        )}

        {selectedDocId && !callActive && messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <div className="relative inline-block">
                <Phone className="h-16 w-16 mx-auto mb-4 opacity-20" />
              </div>
              <p className="text-lg font-medium">
                Ready: {selectedDoc?.filename}
              </p>
              <p className="text-sm mt-2">
                Start a live call for a hands-free, continuous conversation
              </p>
              <p className="text-xs mt-2 text-emerald-500">
                🎙️ Continuous Listening → Auto-Transcribe → AI Answer → Voice
                Reply
              </p>
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
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-emerald-600 text-white"
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

        {processing && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-neutral-100 dark:bg-white/10 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                {processingStep}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Call Controls */}
      <div className="border-t border-neutral-200 dark:border-white/10 p-6 bg-white dark:bg-slate-900 transition-colors duration-300">
        {callActive ? (
          <div className="flex flex-col items-center gap-4">
            {/* Audio Visualization */}
            <div className="flex items-center gap-2">
              {[...Array(7)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 rounded-full bg-emerald-500"
                  animate={{
                    height: listening
                      ? `${12 + audioLevel * 40 + Math.sin(Date.now() / 200 + i) * 8}px`
                      : "8px",
                  }}
                  transition={{ duration: 0.1 }}
                />
              ))}
            </div>

            {/* Call Info */}
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {listening
                  ? "Listening..."
                  : processing
                  ? processingStep
                  : playing
                  ? "🔊 Speaking..."
                  : "Ready"}
              </span>
              <span className="text-muted-foreground">
                {formatTime(callDuration)}
              </span>
            </div>

            {/* End Call Button */}
            <Button
              size="lg"
              onClick={endCall}
              className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600 shadow-xl"
            >
              <PhoneOff className="h-7 w-7 text-white" />
            </Button>
            <p className="text-xs text-muted-foreground">End Call</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Button
              size="lg"
              disabled={!selectedDocId}
              onClick={startCall}
              className="rounded-full w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-xl transition-all duration-300"
            >
              <Phone className="h-8 w-8 text-white" />
            </Button>
            <p className="text-xs text-muted-foreground">
              {selectedDocId
                ? "Start Live Call"
                : "Select a patient first"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Voice Agent Page ───────────────────────────────────────────────────
export default function VoiceAgentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-neutral-400">Loading...</div>}>
      <VoiceAgentContent />
    </Suspense>
  );
}

function VoiceAgentContent() {
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [language, setLanguage] = useState("hi-IN");
  const [activeTab, setActiveTab] = useState<"chat" | "call">("chat");

  useEffect(() => {
    getDocuments()
      .then((data) => {
        const docs = (data.documents || []).filter(
          (d: any) => d.status === "done" || d.status === "needs_review"
        );
        setDocuments(docs);
        // Auto-select from URL param (e.g. /voice?id=3)
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

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="p-6 h-[calc(100vh-0px)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start gap-4 mb-2">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Mic className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">Samhita Voice Agent</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
              Speak with the AI about any patient — multilingual support
            </p>
          </div>
        </div>
      </div>

      {/* Config Bar: Patient + Language */}
      <Card className="mb-4 border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/5">
        <CardContent className="py-3 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 hidden sm:block" />
          <div className="flex-1 w-full">
            <label className="text-xs font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
              Select Patient Record
            </label>
            <select
              className="mt-1 block w-full rounded-lg border-indigo-200 dark:border-indigo-500/20 bg-white dark:bg-slate-900 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-neutral-900 dark:text-white"
              value={selectedDocId ?? ""}
              onChange={(e) => {
                setSelectedDocId(Number(e.target.value) || null);
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
          <div className="w-full sm:w-56">
            <label className="text-xs font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1">
              <Globe className="h-3 w-3" /> Language
            </label>
            <select
              className="mt-1 block w-full rounded-lg border-indigo-200 dark:border-indigo-500/20 bg-white dark:bg-slate-900 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-neutral-900 dark:text-white"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tab Switcher */}
      <div className="flex gap-1 mb-4 bg-neutral-100 dark:bg-white/10 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "chat"
              ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Voice Chat
        </button>
        <button
          onClick={() => setActiveTab("call")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "call"
              ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-sm"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
          }`}
        >
          <Radio className="h-4 w-4" />
          Live Call
        </button>
      </div>

      {/* Active Tab Content */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 flex flex-col p-0">
          {activeTab === "chat" ? (
            <VoiceChatTab
              selectedDocId={selectedDocId}
              selectedDoc={selectedDoc}
              language={language}
            />
          ) : (
            <LiveCallTab
              selectedDocId={selectedDocId}
              selectedDoc={selectedDoc}
              language={language}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
