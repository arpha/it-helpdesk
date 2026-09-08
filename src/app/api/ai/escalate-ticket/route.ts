import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTicket } from "@/app/(dashboard)/tickets/actions";

export async function POST(request: NextRequest) {
  try {
    const { action, logId, userQuery, aiSummary, category = "Software", priority = "medium" } = await request.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Handle "Masalah Selesai" resolution status update
    if (action === "resolve") {
      if (logId) {
        await supabase
          .from("ai_deflection_logs")
          .update({ status: "deflected_resolved" })
          .eq("id", logId);
      }
      return NextResponse.json({ success: true, message: "Kendala berhasil ditandai selesai." });
    }

    // Handle Ticket Escalation
    if (!userQuery) {
      return NextResponse.json({ error: "User query is required" }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        requireAuth: true,
        error: "Silakan login terlebih dahulu ke sistem SI MANTAP untuk membuat tiket IT."
      }, { status: 401 });
    }

    // 1. Create ticket
    const title = userQuery.length > 80 ? userQuery.slice(0, 77) + "..." : userQuery;
    const description = `[Dibuat via AI Assistant Self-Service]\n\n**Kendala Pengguna:**\n${userQuery}\n\n**Upaya Troubleshooting AI:**\n${aiSummary || "Pengguna sudah mencoba solusi mandiri namun kendala belum teratasi."}`;

    const ticketResult = await createTicket({
      title,
      description,
      category,
      priority,
    });

    if (!ticketResult.success || !ticketResult.id) {
      if (ticketResult.error === "Not authenticated") {
        return NextResponse.json({
          success: false,
          requireAuth: true,
          error: "Silakan login terlebih dahulu untuk membuat tiket IT."
        }, { status: 401 });
      }
      throw new Error(ticketResult.error || "Gagal membuat tiket Helpdesk");
    }

    // 2. Update deflection log if logId provided
    if (logId) {
      await supabase
        .from("ai_deflection_logs")
        .update({
          status: "escalated_to_ticket",
          created_ticket_id: ticketResult.id,
        })
        .eq("id", logId);
    }

    return NextResponse.json({
      success: true,
      ticketId: ticketResult.id,
      message: "Tiket berhasil dibuat dan diserahkan ke tim IT",
    });
  } catch (error) {
    console.error("Ticket Escalation API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mengeskalasi tiket",
      },
      { status: 500 }
    );
  }
}
