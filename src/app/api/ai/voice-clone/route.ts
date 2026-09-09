import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    // Ensure bucket exists
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

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from("voice-samples")
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData.publicUrl;

    // Update profiles table
    const { error: dbError } = await supabaseAdmin
      .from("profiles")
      .update({
        voice_sample_url: publicUrl,
        voice_sample_name: fileName,
        voice_model_provider: "huggingface",
      })
      .eq("id", user.id);

    if (dbError) {
      console.error("Profile update error:", dbError);
      throw new Error(`Gagal memperbarui profil pengguna: ${dbError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Sampel suara berhasil diunggah dan dikloning!",
      voiceSampleUrl: publicUrl,
      voiceSampleName: fileName,
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
