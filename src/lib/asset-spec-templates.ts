"use client";

// Asset specification templates per category
export type SpecField = {
    key: string;
    label: string;
    type: "text" | "select";
    options?: string[];
    placeholder?: string;
};

export type CategorySpecs = {
    [categoryName: string]: SpecField[];
};

export const ASSET_SPEC_TEMPLATES: CategorySpecs = {
    "CPU": [
        { key: "processor", label: "Processor", type: "text", placeholder: "Intel Core i5-10400" },
        { key: "ram", label: "RAM", type: "text", placeholder: "16GB DDR4" },
        { key: "storage", label: "Storage", type: "text", placeholder: "512GB SSD" },
        { key: "vga", label: "VGA", type: "text", placeholder: "Intel UHD / NVIDIA GTX 1650" },
        { key: "os", label: "OS", type: "text", placeholder: "Windows 11 Pro" },
    ],
    "Komputer": [
        { key: "processor", label: "Processor", type: "text", placeholder: "Intel Core i5-1235U" },
        { key: "ram", label: "RAM", type: "text", placeholder: "16GB DDR4" },
        { key: "storage", label: "Storage", type: "text", placeholder: "512GB SSD" },
        { key: "vga", label: "VGA", type: "text", placeholder: "Intel Iris Xe" },
        { key: "os", label: "OS", type: "text", placeholder: "Windows 11 Pro" },
    ],
    "Laptop": [
        { key: "processor", label: "Processor", type: "text", placeholder: "Intel Core i5-1235U" },
        { key: "ram", label: "RAM", type: "text", placeholder: "16GB DDR4" },
        { key: "storage", label: "Storage", type: "text", placeholder: "512GB SSD" },
        { key: "vga", label: "VGA", type: "text", placeholder: "Intel Iris Xe" },
        { key: "layar", label: "Layar", type: "text", placeholder: "14 inch FHD" },
        { key: "os", label: "OS", type: "text", placeholder: "Windows 11 Pro" },
    ],
    "Monitor": [
        { key: "ukuran", label: "Ukuran", type: "text", placeholder: "24 inch" },
        { key: "resolusi", label: "Resolusi", type: "text", placeholder: "1920x1080 Full HD" },
        { key: "panel", label: "Panel", type: "select", options: ["IPS", "VA", "TN", "OLED"] },
        { key: "refresh_rate", label: "Refresh Rate", type: "text", placeholder: "60Hz" },
    ],
    "Server": [
        { key: "processor", label: "Processor", type: "text", placeholder: "Intel Xeon E-2234" },
        { key: "ram", label: "RAM", type: "text", placeholder: "32GB ECC DDR4" },
        { key: "storage", label: "Storage", type: "text", placeholder: "2x 1TB SAS RAID1" },
        { key: "form_factor", label: "Form Factor", type: "select", options: ["Rack 1U", "Rack 2U", "Tower"] },
        { key: "os", label: "OS", type: "text", placeholder: "Windows Server 2022" },
    ],
    "UPS": [
        { key: "kapasitas", label: "Kapasitas", type: "text", placeholder: "1500VA / 900W" },
        { key: "tipe", label: "Tipe", type: "select", options: ["Standby", "Line Interactive", "Online"] },
        { key: "outlet", label: "Jumlah Outlet", type: "text", placeholder: "6" },
    ],
    "Printer": [
        { key: "tipe", label: "Tipe", type: "select", options: ["Laser", "Tank", "Suntik"] },
        { key: "ppm", label: "PPM", type: "text", placeholder: "30" },
        { key: "duplex", label: "Duplex", type: "select", options: ["Ya", "Tidak"] },
    ],
    "Scanner": [
        { key: "resolusi", label: "Resolusi", type: "text", placeholder: "1200 DPI" },
        { key: "tipe", label: "Tipe", type: "select", options: ["Flatbed", "ADF", "Flatbed + ADF"] },
    ],
    "Harddisk Eksternal": [
        { key: "kapasitas", label: "Kapasitas", type: "text", placeholder: "1TB" },
        { key: "interface", label: "Interface", type: "select", options: ["USB 3.0", "USB Type-C", "USB 2.0"] },
    ],
    "Webcam": [
        { key: "resolusi", label: "Resolusi", type: "text", placeholder: "1080p Full HD" },
        { key: "microphone", label: "Microphone", type: "select", options: ["Ya", "Tidak"] },
    ],
    "Fingerprint": [
        { key: "tipe", label: "Tipe", type: "text", placeholder: "Optical / Capacitive" },
        { key: "interface", label: "Interface", type: "select", options: ["USB", "Ethernet", "WiFi"] },
    ],
    "Wacom": [
        { key: "ukuran", label: "Ukuran", type: "text", placeholder: "Small / Medium / Large" },
        { key: "model", label: "Model", type: "text", placeholder: "Intuos Pro" },
    ],
    "Proyektor": [
        { key: "resolusi", label: "Resolusi", type: "text", placeholder: "1920x1080 Full HD" },
        { key: "lumens", label: "Lumens", type: "text", placeholder: "3000" },
        { key: "tipe", label: "Tipe", type: "select", options: ["LCD", "DLP", "LED"] },
    ],
    "Peripheral Lainnya": [
        { key: "deskripsi", label: "Deskripsi", type: "text", placeholder: "Deskripsi perangkat" },
    ],
};

export function getSpecTemplate(categoryName: string): SpecField[] {
    return ASSET_SPEC_TEMPLATES[categoryName] || [];
}
