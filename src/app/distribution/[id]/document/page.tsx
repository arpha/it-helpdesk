"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

type DistributionData = {
    id: string;
    document_number: string | null;
    notes: string | null;
    created_at: string;
    distributed_at: string | null;
    receiver_signature_url: string | null;
    locations: { name: string } | null;
    receiver: { full_name: string } | null;
    distributor: { full_name: string } | null;
    asset_distribution_items: {
        id: string;
        condition: string;
        assets: { name: string; asset_code: string | null };
    }[];
};

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
    const [distribution, setDistribution] = useState<DistributionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            const { id } = await params;
            const supabase = createClient();
            const { data, error } = await supabase
                .from("asset_distributions")
                .select(`
                    id,
                    document_number,
                    notes,
                    created_at,
                    distributed_at,
                    receiver_signature_url,
                    locations:destination_location_id(name),
                    receiver:receiver_id(full_name),
                    distributor:distributed_by(full_name),
                    asset_distribution_items(
                        id,
                        condition,
                        assets(name, asset_code)
                    )
                `)
                .eq("id", id)
                .single();

            if (error) {
                console.error("Error fetching distribution:", error.message, error.code, error.details);
                setErrorMsg(error.message || "Terjadi kesalahan saat mengambil data");
            }
            setDistribution(data as unknown as DistributionData);
            setLoading(false);
        }
        fetchData();
    }, [params]);

    // Auto-open print dialog when document is loaded
    useEffect(() => {
        if (distribution && !loading) {
            setTimeout(() => {
                window.print();
                // Close tab after print dialog is closed
                window.close();
            }, 500);
        }
    }, [distribution, loading]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <p>Loading...</p>
            </div>
        );
    }

    if (!distribution) {
        return (
            <div className="flex items-center justify-center min-h-screen flex-col gap-2 bg-white">
                <p className="text-lg font-semibold">Document not found</p>
                {errorMsg && <p className="text-sm text-gray-500">{errorMsg}</p>}
            </div>
        );
    }

    return (
        <>
            {/* Print Button - hidden when printing */}
            <div className="fixed top-4 right-4 print:hidden z-50">
                <Button onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Print
                </Button>
            </div>

            {/* Document Content */}
            <div className="max-w-4xl mx-auto p-8 bg-white text-black min-h-screen print:p-2 print:max-w-none">
                {/* Header with Logo - Same as SPB */}
                <div className="flex items-start gap-4 border-b-2 border-black pb-4 mb-6">
                    <div className="w-36 h-36 flex-shrink-0">
                        <img src="/logo-bandung.png" alt="Logo" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    </div>
                    <div className="flex-1 text-center">
                        <p className="text-lg font-bold">PEMERINTAH KABUPATEN BANDUNG</p>
                        <p className="text-lg font-bold">DINAS KESEHATAN</p>
                        <p className="text-2xl font-bold">RUMAH SAKIT UMUM DAERAH CICALENGKA</p>
                        <p className="text-sm">Jalan Haji Darham No.35, Tenjolaya, Cicalengka Kabupaten Bandung Jawa Barat 40395</p>
                        <p className="text-sm">Telepon (022) 7952203 Faximile (022) 7952204</p>
                        <p className="text-sm">Laman rsudcicalengka.bandungkab.go.id, Pos-el rsudcicalengka@bandungkab.go.id</p>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-6">
                    <h2 className="text-lg font-bold underline">SURAT BUKTI BARANG KELUAR (SBBK)</h2>
                    <p className="text-base mt-2">Nomor : {distribution.document_number || "..............................."}</p>
                </div>

                {/* Info */}
                <div className="mb-6 space-y-1 text-base">
                    <p>Tanggal : {distribution.distributed_at
                        ? new Date(distribution.distributed_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                        : new Date(distribution.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                    }</p>
                    <p>Lokasi Tujuan : {distribution.locations?.name || "-"}</p>
                    <p>Penerima : {distribution.receiver?.full_name || "-"}</p>
                </div>

                {/* Table */}
                <table className="w-full border-collapse border border-black mb-8 text-base">
                    <thead>
                        <tr>
                            <th className="border border-black p-2 text-center w-12">No.</th>
                            <th className="border border-black p-2 text-center">Nama Asset</th>
                            <th className="border border-black p-2 text-center w-32">Kode Asset</th>
                            <th className="border border-black p-2 text-center w-24">Kondisi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {distribution.asset_distribution_items.map((item, idx) => (
                            <tr key={item.id}>
                                <td className="border border-black p-2 text-center">{idx + 1}</td>
                                <td className="border border-black p-2">{item.assets?.name}</td>
                                <td className="border border-black p-2 text-center">{item.assets?.asset_code || "-"}</td>
                                <td className="border border-black p-2 text-center">{item.condition}</td>
                            </tr>
                        ))}
                        {/* Empty rows for manual filling */}
                        {Array.from({ length: Math.max(0, 8 - distribution.asset_distribution_items.length) }).map((_, idx) => (
                            <tr key={`empty-${idx}`}>
                                <td className="border border-black p-2 h-8">&nbsp;</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Notes */}
                {distribution.notes && (
                    <div className="mb-6 text-base">
                        <p><strong>Catatan:</strong> {distribution.notes}</p>
                    </div>
                )}

                {/* Signatures - 3 columns like SPB */}
                <div className="mt-8">
                    <div className="text-right mb-4 text-base">
                        <p>Cicalengka, {distribution.distributed_at
                            ? new Date(distribution.distributed_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                            : new Date(distribution.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                        }</p>
                    </div>
                    <div className="flex justify-between text-center text-base">
                        <div className="w-1/3 px-2">
                            <p className="font-semibold">Yang Menyerahkan</p>
                            <p>Pemegang Barang</p>
                            <div className="h-24"></div>
                            <p className="border-t border-black pt-1 mx-4">{distribution.distributor?.full_name || "................................"}</p>
                        </div>
                        <div className="w-1/3 px-2">
                            <p className="font-semibold">Mengetahui / Menyetujui</p>
                            <p>Sekretaris RSUD Cicalengka</p>
                            <div className="h-24"></div>
                            <p className="border-t border-black pt-1 mx-4">................................</p>
                        </div>
                        <div className="w-1/3 px-2">
                            <p className="font-semibold">Yang Menerima</p>
                            <p>&nbsp;</p>
                            <div className="h-24 flex items-end justify-center">
                                {distribution.receiver_signature_url && (
                                    <img
                                        src={distribution.receiver_signature_url}
                                        alt="Signature"
                                        className="h-16 mx-auto"
                                    />
                                )}
                            </div>
                            <p className="border-t border-black pt-1 mx-4">{distribution.receiver?.full_name || "................................"}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 5mm;
                    }
                    body {
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </>
    );
}
