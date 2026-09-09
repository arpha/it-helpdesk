import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("voice_sample_url, voice_sample_name, voice_model_provider")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      voiceSampleUrl: profile?.voice_sample_url || null,
      voiceSampleName: profile?.voice_sample_name || null,
      voiceModelProvider: profile?.voice_model_provider || "huggingface",
      hasElevenLabsKey: !!ELEVENLABS_API_KEY,
    });
  } catch (error) {
    console.error("GET Voice Clone Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch voice settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Silakan login terlebih dahulu untuk mengunggah sampel suara." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "File audio MP3/WAV diperlukan." },
        { status: 400 }
      );
    }

    // Validate mime type / extension
    const mimeType = file.type || "";
    const fileName = file.name || "voice-sample.mp3";
    const ext = fileName.split(".").pop()?.toLowerCase() || "mp3";

    if (!["mp3", "wav", "m4a", "ogg", "webm"].includes(ext) && !mimeType.includes("audio")) {
      return NextResponse.json(
        { success: false, error: "Format file harus berupa MP3, WAV, M4A, atau WebM audio." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabaseAdmin = createAdminClient();
    const storagePath = `user_${user.id}_${Date.now()}.${ext}`;

    // 1. Upload file to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from("voice-samples")
      .upload(storagePath, buffer, {
        contentType: mimeType || `audio/${ext}`,
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      throw new Error(`Gagal mengunggah file ke penyimpanan: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("voice-samples")
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData.publicUrl;
    let elevenLabsVoiceId: string | null = null;
    let provider = "huggingface";

    // 2. If ElevenLabs API key is configured, create Instant Voice Clone on ElevenLabs
    if (ELEVENLABS_API_KEY) {
      try {
        console.log("[ElevenLabs] Creating Instant Voice Clone...");
        const elFormData = new FormData();
        elFormData.append("name", `SI_MANTAP_${user.id.slice(0, 8)}`);
        elFormData.append("description", `Custom Voice Clone for user ${user.id}`);
        const audioBlob = new Blob([buffer], { type: mimeType || "audio/mpeg" });
        elFormData.append("files", audioBlob, fileName);

        const elRes = await fetch("https://api.elevenlabs.io/v1/voices/add", {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
          },
          body: elFormData,
        });

        if (elRes.ok) {
          const elData = await elRes.json();
          elevenLabsVoiceId = elData.voice_id;
          provider = "elevenlabs";
          console.log("[ElevenLabs] Successfully created Voice Clone ID:", elevenLabsVoiceId);
        } else {
          const elErr = await elRes.text();
          console.warn("[ElevenLabs] Voice clone creation failed:", elErr);
        }
      } catch (elErr) {
        console.warn("[ElevenLabs] Error connecting to ElevenLabs API:", elErr);
      }
    }

    // 3. Update profile record with graceful fallback if column is missing
    const updateData: Record<string, any> = {
      voice_sample_url: publicUrl,
      voice_sample_name: fileName,
      voice_model_provider: provider,
    };

    if (elevenLabsVoiceId) {
      updateData.elevenlabs_voice_id = elevenLabsVoiceId;
    }

    let { error: dbError } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    // If missing elevenlabs_voice_id column error occurs, fallback to update without elevenlabs_voice_id
    if (dbError && dbError.message.includes("elevenlabs_voice_id")) {
      console.warn("elevenlabs_voice_id column missing in DB, falling back to base columns.");
      delete updateData.elevenlabs_voice_id;
      const fallbackRes = await supabaseAdmin
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);
      dbError = fallbackRes.error;
    }

    if (dbError) {
      console.error("Profile update error:", dbError);
      throw new Error(`Gagal memperbarui profil pengguna: ${dbError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: provider === "elevenlabs" 
        ? "Sampel suara berhasil diunggah dan dikloning secara instan via ElevenLabs AI!" 
        : "Sampel suara berhasil diunggah dan disimpan!",
      voiceSampleUrl: publicUrl,
      voiceSampleName: fileName,
      elevenlabsVoiceId: elevenLabsVoiceId,
      provider,
    });
  } catch (error) {
    console.error("POST Voice Clone Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan saat memproses sampel suara.",
      },
      { status: 500 }
    );
  }
}
