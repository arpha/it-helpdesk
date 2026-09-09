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

    // Fetch user profile voice sample if not directly provided
    if (!voiceSampleUrl) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("voice_sample_url")
            .eq("id", user.id)
            .single();
          if (profile?.voice_sample_url) {
            voiceSampleUrl = profile.voice_sample_url;
          }
        }
      } catch (err) {
        console.warn("Could not fetch user profile for TTS:", err);
      }
    }

    const ttsResult = await generateSpeechAudio({
      text,
      voiceSampleUrl,
    });

    if (ttsResult.fallback || !ttsResult.audioBuffer) {
      return NextResponse.json({
        success: false,
        fallback: true,
        message: "Menggunakan Web Speech API Browser sebagai pemutar cadangan.",
      });
    }

    return new NextResponse(ttsResult.audioBuffer, {
      headers: {
        "Content-Type": ttsResult.mimeType || "audio/wav",
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
