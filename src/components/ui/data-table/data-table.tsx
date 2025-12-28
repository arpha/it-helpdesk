"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSearch } from "./table-search";
import { TableLimit } from "./table-limit";
import { TablePagination } from "./table-pagination";
import { ReactNode } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type Column<T> = {
    key: string;
    header: string;
    cell: (row: T) => ReactNode;
    className?: string;
    sortable?: boolean;
};

export type SortDirection = "asc" | "desc" | null;

type DataTableProps<T> = {
    columns: Column<T>[];
    data: T[];
    isLoading?: boolean;
    // Search
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
    // Pagination
    page?: number;
    totalPages?: number;
    totalItems?: number;
    onPageChange?: (page: number) => void;
    // Limit
    limit?: number;
    onLimitChange?: (limit: number) => void;
    limitOptions?: number[];
    // Empty state
    emptyMessage?: string;
    // Toolbar action
    toolbarAction?: ReactNode;
    hideSearch?: boolean;
    // Sorting
    sortColumn?: string | null;
    sortDirection?: SortDirection;
    onSortChange?: (column: string, direction: SortDirection) => void;
};

export function DataTable<T>({
    columns,
    data,
    isLoading = false,
    searchValue,
    onSearchChange,
    searchPlaceholder = "Search...",
    page = 1,
    totalPages = 1,
    totalItems,
    onPageChange,
    limit = 10,
    onLimitChange,
    limitOptions,
    emptyMessage = "No data found.",
    toolbarAction,
    hideSearch = false,
    sortColumn,
    sortDirection,
    onSortChange,
}: DataTableProps<T>) {
    const showSearch = onSearchChange !== undefined && !hideSearch;
    const showLimit = onLimitChange !== undefined;
    const showPagination = onPageChange !== undefined && totalPages > 0;

    const handleSort = (columnKey: string) => {
        if (!onSortChange) return;

        let newDirection: SortDirection = "asc";
        if (sortColumn === columnKey) {
            if (sortDirection === "asc") {
                newDirection = "desc";
            } else if (sortDirection === "desc") {
                newDirection = null;
            }
        }
        onSortChange(columnKey, newDirection);
    };

    const getSortIcon = (columnKey: string, sortable?: boolean) => {
        if (!sortable || !onSortChange) return null;

        if (sortColumn === columnKey) {
            if (sortDirection === "asc") {
                return <ArrowUp className="ml-1 h-4 w-4 inline" />;
            } else if (sortDirection === "desc") {
                return <ArrowDown className="ml-1 h-4 w-4 inline" />;
            }
        }
        return <ArrowUpDown className="ml-1 h-4 w-4 inline opacity-50" />;
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            {(showSearch || showLimit || toolbarAction) && (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 items-center gap-2">
                        {showSearch && (
                            <TableSearch
                                value={searchValue || ""}
                                onChange={onSearchChange}
                                placeholder={searchPlaceholder}
                            />
                        )}
                        {toolbarAction}
                    </div>
                    {showLimit && (
                        <TableLimit
                            value={limit}
                            onChange={onLimitChange}
                            options={limitOptions}
                        />
                    )}
                </div>
            )}

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((column) => (
                                <TableHead
                                    key={column.key}
                                    className={`${column.className || ""} ${column.sortable && onSortChange ? "cursor-pointer select-none hover:bg-muted/50" : ""}`}
                                    onClick={() => column.sortable && handleSort(column.key)}
                                >
                                    {column.header}
                                    {getSortIcon(column.key, column.sortable)}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            // Loading skeleton
                            Array.from({ length: limit }).map((_, index) => (
                                <TableRow key={index}>
                                    {columns.map((column) => (
                                        <TableCell key={column.key}>
                                            <Skeleton className="h-5 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : data.length === 0 ? (
                            // Empty state
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            // Data rows
                            data.map((row, index) => (
                                <TableRow key={index}>
                                    {columns.map((column) => (
                                        <TableCell key={column.key} className={column.className}>
                                            {column.cell(row)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {showPagination && (
                <TablePagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                    totalItems={totalItems}
                    itemsPerPage={limit}
                />
            )}
        </div>
    );
}
