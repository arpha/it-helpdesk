"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type TableLimitProps = {
    value: number;
    onChange: (value: number) => void;
    options?: number[];
};

export function TableLimit({
    value,
    onChange,
    options = [10, 25, 50, 100],
}: TableLimitProps) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select
                value={String(value)}
                onValueChange={(val) => onChange(Number(val))}
            >
                <SelectTrigger className="w-20">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                            {option}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">entries</span>
        </div>
    );
}
