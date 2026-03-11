import { Metadata } from "next";
import ConvertClient from "./_components/convert-client";

export const metadata: Metadata = {
    title: "Convert OCR",
    description: "Convert images and PDF to Word document using OCR",
};

export default function ConvertPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Convert OCR</h2>
                    <p className="text-muted-foreground">
                        Convert text from images or PDFs into editable Word documents.
                    </p>
                </div>
            </div>
            <ConvertClient />
        </div>
    );
}
