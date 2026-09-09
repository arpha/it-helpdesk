import { Metadata } from "next";
import { VoiceSettingsClient } from "./_components/voice-settings-client";

export const metadata: Metadata = {
  title: "Pengaturan Suara AI & Kloning Suara - SI MANTAP",
  description: "Kelola sampel suara kustom (MP3/WAV) dan rekaman mikrofon untuk AI Text-to-Speech",
};

export default function VoiceSettingsPage() {
  return <VoiceSettingsClient />;
}
