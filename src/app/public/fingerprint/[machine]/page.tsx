"use client";

import { use, useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
                // Load initial list & random ID
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
            setSubmitError("Nomor ID belum ter-generate. Silakan coba klik Acak Ulang.");
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
                // Refresh list and generate fresh ID for next person
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
            <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">Memuat data mesin finger...</p>
                </div>
            </div>
        );
    }

    if (machineError || !machine) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40 flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-destructive/20 shadow-lg">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-2">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <CardTitle className="text-xl">Mesin Tidak Ditemukan</CardTitle>
                        <CardDescription>{machineError}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 md:p-8">
            {/* Header RS / SIMRS */}
            <div className="w-full max-w-xl mb-6 text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium tracking-wide">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>SISTEM INFORMASI IT HELPDESK & BIOMETRIK</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                    {machine.name}
                </h1>
                {machine.location && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        <span>Lokasi: {machine.location}</span>
                    </div>
                )}
            </div>

            {/* Main Tabs Container */}
            <div className="w-full max-w-xl">
                <Tabs defaultValue="daftar" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shadow-inner mb-6">
                        <TabsTrigger
                            value="daftar"
                            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5 text-sm font-medium transition-all"
                        >
                            <FingerprintIcon className="h-4 w-4" />
                            <span>Pendaftaran ID</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="list"
                            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5 text-sm font-medium transition-all"
                        >
                            <Users className="h-4 w-4" />
                            <span>Daftar ID Terdaftar ({registeredList.length})</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* TAB 1: FORM PENDAFTARAN MANDIRI */}
                    <TabsContent value="daftar" className="space-y-4 focus-visible:outline-none">
                        {submitSuccess && (
                            <Card className="border-emerald-500/30 bg-emerald-950/40 backdrop-blur shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-300">
                                <CardContent className="p-6 text-center space-y-3">
                                    <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                        <CheckCircle2 className="h-8 w-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold text-white">
                                            Pendaftaran Berhasil!
                                        </h3>
                                        <p className="text-sm text-slate-300">
                                            Terima kasih, <strong className="text-white">{submitSuccess.name}</strong>.
                                        </p>
                                    </div>

                                    <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 my-3 space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                                            Nomor ID Finger Anda di {machine.name}
                                        </span>
                                        <div className="text-4xl font-black font-mono tracking-widest text-emerald-400">
                                            {submitSuccess.id}
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                                        Silakan menuju mesin fisik dan rekam sidik jari Anda dengan memasukkan nomor ID di atas pada menu pendaftaran mesin.
                                    </p>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 border-emerald-500/30 text-emerald-300 hover:bg-emerald-950"
                                        onClick={() => setSubmitSuccess(null)}
                                    >
                                        Daftar Lagi untuk Nama Lain
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-2xl">
                            <CardHeader className="space-y-1 pb-4 border-b border-slate-800/80">
                                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                    <Sparkles className="h-4 w-4" />
                                    <span>Formulir Pendaftaran Mandiri</span>
                                </div>
                                <CardTitle className="text-lg text-white">
                                    Dapatkan No ID Fingerprint
                                </CardTitle>
                                <CardDescription className="text-slate-400 text-xs">
                                    Sistem akan memberikan nomor ID 3 digit unik acak yang belum terpakai di mesin ini.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <form onSubmit={handleSubmitRegistration} className="space-y-5">
                                    {submitError && (
                                        <div className="p-3.5 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive-foreground text-xs flex items-start gap-2">
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <span>{submitError}</span>
                                        </div>
                                    )}

                                    {/* Input Nama Lengkap */}
                                    <div className="space-y-2">
                                        <Label htmlFor="full_name" className="text-sm font-medium text-slate-200">
                                            Nama Lengkap Pegawai <span className="text-red-400">*</span>
                                        </Label>
                                        <Input
                                            id="full_name"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Contoh: dr. Ahmad Fauzi / Siti Nurhaliza"
                                            className="bg-slate-950/80 border-slate-700 text-white placeholder:text-slate-500 h-11 focus-visible:ring-primary"
                                            autoComplete="off"
                                            required
                                        />
                                    </div>

                                    {/* ID 3-Digit Acak Generator */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-medium text-slate-200">
                                                Nomor ID Finger Acak (3 Digit)
                                            </Label>
                                            <span className="text-[11px] text-slate-400">
                                                Rentang 001 - 999
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 p-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl">
                                            <div className="flex-1 flex items-center gap-3">
                                                <div className="h-12 w-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                                    <FingerprintIcon className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <span className="text-xs text-slate-400 block">
                                                        Nomor Terpilih
                                                    </span>
                                                    <div className="text-2xl font-black font-mono tracking-widest text-primary">
                                                        {isGeneratingId ? (
                                                            <Loader2 className="h-6 w-6 animate-spin text-primary inline" />
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
                                                className="border-slate-700 hover:bg-slate-800 text-xs shrink-0"
                                            >
                                                <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${isGeneratingId ? "animate-spin" : ""}`} />
                                                Acak Ulang
                                            </Button>
                                        </div>
                                        <p className="text-[11px] text-slate-400">
                                            Nomor ini otomatis dipilih secara acak dan dipastikan belum pernah digunakan di mesin {machine.name}.
                                        </p>
                                    </div>

                                    {/* Submit Button */}
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || isGeneratingId}
                                        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 text-sm transition-all"
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

                    {/* TAB 2: DAFTAR ID FINGER TERDAFTAR */}
                    <TabsContent value="list" className="space-y-4 focus-visible:outline-none">
                        <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-2xl">
                            <CardHeader className="space-y-1 pb-4 border-b border-slate-800/80">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg text-white">
                                            Daftar ID Terdaftar
                                        </CardTitle>
                                        <CardDescription className="text-slate-400 text-xs">
                                            Daftar pegawai yang telah memiliki ID pada {machine.name}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={loadRegisteredList}
                                        disabled={isLoadingList}
                                        className="text-xs text-slate-400 hover:text-white"
                                    >
                                        <RotateCw className={`h-3.5 w-3.5 mr-1 ${isLoadingList ? "animate-spin" : ""}`} />
                                        Refresh
                                    </Button>
                                </div>

                                {/* Live Search Input */}
                                <div className="relative pt-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Cari berdasarkan nama atau no ID..."
                                        className="pl-9 bg-slate-950/80 border-slate-700 text-white placeholder:text-slate-500 h-10 text-sm focus-visible:ring-primary"
                                    />
                                </div>
                            </CardHeader>

                            <CardContent className="pt-4 max-h-[60vh] overflow-y-auto divide-y divide-slate-800/60">
                                {isLoadingList ? (
                                    <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        <span className="text-xs">Memuat daftar terdaftar...</span>
                                    </div>
                                ) : filteredList.length === 0 ? (
                                    <div className="py-8 text-center text-slate-400 space-y-1">
                                        <p className="text-sm font-medium">Tidak ada data ditemukan</p>
                                        <p className="text-xs text-slate-500">
                                            {searchQuery
                                                ? "Tidak ada hasil yang cocok dengan pencarian Anda."
                                                : "Belum ada pegawai yang terdaftar di mesin ini."}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 pt-1">
                                        {filteredList.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 hover:bg-slate-950/80 transition-colors border border-slate-800/50"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9 border border-slate-700">
                                                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                            {getInitials(item.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <span className="font-medium text-sm text-slate-200 block">
                                                            {item.name}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500">
                                                            ID Mesin: {machine.name}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary/15 border border-primary/30 text-primary font-mono font-bold text-sm tracking-wider">
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
            <div className="mt-8 text-center text-xs text-slate-500">
                <span>© {new Date().getFullYear()} IT Helpdesk SIMRS • Biometric System</span>
            </div>
        </div>
    );
}
