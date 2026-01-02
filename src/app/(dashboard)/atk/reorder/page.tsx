import { Metadata } from "next";
import ReorderClient from "./_components/reorder-client";

export const metadata: Metadata = {
    title: "Reorder Recommendations | SI-Mantap",
};

export default function ReorderPage() {
    return <ReorderClient />;
}
