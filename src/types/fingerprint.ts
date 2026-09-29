export type FingerprintMachine = {
    id: string;
    name: string;
    code: string;
    location: string | null;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
};

export type FingerprintMachineEntry = {
    id: string;
    fingerprint_id: string;
    machine_id: string;
    finger_id: string;
    created_at?: string;
    updated_at?: string;
    machine?: FingerprintMachine;
};

export type Fingerprint = {
    id: string;
    name: string;
    user_id: string | null;
    finger_picu?: string | null;
    finger_vk?: string | null;
    finger_neo1?: string | null;
    finger_neo2?: string | null;
    finger_absensi?: string | null;
    created_at: string;
    updated_at: string;
    profiles?: {
        id: string;
        full_name: string | null;
        username: string | null;
        avatar_url: string | null;
    } | null;
    entries?: Record<string, string>; // machineCode or machineId -> finger_id
};
