"use client";

import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { useTTS } from "@/hooks/use-tts";

interface AudioSpeakerButtonProps {
  text: string;
  voiceSampleUrl?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function AudioSpeakerButton({
  text,
  voiceSampleUrl,
  className = "",
  size = "icon",
  variant = "ghost",
}: AudioSpeakerButtonProps) {
  const { speak, stop, isPlaying, isLoading } = useTTS();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      stop();
    } else {
      speak(text, voiceSampleUrl);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={`h-7 w-7 rounded-full text-muted-foreground hover:text-primary transition-colors ${className}`}
      onClick={handleClick}
      title={isPlaying ? "Hentikan Suara" : "Dengarkan Suara AI"}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      ) : isPlaying ? (
        <VolumeX className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
