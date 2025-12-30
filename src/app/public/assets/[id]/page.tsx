import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, MapPin, User, Calendar, Tag, Info } from "lucide-react";
import Image from "next/image";

const statusLabels: Record<string, string> = {
    active: "Active",
    maintenance: "Maintenance",
    damage: "Damage",
    disposed: "Disposed",
};

const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-500",
    maintenance: "bg-yellow-500/10 text-yellow-500",
    damage: "bg-red-500/10 text-red-500",
    disposed: "bg-gray-500/10 text-gray-500",
};

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function PublicAssetPage({ params }: PageProps) {
    const { id } = await params;
    // Use admin client since this is a public page without auth session
    const supabase = await createClient({ isAdmin: true });

    const { data: asset, error } = await supabase
        .from("assets")
        .select(`
            *,
            asset_categories(name),
            locations(name),
            profiles:assigned_to(full_name, username)
        `)
        .eq("id", id)
        .single();

    if (error || !asset) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 sm:p-8">
            <div className="max-w-2xl mx-auto">
                <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
                    <CardHeader className="text-center border-b border-white/10 pb-6">
                        <div className="mx-auto mb-4">
                            {asset.image_url ? (
                                <Image
                                    src={asset.image_url}
                                    alt={asset.name}
                                    width={120}
                                    height={120}
                                    className="rounded-xl object-cover"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-xl bg-white/10 flex items-center justify-center mx-auto">
                                    <Monitor className="h-12 w-12 text-white/50" />
                                </div>
                            )}
                        </div>
                        <CardTitle className="text-2xl font-bold">{asset.name}</CardTitle>
                        <p className="text-white/60 font-mono">{asset.asset_code}</p>
                        <Badge className={`mt-2 ${statusColors[asset.status]}`}>
                            {statusLabels[asset.status]}
                        </Badge>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid gap-4">
                            {/* Category */}
                            <div className="flex items-center gap-3 text-white/80">
                                <Tag className="h-5 w-5 text-white/50" />
                                <div>
                                    <p className="text-xs text-white/50">Category</p>
                                    <p className="font-medium">{asset.asset_categories?.name || "-"}</p>
                                </div>
                            </div>

                            {/* Serial Number */}
                            {asset.serial_number && (
                                <div className="flex items-center gap-3 text-white/80">
                                    <Info className="h-5 w-5 text-white/50" />
                                    <div>
                                        <p className="text-xs text-white/50">Serial Number</p>
                                        <p className="font-medium font-mono">{asset.serial_number}</p>
                                    </div>
                                </div>
                            )}

                            {/* Location */}
                            <div className="flex items-center gap-3 text-white/80">
                                <MapPin className="h-5 w-5 text-white/50" />
                                <div>
                                    <p className="text-xs text-white/50">Location</p>
                                    <p className="font-medium">{asset.locations?.name || "-"}</p>
                                </div>
                            </div>

                            {/* Assigned To */}
                            <div className="flex items-center gap-3 text-white/80">
                                <User className="h-5 w-5 text-white/50" />
                                <div>
                                    <p className="text-xs text-white/50">Assigned To</p>
                                    <p className="font-medium">{asset.profiles?.full_name || asset.profiles?.username || "-"}</p>
                                </div>
                            </div>

                            {/* Purchase Date */}
                            {asset.purchase_date && (
                                <div className="flex items-center gap-3 text-white/80">
                                    <Calendar className="h-5 w-5 text-white/50" />
                                    <div>
                                        <p className="text-xs text-white/50">Purchase Date</p>
                                        <p className="font-medium">
                                            {new Date(asset.purchase_date).toLocaleDateString("id-ID", {
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric"
                                            })}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Specifications */}
                            {asset.specifications && Object.keys(asset.specifications).length > 0 && (
                                <div className="border-t border-white/10 pt-4 mt-4">
                                    <h3 className="font-semibold mb-3 text-white/80">Specifications</h3>
                                    <div className="grid gap-2">
                                        {Object.entries(asset.specifications).map(([key, value]) => (
                                            <div key={key} className="flex justify-between text-sm">
                                                <span className="text-white/50 capitalize">{key.replace(/_/g, " ")}</span>
                                                <span className="text-white/80 font-medium">{value as string}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        {asset.notes && (
                            <div className="border-t border-white/10 pt-4">
                                <p className="text-xs text-white/50 mb-1">Notes</p>
                                <p className="text-white/80 text-sm">{asset.notes}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <p className="text-center text-white/40 text-xs mt-4">
                    IT Governance - Asset Management System
                </p>
            </div>
        </div>
    );
}
