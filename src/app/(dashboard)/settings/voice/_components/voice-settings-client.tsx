"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mic,
  Upload,
  Volume2,
  CheckCircle2,
  Sparkles,
  Loader2,
  Square,
  FileAudio,
  Play,
  Pause,
  RefreshCw,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useTTS } from "@/hooks/use-tts";

export function VoiceSettingsClient() {
  const [activeVoiceUrl, setActiveVoiceUrl] = useState<string | null>(null);
  const [activeVoiceName, setActiveVoiceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // AI TTS Test State
  const [testText, setTestText] = useState(
    "Halo! Saya adalah suara AI kustom Anda di sistem SI MANTAP. Ada yang bisa saya bantu?"
  );
  const { speak, stop: stopTTS, isPlaying: isTTSPlaying, isLoading: isTTSLoading } = useTTS();

  // Audio Player State for Voice Samples
  const [playingSample, setPlayingSample] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  const fetchVoiceSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/ai/voice-clone");
      const data = await res.json();
      if (data.success) {
        setActiveVoiceUrl(data.voiceSampleUrl);
        setActiveVoiceName(data.voiceSampleName);
      }
    } catch (err) {
      console.error("Fetch voice settings error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVoiceSettings();
  }, []);

  // Handle File Selection
  const handleFileChange = (file: File | null) => {
    if (!file) return;

    if (!file.type.includes("audio") && !file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
      toast.error("File harus berformat audio (MP3, WAV, M4A, OGG).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 15 MB.");
      return;
    }

    setSelectedFile(file);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(URL.createObjectURL(file));
  };

  // Upload Selected File
  const handleUploadFile = async () => {
    if (!selectedFile) {
      toast.error("Pilih file MP3/WAV terlebih dahulu.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/ai/voice-clone", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "File sampel suara berhasil diunggah!");
        setActiveVoiceUrl(data.voiceSampleUrl);
        setActiveVoiceName(data.voiceSampleName);
        setSelectedFile(null);
      } else {
        toast.error(data.error || "Gagal mengunggah file suara");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi saat mengunggah file");
    } finally {
      setUploading(false);
    }
  };

  // Microphone Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error("Tidak dapat mengakses mikrofon. Pastikan izin mikrofon telah diberikan.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Upload Recorded Voice Blob
  const handleUploadRecorded = async () => {
    if (!recordedBlob) return;

    setUploading(true);
    try {
      const file = new File([recordedBlob], `recorded-voice-${Date.now()}.webm`, {
        type: "audio/webm",
      });

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai/voice-clone", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Hasil rekaman suara berhasil disimpan!");
        setActiveVoiceUrl(data.voiceSampleUrl);
        setActiveVoiceName(data.voiceSampleName);
        setRecordedBlob(null);
      } else {
        toast.error(data.error || "Gagal menyimpan rekaman suara");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi saat mengirim rekaman");
    } finally {
      setUploading(false);
    }
  };

  // Sample Audio Player
  const togglePlaySample = (url: string) => {
    if (playingSample === url) {
      sampleAudioRef.current?.pause();
      setPlayingSample(null);
    } else {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
      }
      const audio = new Audio(url);
      sampleAudioRef.current = audio;
      audio.onended = () => setPlayingSample(null);
      audio.play();
      setPlayingSample(url);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="container max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Suara AI & Voice Cloning
            <Badge variant="secondary" className="gap-1 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> Free Open-Source AI
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Unggah file MP3/WAV milik Anda atau rekam suara untuk kloning suara AI mandiri secara gratis.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchVoiceSettings} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh Status
        </Button>
      </div>

      {/* Active Voice Status Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Status Profil Suara Saat Ini
          </CardTitle>
          <CardDescription>
            Sampel suara ini digunakan oleh AI Assistant untuk membaca respon kendala IT Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeVoiceUrl ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-background border gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <FileAudio className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{activeVoiceName || "sampel-suara-kustom.mp3"}</h4>
                  <span className="text-xs text-muted-foreground">Aktif & Siap Digunakan untuk Voice Cloning AI</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => togglePlaySample(activeVoiceUrl)}
                >
                  {playingSample === activeVoiceUrl ? (
                    <>
                      <Pause className="h-3.5 w-3.5 text-amber-500" /> Hentikan Sampel
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 text-emerald-600" /> Putar Sampel MP3
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-200 text-amber-900 dark:text-amber-200 text-sm flex items-center gap-3">
              <Info className="h-5 w-5 shrink-0 text-amber-600" />
              <span>
                Belum ada sampel suara kustom yang diunggah. Suara pembaca bawaan browser (Web Speech API) akan digunakan sampai Anda mengunggah file MP3 atau merekam suara.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Tabs: MP3 File Upload & Microphone Recorder */}
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="upload" className="gap-2 text-xs md:text-sm">
            <Upload className="h-4 w-4" /> Upload File MP3/WAV
          </TabsTrigger>
          <TabsTrigger value="record" className="gap-2 text-xs md:text-sm">
            <Mic className="h-4 w-4" /> Rekam Mikrofon
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Upload MP3/WAV File */}
        <TabsContent value="upload" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" /> Unggah File MP3 / WAV
              </CardTitle>
              <CardDescription>
                Unggah file audio sampel suara milik Anda (durasi rekomendasi 15–60 detik) untuk dipelajari oleh model AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/20"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="audio/mp3,audio/wav,audio/m4a,audio/ogg,audio/webm"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <FileAudio className="h-6 w-6" />
                </div>
                <h4 className="font-semibold text-sm">
                  {selectedFile ? selectedFile.name : "Klik atau Geser File MP3 ke Sini"}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Format didukung: MP3, WAV, M4A, WebM (Maksimal 15MB)
                </p>
              </div>

              {selectedFile && filePreviewUrl && (
                <div className="p-3 rounded-xl bg-muted/40 border flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <FileAudio className="h-4 w-4 text-primary" />
                    <span>{selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 flex-1 sm:flex-none"
                      onClick={() => togglePlaySample(filePreviewUrl)}
                    >
                      {playingSample === filePreviewUrl ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      Dengar Audio
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs gap-1.5 flex-1 sm:flex-none"
                      onClick={handleUploadFile}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Unggah & Kloning Suara
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Microphone Recorder */}
        <TabsContent value="record" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" /> Rekam Suara Langsung
              </CardTitle>
              <CardDescription>
                Bacalah kalimat acak secara jelas melalui mikrofon selama 15–30 detik.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/30 border space-y-2 text-xs">
                <span className="font-semibold text-muted-foreground block">Contoh Teks Rekaman:</span>
                <p className="italic text-foreground">
                  &quot;Halo, nama saya staf IT SI MANTAP. Saya sedang merekam sampel suara ini untuk melatih model AI Text-to-Speech agar bisa membantu memberikan informasi teknis secara natural.&quot;
                </p>
              </div>

              <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-background gap-4">
                <div className="text-2xl font-bold font-mono text-primary">
                  {formatTime(recordingTime)}
                </div>

                {!isRecording ? (
                  <Button onClick={startRecording} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                    <Mic className="h-4 w-4" /> Mulai Perekaman Suara
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="outline" className="gap-2 border-red-500 text-red-600 hover:bg-red-50">
                    <Square className="h-4 w-4 fill-red-600" /> Hentikan Perekaman
                  </Button>
                )}

                {recordedUrl && (
                  <div className="flex items-center gap-3 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => togglePlaySample(recordedUrl)}
                    >
                      {playingSample === recordedUrl ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      Dengar Rekaman
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={handleUploadRecorded}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Simpan & Kloning Suara
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Interactive AI Voice Test Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" /> Uji Coba Suara AI Kustom
          </CardTitle>
          <CardDescription>
            Ketik kalimat bebas di bawah untuk mendengarkan bagaimana AI berbicara dengan suara kloning Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Teks Pengujian AI:</Label>
            <Input
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Masukkan kalimat yang ingin dibacakan..."
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {activeVoiceUrl ? "✨ Menggunakan Sampel Suara Kustom MP3" : "🔊 Menggunakan Web Speech API Browser"}
            </span>
            <Button
              onClick={() => {
                if (isTTSPlaying) stopTTS();
                else speak(testText, activeVoiceUrl || undefined);
              }}
              disabled={isTTSLoading || !testText.trim()}
              className="gap-2"
            >
              {isTTSLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Memproses Suara...
                </>
              ) : isTTSPlaying ? (
                <>
                  <Pause className="h-4 w-4" /> Hentikan
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" /> Putar Suara AI
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
