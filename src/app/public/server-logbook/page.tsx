"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { checkInServerRoom, checkOutServerRoom, getActiveLogById } from "./actions";
import { Shield, ShieldAlert, ShieldCheck, Clock, Thermometer, UserCheck, Loader2 } from "lucide-react";

export default function PublicServerLogbookPage() {
    const [activeLogId, setActiveLogId] = useState<string | null>(null);
    const [visitorName, setVisitorName] = useState("");
    const [visitorType, setVisitorType] = useState("internal_it");
    const [companyOrUnit, setCompanyOrUnit] = useState("");
    const [purpose, setPurpose] = useState("");
    const [temperature, setTemperature] = useState("");
    const [notes, setNotes] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingSession, setIsLoadingSession] = useState(true);
    
    // Timer states for active visit
    const [checkInTime, setCheckInTime] = useState<Date | null>(null);
    const [durationText, setDurationText] = useState("00:00:00");

    useEffect(() => {
        const storedLogId = localStorage.getItem("active_server_log_id");
        if (storedLogId) {
            verifyActiveSession(storedLogId);
        } else {
            setIsLoadingSession(false);
        }
    }, []);

    // Session status timer
    useEffect(() => {
        if (!checkInTime) return;

        const interval = setInterval(() => {
            const now = new Date();
            const diff = now.getTime() - checkInTime.getTime();
            
            const secs = Math.floor((diff / 1000) % 60);
            const mins = Math.floor((diff / (1000 * 60)) % 60);
            const hrs = Math.floor((diff / (1000 * 60 * 60)) % 24);

            const format = (num: number) => String(num).padStart(2, '0');
            setDurationText(`${format(hrs)}:${format(mins)}:${format(secs)}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [checkInTime]);

    const verifyActiveSession = async (logId: string) => {
        try {
            const res = await getActiveLogById(logId);
            if (res.success && res.data) {
                setActiveLogId(res.data.id);
                setCheckInTime(new Date(res.data.check_in_time));
                setVisitorName(res.data.visitor_name);
            } else {
                // Session is completed or deleted, reset state and localStorage
                localStorage.removeItem("active_server_log_id");
                setActiveLogId(null);
                setCheckInTime(null);
                setVisitorName("");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingSession(false);
        }
    };

    // Poll server room log status every 5 seconds when session is active
    useEffect(() => {
        if (!activeLogId) return;

        const interval = setInterval(() => {
            verifyActiveSession(activeLogId);
        }, 5000);

        return () => clearInterval(interval);
    }, [activeLogId]);

    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!visitorName.trim()) {
            toast.error("Nama wajib diisi");
            return;
        }
        if (!purpose.trim()) {
            toast.error("Tujuan akses wajib diisi");
            return;
        }

        setIsSubmitting(true);
        try {
            const tempVal = temperature.trim() ? parseFloat(temperature) : undefined;
            if (tempVal !== undefined && (isNaN(tempVal) || tempVal < 10 || tempVal > 45)) {
                toast.error("Format input suhu tidak valid (contoh: 21.5)");
                setIsSubmitting(false);
                return;
            }

            const res = await checkInServerRoom({
                visitor_name: visitorName,
                visitor_type: visitorType,
                company_or_unit: companyOrUnit,
                purpose: purpose,
                temperature: tempVal,
                notes: notes
            });

            if (res.success && res.data) {
                toast.success("Check-In Berhasil! Silakan masuk.");
                setActiveLogId(res.data.id);
                setCheckInTime(new Date(res.data.check_in_time));
                localStorage.setItem("active_server_log_id", res.data.id);
            } else {
                toast.error(res.error || "Gagal melakukan Check-In");
            }
        } catch (error) {
            console.error(error);
            toast.error("Terjadi kesalahan koneksi");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCheckOut = async () => {
        if (!activeLogId) return;

        setIsSubmitting(true);
        try {
            const res = await checkOutServerRoom(activeLogId);
            if (res.success) {
                toast.success("Check-Out Berhasil! Terima kasih.");
                localStorage.removeItem("active_server_log_id");
                setActiveLogId(null);
                setCheckInTime(null);
                // Clear Form
                setVisitorName("");
                setCompanyOrUnit("");
                setPurpose("");
                setTemperature("");
                setNotes("");
            } else {
                toast.error(res.error || "Gagal melakukan Check-Out");
            }
        } catch (error) {
            console.error(error);
            toast.error("Terjadi kesalahan koneksi");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingSession) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-4">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Memuat Logbook Akses...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-slate-900 text-slate-100 px-4 py-8">
            <div className="mx-auto w-full max-w-md space-y-6">
                
                {/* Brand / Logo */}
                <div className="text-center space-y-2">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30">
                        <Shield className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">SI-Mantap Logbook</h1>
                        <p className="text-sm text-slate-400">Akses Pintu Masuk Ruang Server Utama</p>
                    </div>
                </div>

                {activeLogId ? (
                    /* Active Session Check-Out Screen */
                    <Card className="border-green-500/30 bg-slate-950 text-slate-100">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto h-16 w-16 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center border border-green-500/20 mb-2">
                                <ShieldCheck className="h-8 w-8" />
                            </div>
                            <CardTitle className="text-xl font-bold">Akses Anda Sedang Aktif</CardTitle>
                            <CardDescription className="text-slate-400">
                                Sesi masuk terdaftar atas nama: <strong className="text-slate-200">{visitorName}</strong>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-4 text-center">
                            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
                                <span className="text-xs text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" /> Durasi Kunjungan
                                </span>
                                <div className="text-3xl font-mono font-bold tracking-wider text-green-400">
                                    {durationText}
                                </div>
                                <p className="text-xs text-slate-500">
                                    Mulai masuk: {checkInTime?.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} WIB
                                </p>
                            </div>

                            <Button 
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold h-12 text-base shadow-lg shadow-green-600/20"
                                onClick={handleCheckOut}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Mencatat Check-Out...
                                    </>
                                ) : (
                                    "CHECK OUT SEKARANG"
                                )}
                            </Button>
                            
                            <p className="text-xs text-slate-500 text-center">
                                *Harap tekan tombol di atas saat Anda keluar dari ruangan.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    /* Entry Check-In Form Screen */
                    <Card className="border-slate-800 bg-slate-950 text-slate-100">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <UserCheck className="h-5 w-5 text-primary" />
                                Form Kunjungan Masuk
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                Isi data diri di bawah ini sebelum memasuki pintu server.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCheckIn} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="visitor_name" className="text-slate-300">Nama Lengkap <span className="text-primary">*</span></Label>
                                    <Input
                                        id="visitor_name"
                                        placeholder="Nama lengkap Anda..."
                                        value={visitorName}
                                        onChange={(e) => setVisitorName(e.target.value)}
                                        className="bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500 focus-visible:ring-primary"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-slate-300">Tipe Petugas <span className="text-primary">*</span></Label>
                                        <Select value={visitorType} onValueChange={setVisitorType}>
                                            <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-100 focus:ring-primary">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
                                                <SelectItem value="internal_it">Petugas IT</SelectItem>
                                                <SelectItem value="vendor">Vendor Luar</SelectItem>
                                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                                <SelectItem value="other">Lainnya</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="unit" className="text-slate-300">Instansi / Unit Kerja</Label>
                                        <Input
                                            id="unit"
                                            placeholder="Unit Gizi / CV. Tech"
                                            value={companyOrUnit}
                                            onChange={(e) => setCompanyOrUnit(e.target.value)}
                                            className="bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500 focus-visible:ring-primary"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="purpose" className="text-slate-300">Tujuan Akses <span className="text-primary">*</span></Label>
                                    <Input
                                        id="purpose"
                                        placeholder="Contoh: Perbaikan Switch, Monitoring UPS"
                                        value={purpose}
                                        onChange={(e) => setPurpose(e.target.value)}
                                        className="bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500 focus-visible:ring-primary"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="temp" className="text-slate-300 flex items-center gap-1">
                                        <Thermometer className="h-4 w-4 text-slate-400" />
                                        Suhu Ruang Server (°C - Opsional)
                                    </Label>
                                    <Input
                                        id="temp"
                                        type="number"
                                        step="0.1"
                                        placeholder="Contoh: 20.5"
                                        value={temperature}
                                        onChange={(e) => setTemperature(e.target.value)}
                                        className="bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500 focus-visible:ring-primary"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="notes" className="text-slate-300">Keterangan Tambahan / Catatan</Label>
                                    <Textarea
                                        id="notes"
                                        placeholder="Keterangan opsional..."
                                        rows={2}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500 focus-visible:ring-primary"
                                    />
                                </div>

                                <Button 
                                    type="submit" 
                                    className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-11 shadow-md"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Menyimpan data masuk...
                                        </>
                                    ) : (
                                        "CHECK IN MASUK"
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
