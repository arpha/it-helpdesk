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
    approval_signature_url: string | null;
    profiles: { full_name: string } | null;
    locations: { name: string } | null;
    approver: { full_name: string } | null;
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
                    approval_signature_url,
                    profiles:requester_id(full_name),
                    locations:location_id(name),
                    approver:approved_by(full_name),
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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

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
            <div className="max-w-3xl mx-auto p-8 bg-white text-black min-h-screen print:p-0">
                {/* Header */}
                <div className="text-center border-b-2 border-black pb-4 mb-6">
                    <h1 className="text-xl font-bold">RSUD CIKALONG CILEGON KOTA</h1>
                    <p className="text-sm">Jl. Raya Cilegon No. 123, Cilegon, Banten</p>
                    <p className="text-sm">Telp: (0254) 123456 | Email: rsudcclk@cilegon.go.id</p>
                </div>

                {/* Title */}
                <div className="text-center mb-6">
                    <h2 className="text-lg font-bold underline">SURAT PENGELUARAN BARANG</h2>
                    <p className="text-sm mt-1">No: {request.document_number || "-"}</p>
                </div>

                {/* Info */}
                <div className="mb-6 space-y-2">
                    <p><span className="inline-block w-32">Tanggal</span>: {formatDate(request.updated_at)}</p>
                    <p><span className="inline-block w-32">Penerima</span>: {request.profiles?.full_name || "-"}</p>
                    <p><span className="inline-block w-32">Lokasi</span>: {request.locations?.name || "-"}</p>
                </div>

                {/* Table */}
                <table className="w-full border-collapse border border-black mb-8">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-2 text-left w-12">No</th>
                            <th className="border border-black p-2 text-left">Nama Barang</th>
                            <th className="border border-black p-2 text-center w-24">Qty</th>
                            <th className="border border-black p-2 text-center w-24">Satuan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {request.atk_request_items.map((item, idx) => (
                            <tr key={item.id}>
                                <td className="border border-black p-2">{idx + 1}</td>
                                <td className="border border-black p-2">{item.atk_items?.name}</td>
                                <td className="border border-black p-2 text-center">{item.approved_quantity || item.quantity}</td>
                                <td className="border border-black p-2 text-center">{item.atk_items?.unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Signatures */}
                <div className="flex justify-between mt-12">
                    <div className="text-center w-48">
                        <p className="mb-20">Penerima Barang</p>
                        {request.approval_signature_url && (
                            <img
                                src={request.approval_signature_url}
                                alt="Signature"
                                className="h-16 mx-auto mb-2"
                            />
                        )}
                        <p className="border-t border-black pt-1">{request.profiles?.full_name || "-"}</p>
                    </div>
                    <div className="text-center w-48">
                        <p className="mb-20">Pengeluar Barang</p>
                        <div className="h-16 mb-2"></div>
                        <p className="border-t border-black pt-1">{request.approver?.full_name || "-"}</p>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body {
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .print\\:p-0 {
                        padding: 0 !important;
                    }
                }
            `}</style>
        </>
    );
}
