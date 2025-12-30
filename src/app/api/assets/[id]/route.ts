import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RouteParams = {
    params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("assets")
            .select(`
                *,
                asset_categories(name),
                locations(name),
                profiles:assigned_to(id, full_name, username)
            `)
            .eq("id", id)
            .single();

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data
        });
    } catch (error) {
        console.error("Get asset error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get asset" },
            { status: 500 }
        );
    }
}
