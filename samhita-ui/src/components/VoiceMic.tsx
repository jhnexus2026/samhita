"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { speechToText, textToSpeech, chatWithPatient } from "@/lib/api";

interface VoiceMicProps {
  documentId: number;
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
}

export function VoiceMic({ documentId, onTranscript, onResponse }: VoiceMicProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
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

        try {
          // 1. Speech-to-text
          const sttResult = await speechToText(blob, "hi-IN");
          const transcript = sttResult.text || "";
          onTranscript?.(transcript);

          if (!transcript) {
            setProcessing(false);
            return;
          }

          // 2. Chat with patient context
          const chatResult = await chatWithPatient(documentId, transcript, []);
          const reply = chatResult.reply || "";
          onResponse?.(reply);

          // 3. Text-to-speech for the reply
          try {
            const ttsResult = await textToSpeech(reply, "hi-IN");
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
            // TTS is optional, don't block on failure
          }
        } catch (err) {
          console.error("Voice pipeline error:", err);
        } finally {
          setProcessing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, [documentId, onTranscript, onResponse]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  return (
    <div className="fixed bottom-6 right-24 z-50">
      <Button
        size="lg"
        className={`rounded-full w-14 h-14 shadow-lg transition-all ${
          recording
            ? "bg-red-500 hover:bg-red-600 animate-pulse"
            : processing
            ? "bg-yellow-500 hover:bg-yellow-600"
            : playing
            ? "bg-green-500 hover:bg-green-600"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
        onClick={recording ? stopRecording : startRecording}
        disabled={processing || playing}
        title={
          recording
            ? "Stop recording"
            : processing
            ? "Processing..."
            : playing
            ? "Playing response..."
            : "Hold to speak"
        }
      >
        {processing ? (
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        ) : playing ? (
          <Volume2 className="h-6 w-6 text-white" />
        ) : recording ? (
          <MicOff className="h-6 w-6 text-white" />
        ) : (
          <Mic className="h-6 w-6 text-white" />
        )}
      </Button>
    </div>
  );
}
