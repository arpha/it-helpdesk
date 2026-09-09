import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSpeechAudio } from "@/lib/tts/client";

export async function POST(request: NextRequest) {
  try {
    const { text, voiceSampleUrl: providedVoiceUrl } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text parameter is required" }, { status: 400 });
    }

    let voiceSampleUrl = providedVoiceUrl;
    let voiceId: string | null = null;

    // Fetch user profile voice sample & ElevenLabs Voice ID if not directly provided
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("voice_sample_url, elevenlabs_voice_id")
          .eq("id", user.id)
          .single();
        if (profile?.voice_sample_url) {
          voiceSampleUrl = profile.voice_sample_url;
        }
        if (profile?.elevenlabs_voice_id) {
          voiceId = profile.elevenlabs_voice_id;
        }
      }
    } catch (err) {
      console.warn("Could not fetch user profile for TTS:", err);
    }

    const ttsResult = await generateSpeechAudio({
      text,
      voiceSampleUrl,
      voiceId,
    });

    if (ttsResult.fallback || !ttsResult.audioBuffer) {
      return NextResponse.json({
        success: false,
        fallback: true,
        message: "Menggunakan pemutar cadangan.",
      });
    }

    return new NextResponse(ttsResult.audioBuffer, {
      headers: {
        "Content-Type": ttsResult.mimeType || "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("TTS Route Error:", error);
    return NextResponse.json({
      success: false,
      fallback: true,
      error: error instanceof Error ? error.message : "Gagal memproses audio TTS",
    });
  }
}
