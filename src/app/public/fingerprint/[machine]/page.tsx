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
    ArrowRight,
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
    } | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

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
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 md:p-8">
            {/* Header Instansi & Mesin */}
            <div className="w-full max-w-lg mb-6 text-center space-y-2.5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 font-semibold tracking-wide">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>SISTEM INFORMASI IT HELPDESK & BIOMETRIK</span>
                </div>
                
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    {machine.name}
                </h1>
                
                {machine.location && (
                    <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-300">
                        <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Lokasi: <strong className="text-white font-medium">{machine.location}</strong></span>
                    </div>
                )}
            </div>

            {/* Main Tabs Container */}
            <div className="w-full max-w-lg">
                <Tabs defaultValue="daftar" className="w-full">
                    {/* Navigation Tabs */}
                    <TabsList className="grid w-full grid-cols-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl shadow-inner mb-5">
                        <TabsTrigger
                            value="daftar"
                            className="flex items-center justify-center gap-2 text-slate-300 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-lg py-2.5 text-sm font-semibold transition-all"
                        >
                            <FingerprintIcon className="h-4 w-4" />
                            <span>Pendaftaran ID</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="list"
                            className="flex items-center justify-center gap-2 text-slate-300 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-lg py-2.5 text-sm font-semibold transition-all"
                        >
                            <Users className="h-4 w-4" />
                            <span>Daftar Terdaftar ({registeredList.length})</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* ========================================================================= */}
                    {/* TAB 1: FORM PENDAFTARAN MANDIRI */}
                    {/* ========================================================================= */}
                    <TabsContent value="daftar" className="space-y-4 focus-visible:outline-none">
                        {/* Kartu Konfirmasi Berhasil */}
                        {submitSuccess && (
                            <Card className="border-2 border-emerald-500/50 bg-gradient-to-b from-emerald-950/70 to-slate-900/90 backdrop-blur shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-300 rounded-2xl mb-4">
                                <CardContent className="p-6 text-center space-y-4">
                                    <div className="w-14 h-14 bg-emerald-500/20 border-2 border-emerald-400/50 text-emerald-300 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                        <CheckCircle2 className="h-8 w-8" />
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <h3 className="text-xl sm:text-2xl font-black text-white">
                                            Pendaftaran Berhasil!
                                        </h3>
                                        <p className="text-sm text-slate-300">
                                            Terima kasih, <strong className="text-white font-semibold">{submitSuccess.name}</strong>
                                        </p>
                                    </div>

                                    {/* Prominent Assigned ID Card */}
                                    <div className="bg-slate-950/95 border-2 border-emerald-400/60 rounded-xl p-4 my-2 shadow-[0_0_25px_rgba(16,185,129,0.2)] space-y-1">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                                            Nomor ID Finger Anda di {machine.name}
                                        </span>
                                        <div className="text-5xl font-black font-mono tracking-widest text-emerald-300 drop-shadow-[0_2px_10px_rgba(52,211,153,0.5)]">
                                            {submitSuccess.id}
                                        </div>
                                    </div>

                                    {/* Instruksi Hubungi IT Sesuai Permintaan User */}
                                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-left">
                                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                                            <Headphones className="h-4 w-4" />
                                        </div>
                                        <p className="text-xs text-emerald-200 leading-relaxed font-medium">
                                            Silakan hubungi IT untuk melakukan perekaman sidik jari dengan menunjukkan ID di atas.
                                        </p>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 border-slate-700 text-slate-200 hover:bg-slate-800 bg-slate-900 font-semibold w-full h-10 rounded-xl"
                                        onClick={() => setSubmitSuccess(null)}
                                    >
                                        Daftar Lagi untuk Nama Lain
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Formulir Pendaftaran */}
                        <Card className="border border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl rounded-2xl overflow-hidden">
                            <CardHeader className="p-5 sm:p-6 pb-4 border-b border-slate-800/80 bg-slate-900/50">
                                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs tracking-wider uppercase mb-1">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    <span>Formulir Pendaftaran Mandiri</span>
                                </div>
                                <CardTitle className="text-lg sm:text-xl text-white font-bold">
                                    Dapatkan No ID Fingerprint
                                </CardTitle>
                                <CardDescription className="text-slate-400 text-xs">
                                    Sistem akan menyiapkan nomor ID 3 digit unik acak yang siap digunakan.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="p-5 sm:p-6 pt-5">
                                <form onSubmit={handleSubmitRegistration} className="space-y-5">
                                    {submitError && (
                                        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                                            <span>{submitError}</span>
                                        </div>
                                    )}

                                    {/* Input Nama Lengkap */}
                                    <div className="space-y-2">
                                        <Label htmlFor="full_name" className="text-sm font-semibold text-slate-200">
                                            Nama Lengkap Pegawai <span className="text-red-400">*</span>
                                        </Label>
                                        <Input
                                            id="full_name"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Contoh: dr. Ahmad Fauzi / Siti Nurhaliza"
                                            className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 h-11 text-sm sm:text-base focus-visible:ring-emerald-500 focus-visible:border-emerald-500 rounded-xl"
                                            autoComplete="off"
                                            required
                                        />
                                    </div>

                                    {/* ID 3-Digit Acak Generator (Rapi, Seimbang & Kontras) */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-semibold text-slate-200">
                                                Nomor ID Finger Acak
                                            </Label>
                                            <span className="text-xs text-emerald-400 font-mono font-medium">
                                                Format: 001 - 999
                                            </span>
                                        </div>

                                        {/* Box Tampilan ID yang Rapi dan Simetris */}
                                        <div className="p-4 bg-slate-950 border-2 border-emerald-500/40 rounded-xl shadow-inner flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                                    <FingerprintIcon className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 block">
                                                        Nomor ID Terpilih
                                                    </span>
                                                    <div className="text-3xl font-black font-mono tracking-widest text-emerald-300 drop-shadow-[0_2px_8px_rgba(52,211,153,0.4)]">
                                                        {isGeneratingId ? (
                                                            <Loader2 className="h-7 w-7 animate-spin text-emerald-400 inline" />
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
                                                className="border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-900/60 text-emerald-200 text-xs shrink-0 font-semibold h-9 px-3 rounded-lg"
                                            >
                                                <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${isGeneratingId ? "animate-spin" : ""}`} />
                                                Acak Ulang
                                            </Button>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-normal">
                                            Nomor ID di atas unik dan belum pernah digunakan di mesin {machine.name}.
                                        </p>
                                    </div>

                                    {/* Submit Button */}
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || isGeneratingId}
                                        className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950 transition-all rounded-xl cursor-pointer mt-2"
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
                    </TabsContent>

                    {/* ========================================================================= */}
                    {/* TAB 2: DAFTAR ID FINGER TERDAFTAR */}
                    {/* ========================================================================= */}
                    <TabsContent value="list" className="space-y-4 focus-visible:outline-none">
                        <Card className="border border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl rounded-2xl overflow-hidden">
                            <CardHeader className="p-5 sm:p-6 pb-4 border-b border-slate-800/80 bg-slate-900/50 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg sm:text-xl text-white font-bold">
                                                Daftar ID Terdaftar
                                            </CardTitle>
                                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono font-bold">
                                                {registeredList.length} ID
                                            </Badge>
                                        </div>
                                        <CardDescription className="text-slate-400 text-xs">
                                            Pegawai yang telah terdaftar pada {machine.name}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={loadRegisteredList}
                                        disabled={isLoadingList}
                                        className="text-xs border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 h-8 rounded-lg"
                                    >
                                        <RotateCw className={`h-3.5 w-3.5 mr-1 ${isLoadingList ? "animate-spin" : ""}`} />
                                        Refresh
                                    </Button>
                                </div>

                                {/* Live Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Cari nama pegawai atau no ID..."
                                        className="pl-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 h-10 text-sm focus-visible:ring-emerald-500 focus-visible:border-emerald-500 rounded-xl"
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
                                    <div className="space-y-2">
                                        {filteredList.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-slate-950 transition-colors border border-slate-800/80"
                                            >
                                                <div className="flex items-center gap-3 min-w-0 pr-3">
                                                    <Avatar className="h-9 w-9 border border-slate-700 shrink-0">
                                                        <AvatarFallback className="bg-emerald-950 text-emerald-300 font-bold text-xs">
                                                            {getInitials(item.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="truncate">
                                                        <span className="font-semibold text-sm text-white block truncate">
                                                            {item.name}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 block truncate">
                                                            {machine.name}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="shrink-0 text-right">
                                                    <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-mono font-bold text-sm tracking-wider shadow-sm">
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
            <div className="mt-8 text-center text-xs text-slate-500 space-y-1">
                <p>© {new Date().getFullYear()} IT Helpdesk SIMRS • Biometric System</p>
            </div>
        </div>
    );
}
