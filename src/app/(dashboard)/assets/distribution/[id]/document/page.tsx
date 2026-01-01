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
    receiver: { full_name: string; nip?: string } | null;
    distributor: { full_name: string; nip?: string } | null;
    asset_distribution_items: {
        id: string;
        condition: string;
        assets: { name: string; asset_code: string | null };
    }[];
};

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
    const [distribution, setDistribution] = useState<DistributionData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            const { id } = await params;
            const supabase = createClient();
            const { data } = await supabase
                .from("asset_distributions")
                .select(`
                    id,
                    document_number,
                    notes,
                    created_at,
                    distributed_at,
                    receiver_signature_url,
                    locations:destination_location_id(name),
                    receiver:receiver_id(full_name, nip),
                    distributor:distributed_by(full_name, nip),
                    asset_distribution_items(
                        id,
                        condition,
                        assets(name, asset_code)
                    )
                `)
                .eq("id", id)
                .single();

            setDistribution(data as unknown as DistributionData);
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

    if (!distribution) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Document not found</p>
            </div>
        );
    }

    return (
        <>
            {/* Print Button */}
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
                        {/* Empty rows */}
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
                    <div className="mb-6">
                        <p className="font-medium">Catatan:</p>
                        <p>{distribution.notes}</p>
                    </div>
                )}

                {/* Signatures */}
                <div className="flex justify-between mt-12">
                    <div className="text-center w-48">
                        <p className="mb-20">Yang Menyerahkan,</p>
                        <p className="border-b border-black mb-1">
                            {distribution.distributor?.full_name || "............................"}
                        </p>
                        {distribution.distributor?.nip && (
                            <p className="text-sm">NIP. {distribution.distributor.nip}</p>
                        )}
                    </div>
                    <div className="text-center w-48">
                        <p className="mb-4">Yang Menerima,</p>
                        {distribution.receiver_signature_url ? (
                            <img
                                src={distribution.receiver_signature_url}
                                alt="Signature"
                                className="mx-auto h-16 mb-1"
                            />
                        ) : (
                            <div className="h-16 mb-1"></div>
                        )}
                        <p className="border-b border-black mb-1">
                            {distribution.receiver?.full_name || "............................"}
                        </p>
                        {distribution.receiver?.nip && (
                            <p className="text-sm">NIP. {distribution.receiver.nip}</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
