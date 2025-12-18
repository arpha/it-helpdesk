"use client";

import { useRef, forwardRef, useImperativeHandle } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eraser } from "lucide-react";

export interface SignaturePadRef {
    isEmpty: () => boolean;
    clear: () => void;
    toDataURL: () => string;
}

interface SignaturePadProps {
    label?: string;
    required?: boolean;
    className?: string;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
    ({ label = "Tanda Tangan", required = false, className }, ref) => {
        const sigCanvasRef = useRef<SignatureCanvas>(null);

        useImperativeHandle(ref, () => ({
            isEmpty: () => sigCanvasRef.current?.isEmpty() ?? true,
            clear: () => sigCanvasRef.current?.clear(),
            toDataURL: () => sigCanvasRef.current?.toDataURL("image/png") ?? "",
        }));

        const handleClear = () => {
            sigCanvasRef.current?.clear();
        };

        return (
            <div className={className}>
                <div className="flex items-center justify-between mb-2">
                    <Label>
                        {label} {required && <span className="text-destructive">*</span>}
                    </Label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="h-7 text-xs"
                    >
                        <Eraser className="h-3 w-3 mr-1" />
                        Clear
                    </Button>
                </div>
                <div className="border rounded-lg bg-white overflow-hidden">
                    <SignatureCanvas
                        ref={sigCanvasRef}
                        canvasProps={{
                            className: "w-full h-32 cursor-crosshair",
                            style: { width: "100%", height: "128px" },
                        }}
                        backgroundColor="white"
                        penColor="black"
                    />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Gambar tanda tangan di atas
                </p>
            </div>
        );
    }
);

SignaturePad.displayName = "SignaturePad";

export { SignaturePad };
