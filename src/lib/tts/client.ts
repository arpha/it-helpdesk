"use server";

const HF_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";

/**
 * Generate speech audio from text using AI Voice Cloning (Hugging Face XTTS / ElevenLabs)
 * Returns Audio Buffer (ArrayBuffer) or null if fallback to Web Speech API is required.
 */
export async function generateSpeechAudio({
  text,
  voiceSampleUrl,
  voiceId,
}: {
  text: string;
  voiceSampleUrl?: string | null;
  voiceId?: string | null;
}): Promise<{ audioBuffer?: ArrayBuffer; mimeType?: string; error?: string; fallback?: boolean }> {
  // Clean text from markdown formatting (*, #, `, _, [], ())
  const cleanText = text
    .replace(/\[SQL\][\s\S]*?\[\/SQL\]/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*`_\[\]()]/g, "")
    .trim();

  if (!cleanText) {
    return { fallback: true, error: "Teks kosong." };
  }

  console.log(`[TTS Generate] Processing text (${cleanText.length} chars), voiceSampleUrl: ${voiceSampleUrl || 'none'}`);

  // 1. If ElevenLabs API Key is provided and user has a voiceId
  if (ELEVENLABS_API_KEY && voiceId) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text: cleanText.substring(0, 1000),
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        return { audioBuffer, mimeType: "audio/mpeg" };
      }
    } catch (err) {
      console.warn("ElevenLabs TTS failed, attempting Hugging Face fallback:", err);
    }
  }

  // 2. Free Hugging Face Open-Source Voice Cloning (XTTS-v2 / Gradio Space API)
  if (voiceSampleUrl) {
    const audioFileData = {
      path: voiceSampleUrl,
      url: voiceSampleUrl,
      orig_name: "voice_sample.webm",
      meta: { _type: "gradio.FileData" }
    };

    // Candidate Hugging Face Voice Cloning Spaces
    const spaceEndpoints = [
      {
        url: "https://mrfakename-e2-f5-tts.hf.space/call/basic_tts",
        payload: {
          data: [
            cleanText.substring(0, 500),
            audioFileData,
            "",
            false,
            1,
          ]
        }
      },
      {
        url: "https://coqui-xtts-v2.hf.space/run/predict",
        payload: {
          data: [
            cleanText.substring(0, 500),
            "id", // language
            audioFileData,
            audioFileData,
            true
          ]
        }
      }
    ];

    for (const space of spaceEndpoints) {
      try {
        console.log(`[TTS] Trying Hugging Face Space: ${space.url}`);
        const hfResponse = await fetch(space.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(space.payload),
        });

        if (hfResponse.ok) {
          const result = await hfResponse.json();

          // Handle Gradio /call SSE event format
          if (result.event_id) {
            const streamRes = await fetch(`${space.url}/${result.event_id}`);
            if (streamRes.ok) {
              const streamText = await streamRes.text();
              const urlMatch = streamText.match(/"url"\s*:\s*"(https?:[^"]+)"/i);
              if (urlMatch && urlMatch[1]) {
                const audioFileRes = await fetch(urlMatch[1]);
                if (audioFileRes.ok) {
                  const audioBuffer = await audioFileRes.arrayBuffer();
                  console.log("[TTS] Successfully generated audio from Hugging Face Space!");
                  return { audioBuffer, mimeType: "audio/wav" };
                }
              }
            }
          }

          // Handle direct Gradio /run/predict format
          if (result.data && Array.isArray(result.data)) {
            const audioData = result.data[0];
            const audioUrl = typeof audioData === "string" ? audioData : audioData?.url || audioData?.name;
            if (audioUrl) {
              const fullAudioUrl = audioUrl.startsWith("http") ? audioUrl : `https://coqui-xtts-v2.hf.space/file=${audioUrl}`;
              const audioFileRes = await fetch(fullAudioUrl);
              if (audioFileRes.ok) {
                const audioBuffer = await audioFileRes.arrayBuffer();
                console.log("[TTS] Successfully generated audio from Gradio predict!");
                return { audioBuffer, mimeType: "audio/wav" };
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[TTS] Hugging Face Space ${space.url} error:`, err);
      }
    }
  }

  // 3. Hugging Face Standard Free Inference API Fallback
  if (HF_API_TOKEN) {
    try {
      const hfApiRes = await fetch(
        "https://api-inference.huggingface.co/models/espnet/kan-bayashi_ljspeech_vits",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: cleanText.substring(0, 500) }),
        }
      );

      if (hfApiRes.ok) {
        const audioBuffer = await hfApiRes.arrayBuffer();
        return { audioBuffer, mimeType: "audio/flac" };
      }
    } catch (err) {
      console.warn("HF Inference API error:", err);
    }
  }

  // Return fallback signal so client-side Web Speech API takes over
  console.log("[TTS] Returning fallback signal to client.");
  return { fallback: true };
}
