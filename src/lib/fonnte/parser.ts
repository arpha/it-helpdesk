/**
 * ATK Request Message Parser
 * Parses incoming WhatsApp messages for ATK requests
 */

export type ParsedItem = {
    name: string;
    quantity: number;
    unit: string;
};

export type ParsedATKRequest = {
    items: ParsedItem[];
    purpose: string;
    isValid: boolean;
    error?: string;
};

/**
 * Parse ATK request message
 * 
 * Expected format:
 * /atk
 * 1. Item Name - Quantity Unit
 * 2. Item Name - Quantity Unit
 * Keperluan: Purpose text
 * 
 * Example:
 * /atk
 * 1. Kertas HVS A4 - 5 rim
 * 2. Pulpen Pilot - 10 pcs
 * Keperluan: Print laporan bulanan
 */
export function parseATKRequest(message: string): ParsedATKRequest {
    const lines = message.trim().split("\n").map(line => line.trim());

    // Check if message starts with /atk command
    const firstLine = lines[0]?.toLowerCase();
    if (!firstLine?.startsWith("/atk") && !firstLine?.startsWith("atk")) {
        return {
            items: [],
            purpose: "",
            isValid: false,
            error: "Message harus dimulai dengan /atk",
        };
    }

    const items: ParsedItem[] = [];
    let purpose = "";

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        // Check for purpose line
        if (line.toLowerCase().startsWith("keperluan:") || line.toLowerCase().startsWith("purpose:")) {
            purpose = line.split(":").slice(1).join(":").trim();
            continue;
        }

        // Parse item line: "1. Item Name - Quantity Unit"
        const itemMatch = line.match(/^\d+\.\s*(.+?)\s*[-–]\s*(\d+)\s*(.+)$/);
        if (itemMatch) {
            items.push({
                name: itemMatch[1].trim(),
                quantity: parseInt(itemMatch[2]),
                unit: itemMatch[3].trim(),
            });
            continue;
        }

        // Alternative format: "Item Name - Quantity Unit" (without number)
        const altMatch = line.match(/^(.+?)\s*[-–]\s*(\d+)\s*(.+)$/);
        if (altMatch && !line.toLowerCase().includes("keperluan")) {
            items.push({
                name: altMatch[1].trim(),
                quantity: parseInt(altMatch[2]),
                unit: altMatch[3].trim(),
            });
        }
    }

    if (items.length === 0) {
        return {
            items: [],
            purpose,
            isValid: false,
            error: "Tidak ada item ATK yang valid. Format: Nama Item - Jumlah Satuan",
        };
    }

    return {
        items,
        purpose,
        isValid: true,
    };
}

/**
 * Match parsed items with ATK catalog items
 */
export function matchWithCatalog(
    parsedItems: ParsedItem[],
    catalogItems: Array<{ id: string; name: string; unit: string }>
): Array<{ itemId: string | null; parsedItem: ParsedItem; match: string | null }> {
    return parsedItems.map(parsed => {
        const searchName = parsed.name.toLowerCase();

        // Find best match - exact or contains
        const exactMatch = catalogItems.find(
            item => item.name.toLowerCase() === searchName
        );

        if (exactMatch) {
            return {
                itemId: exactMatch.id,
                parsedItem: parsed,
                match: exactMatch.name,
            };
        }

        // Partial match
        const partialMatch = catalogItems.find(
            item => item.name.toLowerCase().includes(searchName) ||
                searchName.includes(item.name.toLowerCase())
        );

        if (partialMatch) {
            return {
                itemId: partialMatch.id,
                parsedItem: parsed,
                match: partialMatch.name,
            };
        }

        return {
            itemId: null,
            parsedItem: parsed,
            match: null,
        };
    });
}

/**
 * Generate help message
 */
export function getHelpMessage(): string {
    return `📋 *Cara Request ATK via WhatsApp*

Format:
\`\`\`
/atk
1. Nama Barang - Jumlah Satuan
2. Nama Barang - Jumlah Satuan
Keperluan: Alasan permintaan
\`\`\`

Contoh:
\`\`\`
/atk
1. Kertas HVS A4 - 5 rim
2. Pulpen Pilot - 10 pcs
Keperluan: Print laporan bulanan
\`\`\`

Ketik /daftar untuk melihat daftar barang ATK.
Ketik /status untuk cek status request.`;
}
