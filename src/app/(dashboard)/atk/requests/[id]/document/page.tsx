"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

type RequestData = {
    id: string;
    document_number: string | null;
    created_at: string;
    updated_at: string;
    notes: string | null;
    approval_signature_url: string | null;
    profiles: { full_name: string; nip?: string } | null;
    locations: { name: string } | null;
    approver: { full_name: string; nip?: string } | null;
    completer: { full_name: string; nip?: string } | null;
    atk_request_items: {
        id: string;
        quantity: number;
        approved_quantity: number | null;
        atk_items: { name: string; unit: string };
    }[];
};

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
    const [request, setRequest] = useState<RequestData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            const { id } = await params;
            const supabase = createClient();
            const { data } = await supabase
                .from("atk_requests")
                .select(`
                    id,
                    document_number,
                    created_at,
                    updated_at,
                    notes,
                    approval_signature_url,
                    profiles:requester_id(full_name, nip),
                    locations:location_id(name),
                    approver:approved_by(full_name, nip),
                    completer:completed_by(full_name, nip),
                    atk_request_items(
                        id,
                        quantity,
                        approved_quantity,
                        atk_items(name, unit)
                    )
                `)
                .eq("id", id)
                .single();

            setRequest(data as unknown as RequestData);
            setLoading(false);
        }
        fetchData();
    }, [params]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Loading...</p>
            </div>
        );
    }

    if (!request) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Document not found</p>
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
                {/* Header with Logo */}
                <div className="flex items-start gap-4 border-b-2 border-black pb-4 mb-6">
                    <div className="w-36 h-36 flex-shrink-0">
                        <img src="/logo-bandung.png" alt="Logo" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    </div>
                    <div className="flex-1 text-center">
                        <p className="text-2xl font-bold">PEMERINTAH KABUPATEN BANDUNG</p>
                        <p className="text-2xl font-bold">DINAS KESEHATAN</p>
                        <p className="text-4xl font-bold">RUMAH SAKIT UMUM DAERAH CICALENGKA</p>
                        <p className="text-sm">Jalan Haji Darham No.35, Tenjolaya, Cicalengka Kabupaten Bandung Jawa Barat 40395</p>
                        <p className="text-sm">Telepon (022) 7952203 Faximile (022) 7952204</p>
                        <p className="text-sm">Laman rsudcicalengka.bandungkab.go.id, Pos-el rsudcicalengka@bandungkab.go.id</p>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-6">
                    <h2 className="text-lg font-bold underline">SURAT PERMINTAAN BARANG (SPB)</h2>
                    <p className="text-base mt-2">Nomor : {request.document_number || "..............................."}</p>
                </div>

                {/* Table */}
                <table className="w-full border-collapse border border-black mb-8 text-base">
                    <thead>
                        <tr>
                            <th className="border border-black p-2 text-center w-12">No.</th>
                            <th className="border border-black p-2 text-center">Nama / Jenis Barang</th>
                            <th className="border border-black p-2 text-center w-20">Banyaknya</th>
                            <th className="border border-black p-2 text-center w-24">Unit Kerja</th>
                            <th className="border border-black p-2 text-center w-24">Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {request.atk_request_items.map((item, idx) => (
                            <tr key={item.id}>
                                <td className="border border-black p-2 text-center">{idx + 1}</td>
                                <td className="border border-black p-2">{item.atk_items?.name}</td>
                                <td className="border border-black p-2 text-center">{item.approved_quantity || item.quantity} {item.atk_items?.unit}</td>
                                <td className="border border-black p-2 text-center">{request.locations?.name || "-"}</td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                        {/* Empty rows for manual filling */}
                        {Array.from({ length: Math.max(0, 8 - request.atk_request_items.length) }).map((_, idx) => (
                            <tr key={`empty-${idx}`}>
                                <td className="border border-black p-2 h-8">&nbsp;</td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Signatures - 3 columns */}
                <div className="mt-8">
                    <div className="text-right mb-4 text-base">
                        <p>Cicalengka, {new Date(request.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                    <div className="flex justify-between text-center text-base">
                        <div className="w-1/3 px-2">
                            <p className="font-semibold">Yang Menyerahkan</p>
                            <p>Pemegang Barang</p>
                            <div className="h-24"></div>
                            <p className="border-t border-black pt-1 mx-4">{request.completer?.full_name || "................................"}</p>
                        </div>
                        <div className="w-1/3 px-2">
                            <p className="font-semibold">Mengetahui / Menyetujui</p>
                            <p>Sekretaris RSUD Cicalengka</p>
                            <div className="h-24"></div>
                            <p className="border-t border-black pt-1 mx-4">................................</p>
                        </div>
                        <div className="w-1/3 px-2">
                            <p className="font-semibold">Yang mengusulkan /</p>
                            <p>menerima barang</p>
                            <div className="h-24 flex items-end justify-center">
                                {request.approval_signature_url && (
                                    <img
                                        src={request.approval_signature_url}
                                        alt="Signature"
                                        className="h-16 mx-auto"
                                    />
                                )}
                            </div>
                            <p className="border-t border-black pt-1 mx-4">{request.profiles?.full_name || "................................"}</p>
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

