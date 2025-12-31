"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useATKItems, ATKItem } from "@/hooks/api/use-atk-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Check, PackagePlus } from "lucide-react";
import { stockIn } from "../../stock/actions";

export default function StockInClient() {
    const queryClient = useQueryClient();
    const { data: itemsData, isLoading: itemsLoading } = useATKItems({ page: 1, limit: 100 });

    const [selectedItem, setSelectedItem] = useState<string>("");
    const [quantity, setQuantity] = useState("");
    const [notes, setNotes] = useState("");
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSubmit = () => {
        setMessage(null);

        if (!selectedItem || !quantity) {
            setMessage({ type: "error", text: "Please select item and enter quantity" });
            return;
        }

        startTransition(async () => {
            const result = await stockIn({
                item_id: selectedItem,
                quantity: parseInt(quantity),
                notes: notes || undefined,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Stock added successfully!" });
                queryClient.invalidateQueries({ queryKey: ["atk-items"] });
                setSelectedItem("");
                setQuantity("");
                setNotes("");
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const selectedItemData = itemsData?.data.find((i) => i.id === selectedItem);

    return (
        <Card className="max-w-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <PackagePlus className="h-5 w-5" />
                    Stock In
                </CardTitle>
                <CardDescription>Add incoming stock to inventory</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {message && (
                    <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-2">
                    <Label>Select Item *</Label>
                    <Select value={selectedItem} onValueChange={setSelectedItem} disabled={itemsLoading}>
                        <SelectTrigger>
                            <SelectValue placeholder={itemsLoading ? "Loading..." : "Select an item"} />
                        </SelectTrigger>
                        <SelectContent>
                            {itemsData?.data.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                    {item.name} - Stock: {item.stock_quantity}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {selectedItemData && (
                    <div className="rounded-md bg-muted p-3 text-sm">
                        <p><strong>Current Stock:</strong> {selectedItemData.stock_quantity} {selectedItemData.unit}</p>
                        <p><strong>Min Stock:</strong> {selectedItemData.min_stock}</p>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Enter quantity"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g., Purchased from supplier X"
                        rows={2}
                    />
                </div>

                <Button onClick={handleSubmit} disabled={isPending} className="w-full">
                    {isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
                    ) : (
                        <><Check className="mr-2 h-4 w-4" />Add Stock</>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
