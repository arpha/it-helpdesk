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
      .select("voice_sample_url, voice_sample_name, voice_model_provider, elevenlabs_voice_id")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      voiceSampleUrl: profile?.voice_sample_url || null,
      voiceSampleName: profile?.voice_sample_name || null,
      voiceModelProvider: profile?.voice_model_provider || "huggingface",
      elevenlabsVoiceId: profile?.elevenlabs_voice_id || null,
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

    const mimeType = file.type || "audio/mpeg";
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
    let elevenLabsErrorMessage = "";

    // 2. ElevenLabs Instant Voice Cloning (Strictly Cloned Voices Only)
    if (ELEVENLABS_API_KEY) {
      try {
        console.log("[ElevenLabs] Starting Instant Voice Clone process...");
        const audioFile = new File([buffer], fileName, { type: mimeType || "audio/mpeg" });

        // Check existing cloned voices in ElevenLabs account
        const listRes = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": ELEVENLABS_API_KEY },
        });

        let existingClonedVoice: { voice_id: string; name: string } | null = null;
        let allClonedVoices: { voice_id: string; name: string }[] = [];

        if (listRes.ok) {
          const listData = await listRes.json();
          allClonedVoices = (listData.voices || []).filter(
            (v: any) => v.category === "cloned" || v.name?.includes("SIMANTAP")
          );

          if (allClonedVoices.length > 0) {
            existingClonedVoice = allClonedVoices[0];
          }
        }

        // Option A: Edit existing cloned voice if found
        if (existingClonedVoice) {
          console.log("[ElevenLabs] Editing existing cloned voice ID:", existingClonedVoice.voice_id);
          const editFormData = new FormData();
          editFormData.append("name", `SIMANTAP_${user.id.slice(0, 8)}`);
          editFormData.append("files", audioFile);

          const editRes = await fetch(`https://api.elevenlabs.io/v1/voices/${existingClonedVoice.voice_id}/edit`, {
            method: "POST",
            headers: { "xi-api-key": ELEVENLABS_API_KEY },
            body: editFormData,
          });

          if (editRes.ok) {
            elevenLabsVoiceId = existingClonedVoice.voice_id;
            provider = "elevenlabs";
            console.log("[ElevenLabs] Successfully updated custom voice ID:", elevenLabsVoiceId);
          } else {
            console.warn("[ElevenLabs] Edit voice failed status:", editRes.status, await editRes.text());
          }
        }

        // Option B: Add new voice if no existing cloned voice updated
        if (!elevenLabsVoiceId) {
          console.log("[ElevenLabs] Creating new custom voice via /v1/voices/add...");
          const elFormData = new FormData();
          elFormData.append("name", `SIMANTAP_${user.id.slice(0, 8)}`);
          elFormData.append("description", `Custom Voice Clone for user ${user.id}`);
          elFormData.append("files", audioFile);

          let elRes = await fetch("https://api.elevenlabs.io/v1/voices/add", {
            method: "POST",
            headers: { "xi-api-key": ELEVENLABS_API_KEY },
            body: elFormData,
          });

          if (!elRes.ok) {
            const elErrText = await elRes.text();
            console.warn(`[ElevenLabs] Voice clone add returned ${elRes.status}:`, elErrText);
            elevenLabsErrorMessage = elErrText;

            // If account voice limit reached, delete the oldest cloned voice and retry add
            if (elErrText.includes("can_not_add_voice") || elErrText.includes("voice_limit") || elRes.status === 400) {
              if (allClonedVoices.length > 0) {
                const voiceToDelete = allClonedVoices[allClonedVoices.length - 1];
                console.log("[ElevenLabs] Deleting old cloned voice ID:", voiceToDelete.voice_id);
                await fetch(`https://api.elevenlabs.io/v1/voices/${voiceToDelete.voice_id}`, {
                  method: "DELETE",
                  headers: { "xi-api-key": ELEVENLABS_API_KEY },
                }).catch(console.warn);

                // Retry adding voice
                const retryRes = await fetch("https://api.elevenlabs.io/v1/voices/add", {
                  method: "POST",
                  headers: { "xi-api-key": ELEVENLABS_API_KEY },
                  body: elFormData,
                });

                if (retryRes.ok) {
                  const retryData = await retryRes.json();
                  elevenLabsVoiceId = retryData.voice_id;
                  provider = "elevenlabs";
                  console.log("[ElevenLabs] Successfully created voice on retry:", elevenLabsVoiceId);
                }
              }
            }
          } else {
            const elData = await elRes.json();
            elevenLabsVoiceId = elData.voice_id;
            provider = "elevenlabs";
            console.log("[ElevenLabs] Successfully created new voice clone ID:", elevenLabsVoiceId);
          }
        }
      } catch (elErr: any) {
        console.warn("[ElevenLabs] Error connecting to ElevenLabs API:", elErr);
      }
    }

    // 3. Update profile record
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

    if (dbError && dbError.message.includes("elevenlabs_voice_id")) {
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

    let userMessage = "Sampel suara berhasil diunggah!";
    if (provider === "elevenlabs" && elevenLabsVoiceId) {
      userMessage = "Sampel suara MP3 Anda berhasil dikloning secara instan via ElevenLabs AI!";
    } else if (elevenLabsErrorMessage) {
      userMessage = `Sampel tersimpan! Catatan ElevenLabs: ${elevenLabsErrorMessage.includes("voice_limit") ? "Batas jumlah voice akun ElevenLabs sudah penuh." : "Gagal kloning instan, menggunakan suara AI alami."}`;
    }

    return NextResponse.json({
      success: true,
      message: userMessage,
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
