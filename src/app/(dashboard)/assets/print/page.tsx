"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type AssetData = {
    id: string;
    name: string;
    asset_code: string;
    qrCode: string;
    location: string;
    serial: string;
};

function PrintContent() {
    const searchParams = useSearchParams();
    const idsParam = searchParams.get("ids");
    const [assets, setAssets] = useState<AssetData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAssets() {
            if (!idsParam) {
                setLoading(false);
                return;
            }

            const ids = idsParam.split(",");
            const assetsData: AssetData[] = [];

            for (const id of ids) {
                try {
                    // Fetch asset data
                    const assetRes = await fetch(`/api/assets/${id}`);
                    const assetJson = await assetRes.json();

                    // Fetch QR code
                    const qrRes = await fetch(`/api/assets/qr?id=${id}`);
                    const qrJson = await qrRes.json();

                    if (assetJson.data && qrJson.success) {
                        assetsData.push({
                            id: assetJson.data.id,
                            name: assetJson.data.name,
                            asset_code: assetJson.data.asset_code,
                            qrCode: qrJson.data.qrCode,
                            location: assetJson.data.locations?.name || "No Location",
                            serial: assetJson.data.serial_number || "No SN",
                        });
                    }
                } catch (error) {
                    console.error(`Failed to fetch asset ${id}:`, error);
                }
            }

            setAssets(assetsData);
            setLoading(false);
        }

        fetchAssets();
    }, [idsParam]);

    // Auto-print when loaded
    useEffect(() => {
        if (!loading && assets.length > 0) {
            // Small delay to ensure images are rendered
            const timer = setTimeout(() => {
                window.print();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [loading, assets]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (assets.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-muted-foreground">No assets selected for printing.</p>
                <Link href="/assets">
                    <Button variant="outline" className="mt-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Assets
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header - hidden when printing */}
            <div className="flex items-center justify-between print:hidden">
                <div>
                    <h1 className="text-2xl font-bold">Print QR Labels</h1>
                    <p className="text-muted-foreground">{assets.length} label(s) ready to print (A5 Landscape)</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/assets">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                    <Button onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                </div>
            </div>

            {/* Labels Grid for A5 */}
            <div className="print:block flex flex-wrap gap-2 content-start">
                {assets.map((asset) => (
                    <div
                        key={asset.id}
                        className="relative border border-gray-200 overflow-hidden bg-white print:border-none"
                        style={{
                            width: "1in",
                            height: "1.25in",
                            padding: "0.05in",
                            boxSizing: "border-box",
                            display: "inline-flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            pageBreakInside: "avoid"
                        }}
                    >
                        {/* Location - Top Left tiny */}
                        <div className="absolute top-[2px] left-[2px] text-[4px] font-bold text-black uppercase leading-none tracking-tighter">
                            {asset.location !== "No Location" ? asset.location.substring(0, 10) : ""}
                        </div>

                        {/* QR Code - Maximize area */}
                        <div className="flex-1 flex items-center justify-center w-full h-full overflow-hidden">
                            <Image
                                src={asset.qrCode}
                                alt="QR"
                                width={100}
                                height={100}
                                className="w-full h-full object-contain"
                                style={{ transform: "scale(1.2)" }}
                            />
                        </div>

                        {/* Text Info - Extremely small */}
                        <div className="w-full mt-[1px] leading-none">
                            <p className="font-bold text-[5px] truncate px-[1px]">{asset.name}</p>
                            <p className="text-[5px] font-mono truncate">{asset.asset_code}</p>
                            <p className="text-[4px] text-gray-600 truncate">SN:{asset.serial.substring(0, 8)}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Print Styles: A5 Landscape & Grid */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A5 landscape; /* 210mm x 148mm */
                        margin: 0.2in;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100%;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .print\\:block {
                        display: flex !important;
                        flex-wrap: wrap !important;
                        align-content: flex-start !important;
                        justify-content: flex-start !important;
                        gap: 0 !important;
                    }
                    .print\\:border-none {
                        border: 1px dashed #ddd !important; 
                    }
                }
            `}</style>
        </div>
    );
}

export default function PrintPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        }>
            <PrintContent />
        </Suspense>
    );
}
