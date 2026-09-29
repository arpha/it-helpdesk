"use client";

import { useQuery } from "@tanstack/react-query";
import { getFingerprintMachines } from "@/app/(dashboard)/master/fingerprints/machines-actions";
import type { FingerprintMachine } from "@/types/fingerprint";

export function useFingerprintMachines() {
    return useQuery({
        queryKey: ["fingerprint_machines"],
        queryFn: async () => {
            const result = await getFingerprintMachines();
            return result.machines;
        },
    });
}
