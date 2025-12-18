"use client";

import { Button } from "@/components/ui/button";
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react";

type TablePaginationProps = {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    itemsPerPage?: number;
};

export function TablePagination({
    page,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage,
}: TablePaginationProps) {
    const canGoPrevious = page > 1;
    const canGoNext = page < totalPages;

    const startItem = totalItems ? (page - 1) * (itemsPerPage || 10) + 1 : 0;
    const endItem = totalItems
        ? Math.min(page * (itemsPerPage || 10), totalItems)
        : 0;

    return (
        <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
                {totalItems ? (
                    <>
                        Showing {startItem} to {endItem} of {totalItems} entries
                    </>
                ) : (
                    <>Page {page} of {totalPages}</>
                )}
            </div>

            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onPageChange(1)}
                    disabled={!canGoPrevious}
                    className="h-8 w-8"
                >
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onPageChange(page - 1)}
                    disabled={!canGoPrevious}
                    className="h-8 w-8"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1 px-2">
                    <span className="text-sm font-medium">{page}</span>
                    <span className="text-sm text-muted-foreground">/</span>
                    <span className="text-sm text-muted-foreground">{totalPages}</span>
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onPageChange(page + 1)}
                    disabled={!canGoNext}
                    className="h-8 w-8"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onPageChange(totalPages)}
                    disabled={!canGoNext}
                    className="h-8 w-8"
                >
                    <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
