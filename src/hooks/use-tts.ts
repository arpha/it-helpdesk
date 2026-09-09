"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface UseTTSReturn {
  speak: (text: string, voiceSampleUrl?: string) => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
  isLoading: boolean;
}

export function useTTS(): UseTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const speakWithBrowserSpeech = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown
    const cleanText = text
      .replace(/\[SQL\][\s\S]*?\[\/SQL\]/gi, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/[#*`_\[\]()]/g, "")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "id-ID";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try finding Indonesian voice if available
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang.includes("id") || v.lang.includes("ID"));
    if (idVoice) {
      utterance.voice = idVoice;
    }

    utterance.onstart = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };

    utterance.onend = () => {
      setIsPlaying(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const speak = async (text: string, voiceSampleUrl?: string) => {
    if (isPlaying) {
      stop();
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceSampleUrl }),
      });

      const contentType = res.headers.get("content-type") || "";

      if (res.ok && contentType.includes("audio")) {
        const blob = await res.blob();
        if (currentBlobUrlRef.current) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
        }

        const blobUrl = URL.createObjectURL(blob);
        currentBlobUrlRef.current = blobUrl;

        const audio = new Audio(blobUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsLoading(false);
          setIsPlaying(true);
        };

        audio.onended = () => {
          setIsPlaying(false);
        };

        audio.onerror = () => {
          // Fallback to browser speech on audio element error
          speakWithBrowserSpeech(text);
        };

        await audio.play();
        return;
      }

      // Check if API returned JSON fallback
      const data = await res.json().catch(() => null);
      if (data?.fallback || !res.ok) {
        speakWithBrowserSpeech(text);
        return;
      }

      speakWithBrowserSpeech(text);
    } catch (err) {
      console.warn("TTS fetch failed, falling back to Web Speech API:", err);
      speakWithBrowserSpeech(text);
    }
  };

  return { speak, stop, isPlaying, isLoading };
}
