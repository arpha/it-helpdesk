"use client";

import { useRef, forwardRef, useImperativeHandle, useEffect, useState } from "react";
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
        const containerRef = useRef<HTMLDivElement>(null);
        const [canvasSize, setCanvasSize] = useState({ width: 400, height: 250 });

        useEffect(() => {
            const updateSize = () => {
                if (containerRef.current) {
                    const width = containerRef.current.offsetWidth;
                    setCanvasSize({ width, height: 250 });
                }
            };

            updateSize();
            window.addEventListener("resize", updateSize);
            return () => window.removeEventListener("resize", updateSize);
        }, []);

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
                <div ref={containerRef} className="border rounded-lg bg-white overflow-hidden">
                    <SignatureCanvas
                        ref={sigCanvasRef}
                        canvasProps={{
                            width: canvasSize.width,
                            height: canvasSize.height,
                            className: "cursor-crosshair",
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

