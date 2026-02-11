import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET - Tournament details
export async function GET(
  req: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: params.tournamentId },
      include: {
        participants: {
          orderBy: { seed: "asc" },
        },
        matches: {
          orderBy: [{ round: "desc" }, { matchNumber: "asc" }],
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    return NextResponse.json({ tournament });
  } catch (error) {
    console.error("Get tournament error:", error);
    return NextResponse.json({ error: "Failed to get tournament" }, { status: 500 });
  }
}
