"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText } from "lucide-react";
import type { SOPDocument } from "@/types/sop";

interface SOPViewerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    document: SOPDocument | null;
}

export function SOPViewerDialog({ open, onOpenChange, document }: SOPViewerDialogProps) {
    if (!document) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col p-4">
                <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
                    <div className="space-y-1 min-w-0 pr-4">
                        <DialogTitle className="text-lg font-semibold truncate flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary shrink-0" />
                            <span className="truncate">{document.title}</span>
                        </DialogTitle>
                        {document.document_number && (
                            <p className="text-xs text-muted-foreground font-mono">
                                No: {document.document_number}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                        >
                            <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Tab Baru
                            </a>
                        </Button>
                        <Button
                            size="sm"
                            asChild
                        >
                            <a href={document.file_url} download={document.file_name}>
                                <Download className="h-4 w-4 mr-1" />
                                Unduh PDF
                            </a>
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 w-full h-full min-h-0 bg-muted/30 rounded-lg overflow-hidden mt-2">
                    <iframe
                        src={`${document.file_url}#toolbar=1`}
                        className="w-full h-full border-0"
                        title={document.title}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
