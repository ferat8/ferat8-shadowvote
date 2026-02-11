import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST - Join tournament
export async function POST(
  req: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  try {
    const { wallet, nickname } = await req.json();
    const { tournamentId } = params;

    if (!wallet || !nickname) {
      return NextResponse.json({ error: "Wallet and nickname required" }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();

    // Check tournament exists and is in registration
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { _count: { select: { participants: true } } },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (tournament.status !== "registration") {
      return NextResponse.json({ error: "Tournament not accepting registrations" }, { status: 400 });
    }

    if (tournament._count.participants >= tournament.maxPlayers) {
      return NextResponse.json({ error: "Tournament is full" }, { status: 400 });
    }

    // Check if already registered
    const existing = await prisma.tournamentPlayer.findUnique({
      where: {
        tournamentId_wallet: {
          tournamentId,
          wallet: normalizedWallet,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Already registered" }, { status: 400 });
    }

    // Register player
    const participant = await prisma.tournamentPlayer.create({
      data: {
        tournamentId,
        wallet: normalizedWallet,
        nickname,
        seed: tournament._count.participants + 1,
      },
    });

    return NextResponse.json({ participant });
  } catch (error) {
    console.error("Join tournament error:", error);
    return NextResponse.json({ error: "Failed to join tournament" }, { status: 500 });
  }
}
