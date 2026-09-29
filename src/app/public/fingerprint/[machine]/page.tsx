"use client";

import { use, useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    getPublicMachineInfo,
    getPublicMachineRegisteredList,
    getAvailableRandomId,
    registerPublicFingerprint,
    type PublicMachineData,
    type PublicFingerprintEntry,
} from "./actions";
import {
    Fingerprint as FingerprintIcon,
    RotateCw,
    Search,
    CheckCircle2,
    Users,
    MapPin,
    Building2,
    Loader2,
    AlertCircle,
    Sparkles,
    Headphones,
    BookOpen,
    ChevronDown,
    ChevronUp,
    CreditCard,
    ArrowRight,
    KeyRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

/**
 * Mask name: only display first 3 characters and last 1 character,
 * all characters in between are censored with '*'.
 */
function maskName(name: string): string {
    const trimmed = (name || "").trim();
    if (!trimmed) return "-";
    if (trimmed.length <= 2) return trimmed[0] + "*";
    if (trimmed.length === 3) return trimmed[0] + "*" + trimmed[2];
    if (trimmed.length === 4) return trimmed.slice(0, 3) + "*" + trimmed.slice(-1);

    const first3 = trimmed.slice(0, 3);
    const last1 = trimmed.slice(-1);
    const middleCount = Math.max(3, trimmed.length - 4);
    return `${first3}${"*".repeat(middleCount)}${last1}`;
}

export default function PublicFingerprintPage({
    params,
}: {
    params: Promise<{ machine: string }>;
}) {
    const resolvedParams = use(params);
    const machineSlug = resolvedParams.machine;

    const [machine, setMachine] = useState<PublicMachineData | null>(null);
    const [isLoadingMachine, setIsLoadingMachine] = useState(true);
    const [machineError, setMachineError] = useState<string | null>(null);

    // Registration Form States
    const [fullName, setFullName] = useState("");
    const [randomId, setRandomId] = useState<string>("");
    const [isGeneratingId, setIsGeneratingId] = useState(false);
    const [isSubmitting, startSubmitTransition] = useTransition();
    const [submitSuccess, setSubmitSuccess] = useState<{
        name: string;
        id: string;
        wasReassigned?: boolean;
        originalId?: string;
    } | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);

    // Registered List States
    const [registeredList, setRegisteredList] = useState<PublicFingerprintEntry[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Load machine info & initial random ID
    useEffect(() => {
        let isMounted = true;

        async function init() {
            setIsLoadingMachine(true);
            const res = await getPublicMachineInfo(machineSlug);
            if (!isMounted) return;

            if (res.success && res.machine) {
                setMachine(res.machine);
                loadRegisteredList();
                generateNewId();
            } else {
                setMachineError(res.error || "Mesin tidak ditemukan.");
            }
            setIsLoadingMachine(false);
        }

        init();

        return () => {
            isMounted = false;
        };
    }, [machineSlug]);

    const loadRegisteredList = async () => {
        setIsLoadingList(true);
        const res = await getPublicMachineRegisteredList(machineSlug);
        if (res.success) {
            setRegisteredList(res.entries);
        }
        setIsLoadingList(false);
    };

    const generateNewId = async () => {
        setIsGeneratingId(true);
        const res = await getAvailableRandomId(machineSlug);
        if (res.success && res.randomId) {
            setRandomId(res.randomId);
        }
        setIsGeneratingId(false);
    };

    const handleSubmitRegistration = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);

        if (!fullName.trim()) {
            setSubmitError("Silakan masukkan nama lengkap Anda.");
            return;
        }

        if (!randomId) {
            setSubmitError("Nomor ID belum ter-generate. Silakan klik Acak Ulang.");
            return;
        }

        startSubmitTransition(async () => {
            const res = await registerPublicFingerprint({
                machineSlug,
                name: fullName,
                fingerId: randomId,
            });

            if (res.success && res.assignedId) {
                setSubmitSuccess({
                    name: fullName.trim(),
                    id: res.assignedId,
                    wasReassigned: res.wasReassigned,
                    originalId: res.originalId,
                });
                setFullName("");
                loadRegisteredList();
                generateNewId();
            } else {
                setSubmitError(res.error || "Gagal mendaftarkan ID. Silakan coba lagi.");
            }
        });
    };

    const filteredList = registeredList.filter((item) => {
        const q = searchQuery.toLowerCase().trim();
        return (
            item.name.toLowerCase().includes(q) ||
            item.finger_id.toLowerCase().includes(q)
        );
    });

    if (isLoadingMachine) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3 text-slate-300">
                    <Loader2 className="h-9 w-9 animate-spin text-emerald-400" />
                    <p className="text-sm font-medium">Memuat data mesin finger...</p>
                </div>
            </div>
        );
    }

    if (machineError || !machine) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-red-500/30 bg-slate-900 text-white shadow-xl">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 mb-2">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <CardTitle className="text-xl text-white">Mesin Tidak Ditemukan</CardTitle>
                        <CardDescription className="text-slate-400">{machineError}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-3 sm:p-6 md:p-8">
            {/* Header Instansi & Mesin */}
            <div className="w-full max-w-md sm:max-w-lg mb-5 text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] sm:text-xs text-emerald-400 font-semibold tracking-wide">
                    <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span>SIMANTAP</span>
                </div>

                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                    {machine.name}
                </h1>

                {machine.location && (
                    <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] sm:text-xs text-slate-300">
                        <MapPin className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span>Lokasi: <strong className="text-white font-medium">{machine.location}</strong></span>
                    </div>
                )}
            </div>

            {/* Main Tabs Container */}
            <div className="w-full max-w-md sm:max-w-lg">
                <Tabs defaultValue="daftar" className="w-full">
                    {/* Navigation Tabs - Sempurna & Rapi di Mobile */}
                    <TabsList className="grid w-full grid-cols-2 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shadow-inner mb-4 h-11">
                        <TabsTrigger
                            value="daftar"
                            className="flex items-center justify-center gap-1.5 text-slate-300 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-lg py-1.5 px-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap min-w-0 h-9"
                        >
                            <FingerprintIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                            <span className="truncate">Pendaftaran ID</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="list"
                            className="flex items-center justify-center gap-1.5 text-slate-300 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-lg py-1.5 px-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap min-w-0 h-9"
                        >
                            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                            <span className="truncate">Daftar Terdaftar</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-800/90 text-emerald-300 border border-emerald-500/30 shrink-0">
                                {registeredList.length}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    {/* ========================================================================= */}
                    {/* TAB 1: FORM PENDAFTARAN MANDIRI */}
                    {/* ========================================================================= */}
                    <TabsContent value="daftar" className="space-y-4 focus-visible:outline-none">
                        {/* Kartu Konfirmasi Berhasil */}
                        {submitSuccess && (
                            <Card className="border-2 border-emerald-500/50 bg-gradient-to-b from-emerald-950/70 to-slate-900/90 backdrop-blur shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-300 rounded-2xl mb-4">
                                <CardContent className="p-5 sm:p-6 text-center space-y-3.5">
                                    <div className="w-13 h-13 sm:w-14 sm:h-14 bg-emerald-500/20 border-2 border-emerald-400/50 text-emerald-300 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                        <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8" />
                                    </div>

                                    <div className="space-y-0.5">
                                        <h3 className="text-xl sm:text-2xl font-black text-white">
                                            Pendaftaran Berhasil!
                                        </h3>
                                        <p className="text-xs sm:text-sm text-slate-300">
                                            Terima kasih, <strong className="text-white font-semibold">{submitSuccess.name}</strong>
                                        </p>
                                    </div>

                                    {/* Notice jika nomor ID dialihkan otomatis karena ada pendaftar lain di detik yang sama */}
                                    {submitSuccess.wasReassigned && (
                                        <div className="flex items-start gap-2.5 p-3 sm:p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-left shadow-md">
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                                            <div className="space-y-0.5">
                                                <span className="text-xs font-bold text-amber-300 block">
                                                    Pemberitahuan Penyesuaian ID Otomatis
                                                </span>
                                                <p className="text-[11px] sm:text-xs text-amber-200/90 leading-relaxed">
                                                    Nomor ID awal <span className="font-mono font-bold text-white bg-amber-900/80 px-1 py-0.5 rounded border border-amber-500/40">{submitSuccess.originalId}</span> baru saja digunakan oleh pegawai lain yang mendaftar bersamaan. Sistem secara otomatis memberikan nomor baru <span className="font-mono font-bold text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-500/40">{submitSuccess.id}</span> untuk Anda agar tidak terjadi duplikasi ID.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Prominent Assigned ID Card */}
                                    <div className="bg-slate-950/95 border-2 border-emerald-400/60 rounded-xl p-3.5 sm:p-4 my-2 shadow-[0_0_25px_rgba(16,185,129,0.2)] space-y-1">
                                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                                            Nomor ID Finger Anda di {machine.name}
                                        </span>
                                        <div className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-emerald-300 drop-shadow-[0_2px_10px_rgba(52,211,153,0.5)]">
                                            {submitSuccess.id}
                                        </div>
                                    </div>

                                    {/* Instruksi Hubungi IT */}
                                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-left">
                                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                                            <Headphones className="h-3.5 w-3.5" />
                                        </div>
                                        <p className="text-xs text-emerald-200 leading-relaxed font-medium">
                                            Silakan hubungi IT untuk melakukan perekaman sidik jari dengan menunjukkan ID di atas.
                                        </p>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-1 border-slate-700 text-slate-200 hover:bg-slate-800 bg-slate-900 font-semibold w-full h-10 rounded-xl"
                                        onClick={() => setSubmitSuccess(null)}
                                    >
                                        Daftar Lagi untuk Nama Lain
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Formulir Pendaftaran */}
                        <Card className="border border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl rounded-2xl overflow-hidden">
                            <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-800/80 bg-slate-900/50">
                                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px] sm:text-xs tracking-wider uppercase mb-0.5">
                                    <Sparkles className="h-3 w-3" />
                                    <span>Formulir Pendaftaran Mandiri</span>
                                </div>
                                <CardTitle className="text-base sm:text-xl text-white font-bold">
                                    Dapatkan No ID Fingerprint
                                </CardTitle>
                                <CardDescription className="text-slate-400 text-xs">
                                    Sistem akan menyiapkan nomor ID 3 digit unik acak yang siap digunakan.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="p-4 sm:p-6 pt-4 sm:pt-5">
                                <form onSubmit={handleSubmitRegistration} className="space-y-4 sm:space-y-5">
                                    {submitError && (
                                        <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                                            <span>{submitError}</span>
                                        </div>
                                    )}

                                    {/* Input Nama Lengkap */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="full_name" className="text-xs sm:text-sm font-semibold text-slate-200">
                                            Nama Lengkap Pegawai <span className="text-red-400">*</span>
                                        </Label>
                                        <Input
                                            id="full_name"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Contoh: dr. Ahmad Fauzi / Siti Nurhaliza"
                                            className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 h-11 text-xs sm:text-sm focus-visible:ring-emerald-500 focus-visible:border-emerald-500 rounded-xl"
                                            autoComplete="off"
                                            required
                                        />
                                    </div>

                                    {/* ID 3-Digit Acak Generator */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs sm:text-sm font-semibold text-slate-200">
                                                Nomor ID Finger Acak
                                            </Label>
                                            <span className="text-[11px] text-emerald-400 font-mono font-medium">
                                                001 - 999
                                            </span>
                                        </div>

                                        {/* Box Tampilan ID */}
                                        <div className="p-3.5 sm:p-4 bg-slate-950 border-2 border-emerald-500/40 rounded-xl shadow-inner flex items-center justify-between gap-2.5">
                                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                                    <FingerprintIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 block">
                                                        Nomor Terpilih
                                                    </span>
                                                    <div className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-emerald-300 drop-shadow-[0_2px_8px_rgba(52,211,153,0.4)] truncate">
                                                        {isGeneratingId ? (
                                                            <Loader2 className="h-6 w-6 animate-spin text-emerald-400 inline" />
                                                        ) : (
                                                            randomId || "---"
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={generateNewId}
                                                disabled={isGeneratingId}
                                                className="border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-900/60 text-emerald-200 text-xs shrink-0 font-semibold h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg"
                                            >
                                                <RotateCw className={`h-3.5 w-3.5 mr-1 ${isGeneratingId ? "animate-spin" : ""}`} />
                                                Acak Ulang
                                            </Button>
                                        </div>
                                        <p className="text-[10px] sm:text-[11px] text-slate-400 leading-normal">
                                            Nomor ID di atas unik dan belum pernah digunakan di mesin {machine.name}.
                                        </p>
                                    </div>

                                    {/* Submit Button */}
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || isGeneratingId}
                                        className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950 transition-all rounded-xl cursor-pointer mt-1"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Menyimpan Pendaftaran...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                Daftarkan ID Finger Sekarang
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* ================================================================= */}
                        {/* TUTORIAL CARA MENDAFTARKAN KE MESIN (ADMIN / IT)                  */}
                        {/* ================================================================= */}
                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={() => setShowTutorial(!showTutorial)}
                                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-900 text-slate-300 transition-all cursor-pointer shadow-md"
                            >
                                <span className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-200">
                                    <BookOpen className="h-4 w-4 text-emerald-400 shrink-0" />
                                    <span>Panduan Perekaman Mesin (Khusus Petugas / Admin)</span>
                                </span>
                                {showTutorial ? (
                                    <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                                )}
                            </button>

                            {showTutorial && (
                                <Card className="mt-2.5 border border-slate-800 bg-slate-900/95 backdrop-blur shadow-2xl rounded-2xl overflow-hidden animate-in fade-in-50 duration-200">
                                    <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-800 bg-slate-900/60 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                                                <KeyRound className="h-4 w-4" />
                                            </div>
                                            <CardTitle className="text-sm sm:text-base font-bold text-white">
                                                Tutorial Pendaftaran pada Mesin Fisik
                                            </CardTitle>
                                        </div>
                                        <CardDescription className="text-slate-400 text-xs">
                                            Lakukan urutan tombol berikut pada terminal mesin biometrik:
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="p-4 sm:p-5 space-y-4">
                                        {/* Cara 1: Mendaftarkan Jari */}
                                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wide">
                                                    <FingerprintIcon className="h-3.5 w-3.5" />
                                                    Cara Mendaftarkan Jari
                                                </span>
                                                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700 font-mono">
                                                    8 Langkah
                                                </Badge>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-emerald-300 font-mono font-bold text-xs shadow-sm">
                                                    klik *
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-emerald-300 font-mono font-bold text-xs shadow-sm">
                                                    klik #
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-semibold text-xs shadow-sm">
                                                    Tap Admin
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-emerald-300 font-mono font-bold text-xs shadow-sm">
                                                    Klik #
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-semibold text-xs shadow-sm">
                                                    Masukan ID
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-emerald-300 font-mono font-bold text-xs shadow-sm">
                                                    Klik #
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs shadow-sm">
                                                    Tap Jari 3x
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-emerald-300 font-mono font-bold text-xs shadow-sm">
                                                    Klik *
                                                </span>
                                            </div>
                                        </div>

                                        {/* Cara 2: Mendaftarkan Kartu */}
                                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wide">
                                                    <CreditCard className="h-3.5 w-3.5" />
                                                    Cara Mendaftarkan Kartu
                                                </span>
                                                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700 font-mono">
                                                    8 Langkah
                                                </Badge>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold text-xs shadow-sm">
                                                    klik *
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold text-xs shadow-sm">
                                                    klik #
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-semibold text-xs shadow-sm">
                                                    Tap Admin
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold text-xs shadow-sm">
                                                    Klik #
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-semibold text-xs shadow-sm">
                                                    Masukan ID
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold text-xs shadow-sm">
                                                    Klik #
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs shadow-sm">
                                                    Tap Kartu 3x
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                                                <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold text-xs shadow-sm">
                                                    Klik *
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    {/* ========================================================================= */}
                    {/* TAB 2: DAFTAR ID FINGER TERDAFTAR (DENGAN SENSOR NAMA) */}
                    {/* ========================================================================= */}
                    <TabsContent value="list" className="space-y-4 focus-visible:outline-none">
                        <Card className="border border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl rounded-2xl overflow-hidden">
                            <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-800/80 bg-slate-900/50 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-base sm:text-xl text-white font-bold truncate">
                                                Daftar ID Terdaftar
                                            </CardTitle>
                                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] sm:text-xs font-mono font-bold shrink-0">
                                                {registeredList.length} ID
                                            </Badge>
                                        </div>
                                        <CardDescription className="text-slate-400 text-[11px] sm:text-xs truncate">
                                            Pegawai yang telah terdaftar pada {machine.name}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={loadRegisteredList}
                                        disabled={isLoadingList}
                                        className="text-xs border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 h-7 sm:h-8 px-2.5 rounded-lg shrink-0"
                                    >
                                        <RotateCw className={`h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 ${isLoadingList ? "animate-spin" : ""}`} />
                                        Refresh
                                    </Button>
                                </div>

                                {/* Live Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Cari nama pegawai atau no ID..."
                                        className="pl-8 sm:pl-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 h-9 sm:h-10 text-xs sm:text-sm focus-visible:ring-emerald-500 focus-visible:border-emerald-500 rounded-xl"
                                    />
                                </div>
                            </CardHeader>

                            <CardContent className="p-3 sm:p-4 max-h-[60vh] overflow-y-auto">
                                {isLoadingList ? (
                                    <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                                        <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
                                        <span className="text-xs">Memuat daftar terdaftar...</span>
                                    </div>
                                ) : filteredList.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400 space-y-1">
                                        <p className="text-sm font-medium text-slate-300">Tidak ada data ditemukan</p>
                                        <p className="text-xs text-slate-500">
                                            {searchQuery
                                                ? "Tidak ada hasil yang cocok dengan pencarian Anda."
                                                : "Belum ada pegawai yang terdaftar di mesin ini."}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 sm:space-y-2">
                                        {filteredList.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-950/80 hover:bg-slate-950 transition-colors border border-slate-800/80"
                                            >
                                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
                                                    <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border border-slate-700 shrink-0">
                                                        <AvatarFallback className="bg-emerald-950 text-emerald-300 font-bold text-[10px] sm:text-xs">
                                                            {getInitials(item.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        {/* Nama disensor: 3 huruf pertama, 1 huruf terakhir, sisanya * */}
                                                        <span className="font-semibold text-xs sm:text-sm text-white block font-mono tracking-tight truncate">
                                                            {maskName(item.name)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 block truncate">
                                                            {machine.name}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="shrink-0 text-right">
                                                    {/* ID Badge */}
                                                    <div className="inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-mono font-bold text-xs sm:text-sm tracking-wider shadow-sm">
                                                        {item.finger_id.padStart(3, "0")}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Footer */}
            <div className="mt-6 sm:mt-8 text-center text-[11px] sm:text-xs text-slate-500">
                <p>© {new Date().getFullYear()} SIMANTAP</p>
            </div>
        </div>
    );
}
