"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileText, Loader2, Download, AlertCircle, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Initialize PDF.js worker using unpkg, which is more reliable for exact version matches
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function ConvertClient() {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState("");
    const [extractedText, setExtractedText] = useState("");
    const [error, setError] = useState<string | null>(null);

    const processImage = async (imageSource: string | File) => {
        try {
            const worker = await createWorker('ind+eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        setProgress(Math.round(m.progress * 100));
                        setProgressText(`Mengekstrak teks... ${Math.round(m.progress * 100)}%`);
                    } else {
                        setProgressText(m.status);
                    }
                }
            });
            const { data: { text } } = await worker.recognize(imageSource);
            await worker.terminate();
            return text;
        } catch (err) {
            console.error(err);
            throw new Error("Gagal memproses OCR pada gambar.");
        }
    };

    const processPdf = async (pdfFile: File) => {
        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;

            if (numPages > 5) {
                throw new Error(`PDF terlalu besar. Maksimal 5 halaman (File ini memiliki ${numPages} halaman).`);
            }

            let fullText = "";

            for (let i = 1; i <= numPages; i++) {
                setProgressText(`Menyiapkan halaman ${i} dari ${numPages}...`);
                setProgress(0);
                const page = await pdf.getPage(i);

                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");

                if (!context) throw new Error("Could not create canvas context");

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                } as any).promise;

                const imageDataUrl = canvas.toDataURL("image/png");

                setProgressText(`Mengekstrak teks halaman ${i} dari ${numPages}...`);
                const worker = await createWorker('ind+eng', 1, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            setProgress(Math.round(m.progress * 100));
                            setProgressText(`Halaman ${i}/${numPages} - ${Math.round(m.progress * 100)}%`);
                        }
                    }
                });

                const { data: { text } } = await worker.recognize(imageDataUrl);
                await worker.terminate();

                fullText += text + "\n\n";
            }
            return fullText;

        } catch (err: any) {
            console.error(err);
            throw new Error(err.message || "Gagal memproses file PDF.");
        }
    };

    const handleFileUpload = async (uploadedFile: File) => {
        setFile(uploadedFile);
        setError(null);
        setExtractedText("");
        setIsProcessing(true);
        setProgress(0);
        setProgressText("Memulai pemrosesan...");

        try {
            let resultText = "";
            if (uploadedFile.type === "application/pdf") {
                resultText = await processPdf(uploadedFile);
            } else if (uploadedFile.type.startsWith("image/")) {
                resultText = await processImage(uploadedFile);
            } else {
                throw new Error("Tipe file tidak didukung. Harap unggah Gambar atau PDF.");
            }
            setExtractedText(resultText.trim());
        } catch (err: any) {
            setError(err.message || "Terjadi kesalahan saat memproses file.");
        } finally {
            setIsProcessing(false);
            setProgress(100);
            setProgressText("Selesai");
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (acceptedFiles) => {
            if (acceptedFiles.length > 0) {
                handleFileUpload(acceptedFiles[0]);
            }
        },
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png'],
            'application/pdf': ['.pdf']
        },
        maxFiles: 1,
        disabled: isProcessing,
        multiple: false
    });

    const handleDownloadWord = async () => {
        if (!extractedText) return;

        try {
            const paragraphs = extractedText.split("\n").map(line => {
                return new Paragraph({
                    children: [new TextRun(line)]
                });
            });

            const doc = new Document({
                sections: [{
                    properties: {},
                    children: paragraphs
                }]
            });

            const blob = await Packer.toBlob(doc);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Convert_OCR_${new Date().getTime()}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError("Gagal membuat dokumen Word.");
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Section */}
            <Card className="flex flex-col">
                <CardContent className="p-6 flex-1 flex flex-col">
                    <div
                        {...getRootProps()}
                        className={cn(
                            "flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-colors min-h-[300px]",
                            isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/50",
                            isProcessing ? "opacity-50 cursor-not-allowed" : ""
                        )}
                    >
                        <input {...getInputProps()} />
                        <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="font-semibold text-lg mb-1">Upload File (Teks Saja)</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Drag & drop file scan (Max 5 halaman)
                        </p>
                        <Button variant="secondary" disabled={isProcessing}>
                            Pilih File
                        </Button>
                    </div>

                    {file && (
                        <div className="mt-4 p-4 border rounded-lg flex items-center gap-4 bg-muted/30">
                            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                {file.type === "application/pdf" ? (
                                    <FileIcon className="w-5 h-5 text-primary" />
                                ) : (
                                    <ImageIcon className="w-5 h-5 text-primary" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        </div>
                    )}

                    {isProcessing && (
                        <div className="mt-6 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {progressText}
                                </span>
                                <span className="font-medium">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                            <p className="text-xs text-muted-foreground mt-2 italic text-center">
                                Tesseract sedang membaca dokumen Anda baris demi baris...
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-4 rounded-lg bg-destructive/10 text-destructive flex items-start gap-3 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Output Section */}
            <Card className="flex flex-col">
                <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Teks Ekstraksi
                        </h3>
                        <Button
                            onClick={handleDownloadWord}
                            disabled={!extractedText || isProcessing}
                            className="gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download Word (.docx)
                        </Button>
                    </div>

                    <Textarea
                        value={extractedText}
                        onChange={(e) => setExtractedText(e.target.value)}
                        placeholder="Teks hasil scan akan muncul di sini. Anda dapat memodifikasinya dengan bebas sebelum didownload."
                        className="flex-1 min-h-[300px] resize-none whitespace-pre-wrap p-4 text-sm font-mono"
                        disabled={isProcessing}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
