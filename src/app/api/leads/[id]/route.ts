import { NextRequest, NextResponse } from "next/server";
import { getLeadById, archiveLead, updateLeadNotes } from "@/lib/db/leads";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lead = await getLeadById(params.id);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json(lead);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    if (body.archive) {
      await archiveLead(params.id);
    }
    if (body.notes !== undefined) {
      await updateLeadNotes(params.id, body.notes);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}
