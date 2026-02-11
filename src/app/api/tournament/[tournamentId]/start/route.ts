import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST - Start tournament (generate brackets)
export async function POST(
  req: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  try {
    const { tournamentId } = params;

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: { orderBy: { seed: "asc" } } },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (tournament.status !== "registration") {
      return NextResponse.json({ error: "Tournament already started" }, { status: 400 });
    }

    const playerCount = tournament.participants.length;
    if (playerCount < 4) {
      return NextResponse.json({ error: "Need at least 4 players" }, { status: 400 });
    }

    // Calculate rounds needed (power of 2)
    const rounds = Math.ceil(Math.log2(playerCount));
    const bracketSize = Math.pow(2, rounds);

    // Shuffle participants for random seeding
    const shuffled = [...tournament.participants].sort(() => Math.random() - 0.5);

    // Generate first round matches
    const matches = [];
    const matchCount = bracketSize / 2;

    for (let i = 0; i < matchCount; i++) {
      const player1 = shuffled[i * 2] || null;
      const player2 = shuffled[i * 2 + 1] || null;

      // If only one player (bye), they auto-advance
      const isBye = !player1 || !player2;
      const winner = isBye ? (player1?.wallet || player2?.wallet) : null;

      matches.push({
        tournamentId,
        round: rounds,
        matchNumber: i + 1,
        player1Wallet: player1?.wallet || null,
        player2Wallet: player2?.wallet || null,
        winnerWallet: winner,
        status: isBye ? "completed" : "pending",
      });
    }

    // Create empty matches for subsequent rounds
    for (let round = rounds - 1; round >= 1; round--) {
      const roundMatches = Math.pow(2, round - 1);
      for (let i = 0; i < roundMatches; i++) {
        matches.push({
          tournamentId,
          round,
          matchNumber: i + 1,
          player1Wallet: null,
          player2Wallet: null,
          winnerWallet: null,
          status: "pending",
        });
      }
    }

    // Create all matches
    await prisma.tournamentMatch.createMany({
      data: matches,
    });

    // Update tournament status
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        status: "active",
        startTime: new Date(),
      },
    });

    return NextResponse.json({ success: true, rounds, matchCount: matches.length });
  } catch (error) {
    console.error("Start tournament error:", error);
    return NextResponse.json({ error: "Failed to start tournament" }, { status: 500 });
  }
}
