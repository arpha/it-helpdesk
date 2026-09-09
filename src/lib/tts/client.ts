"use server";

const HF_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";

/**
 * Generate speech audio from text using AI Voice (ElevenLabs, Hugging Face, or Google AI TTS Engine)
 * Returns Audio Buffer (ArrayBuffer MP3/WAV)
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
    .replace(/\n+/g, ". ")
    .trim();

  if (!cleanText) {
    return { fallback: true, error: "Teks kosong." };
  }

  console.log(`[TTS Generate] Processing text (${cleanText.length} chars), voiceSampleUrl: ${voiceSampleUrl || 'none'}`);

  // 1. If ElevenLabs API Key is provided
  if (ELEVENLABS_API_KEY) {
    try {
      let targetVoiceId = voiceId;

      // If voiceId is not passed, attempt to fetch custom voice ID from ElevenLabs account, or fallback to default specified voice ID
      if (!targetVoiceId) {
        try {
          const listRes = await fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": ELEVENLABS_API_KEY },
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            const voices = listData.voices || [];
            // Find custom/cloned voice first
            const customVoice = voices.find(
              (v: any) => v.category !== "premade" && v.category !== "famous" && v.category !== "standard"
            );
            if (customVoice) {
              targetVoiceId = customVoice.voice_id;
              console.log(`[TTS ElevenLabs] Auto-discovered user custom voice: ${customVoice.name} (${targetVoiceId})`);
            } else if (voices.length > 0) {
              targetVoiceId = voices[0].voice_id;
            }
          }
        } catch (e) {
          console.warn("[TTS ElevenLabs] Error fetching voice list:", e);
        }

        // Hardcoded target fallback voice ID specified by user if list fetch didn't yield a voice
        if (!targetVoiceId) {
          targetVoiceId = "BfwyZzLnL4udYd1qYpiN";
        }
      }

      if (targetVoiceId) {
        console.log(`[TTS ElevenLabs] Synthesizing speech with voice ID: ${targetVoiceId}`);
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`,
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
          console.log("[TTS] Successfully generated voice with ElevenLabs!");
          return { audioBuffer, mimeType: "audio/mpeg" };
        } else {
          const errText = await response.text();
          console.warn(`[TTS ElevenLabs] API error (${response.status}):`, errText);
        }
      }
    } catch (err) {
      console.warn("ElevenLabs TTS failed, attempting fallback:", err);
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

    const spaceEndpoints = [
      {
        url: "https://mrfakename-e2-f5-tts.hf.space/call/basic_tts",
        payload: {
          data: [
            cleanText.substring(0, 300),
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
            cleanText.substring(0, 300),
            "id",
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout for fast response

        const hfResponse = await fetch(space.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(space.payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (hfResponse.ok) {
          const result = await hfResponse.json();

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
        console.warn(`[TTS] Hugging Face Space ${space.url} timed out or failed:`, err);
      }
    }
  }

  // 3. High Quality Indonesian AI Voice Engine (Google / Edge TTS Stream)
  // Generates real natural human AI Voice audio MP3 for Indonesian without browser robotic fallback
  try {
    const textChunk = cleanText.substring(0, 300);
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textChunk)}&tl=id&client=tw-ob`;
    
    console.log("[TTS] Fetching Natural Indonesian AI Voice MP3 stream...");
    const gttsRes = await fetch(googleTtsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (gttsRes.ok) {
      const audioBuffer = await gttsRes.arrayBuffer();
      console.log("[TTS] Successfully generated Natural Indonesian AI Voice MP3!");
      return { audioBuffer, mimeType: "audio/mpeg" };
    }
  } catch (gttsErr) {
    console.warn("[TTS] Natural AI Voice stream error:", gttsErr);
  }

  // Return fallback signal if all server-side engines fail
  return { fallback: true };
}
