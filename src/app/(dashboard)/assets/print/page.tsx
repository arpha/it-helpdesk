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
                    <p className="text-muted-foreground">{assets.length} label(s) ready to print</p>
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

            {/* Labels - 1 per page (6cm x 6cm) */}
            <div className="flex flex-wrap gap-4 print:block">
                {assets.map((asset, index) => (
                    <Card
                        key={asset.id}
                        className="print:shadow-none print:border print:mb-0"
                        style={{
                            width: "6cm",
                            height: "6cm",
                            padding: "0.5cm",
                            pageBreakAfter: index < assets.length - 1 ? "always" : "auto",
                        }}
                    >
                        <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center">
                            {/* QR Code */}
                            <div className="flex-1 flex items-center justify-center">
                                <Image
                                    src={asset.qrCode}
                                    alt={`QR code for ${asset.name}`}
                                    width={150}
                                    height={150}
                                    className="print:w-[4cm] print:h-[4cm]"
                                />
                            </div>
                            {/* Asset Info */}
                            <div className="mt-1">
                                <p className="font-bold text-xs truncate max-w-[5cm]" title={asset.name}>
                                    {asset.name}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">
                                    {asset.asset_code}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: 6cm 6cm;
                        margin: 0;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        margin: 0;
                        padding: 0;
                    }
                    .print\\:hidden {
                        display: none !important;
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
