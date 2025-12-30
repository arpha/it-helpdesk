import { Metadata } from "next";
import ReorderClient from "./_components/reorder-client";

export const metadata: Metadata = {
    title: "Reorder Recommendations | IT Governance",
};

export default function ReorderPage() {
    return <ReorderClient />;
}
