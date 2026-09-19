"use client";

import { Clock, Info } from "lucide-react";
import { SLA_CONFIG } from "../types";

export default function SlaLegendBanner() {
    return (
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 text-card-foreground shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Clock className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">Pedoman Batas Waktu Layanan (SLA Helpdesk)</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                                Target Teknisi
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Target waktu penyelesaian tiket sejak dibuat pelapor untuk menjaga kepuasan pengguna.
                        </p>
                    </div>
                </div>

                {/* Badges for SLA limits */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
                        <span className="font-semibold text-red-600 dark:text-red-400">Urgent</span>
                        <span className="font-mono font-bold text-red-700 dark:text-red-300">≤ 4 Jam</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs">
                        <span className="font-semibold text-orange-600 dark:text-orange-400">High</span>
                        <span className="font-mono font-bold text-orange-700 dark:text-orange-300">≤ 8 Jam</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs">
                        <span className="font-semibold text-yellow-600 dark:text-yellow-400">Medium</span>
                        <span className="font-mono font-bold text-yellow-700 dark:text-yellow-300">≤ 24 Jam</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">Low</span>
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-300">≤ 48 Jam</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
