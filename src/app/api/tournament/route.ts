import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET - List tournaments
export async function GET() {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { participants: true, matches: true },
        },
      },
    });

    return NextResponse.json({ tournaments });
  } catch (error) {
    console.error("List tournaments error:", error);
    return NextResponse.json({ error: "Failed to list tournaments" }, { status: 500 });
  }
}

// POST - Create tournament (admin only in production)
export async function POST(req: NextRequest) {
  try {
    const { name, maxPlayers, prizePool, startTime } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        maxPlayers: maxPlayers || 16,
        prizePool: prizePool || 0,
        startTime: startTime ? new Date(startTime) : null,
      },
    });

    return NextResponse.json({ tournament });
  } catch (error) {
    console.error("Create tournament error:", error);
    return NextResponse.json({ error: "Failed to create tournament" }, { status: 500 });
  }
}
