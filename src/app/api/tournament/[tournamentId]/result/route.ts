import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST - Report match result
export async function POST(
  req: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  try {
    const { matchId, winnerWallet } = await req.json();
    const { tournamentId } = params;

    if (!matchId || !winnerWallet) {
      return NextResponse.json({ error: "Match ID and winner required" }, { status: 400 });
    }

    const match = await prisma.tournamentMatch.findUnique({
      where: { id: matchId },
    });

    if (!match || match.tournamentId !== tournamentId) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.status === "completed") {
      return NextResponse.json({ error: "Match already completed" }, { status: 400 });
    }

    const normalizedWinner = winnerWallet.toLowerCase();
    if (normalizedWinner !== match.player1Wallet && normalizedWinner !== match.player2Wallet) {
      return NextResponse.json({ error: "Winner not in match" }, { status: 400 });
    }

    // Update match
    await prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        winnerWallet: normalizedWinner,
        status: "completed",
        completedAt: new Date(),
      },
    });

    // Update loser as eliminated
    const loserWallet = normalizedWinner === match.player1Wallet 
      ? match.player2Wallet 
      : match.player1Wallet;

    if (loserWallet) {
      await prisma.tournamentPlayer.update({
        where: {
          tournamentId_wallet: {
            tournamentId,
            wallet: loserWallet,
          },
        },
        data: {
          eliminated: true,
          losses: { increment: 1 },
        },
      });
    }

    // Update winner stats
    await prisma.tournamentPlayer.update({
      where: {
        tournamentId_wallet: {
          tournamentId,
          wallet: normalizedWinner,
        },
      },
      data: {
        wins: { increment: 1 },
      },
    });

    // Advance winner to next round
    if (match.round > 1) {
      const nextRound = match.round - 1;
      const nextMatchNumber = Math.ceil(match.matchNumber / 2);
      const isPlayer1 = match.matchNumber % 2 === 1;

      await prisma.tournamentMatch.updateMany({
        where: {
          tournamentId,
          round: nextRound,
          matchNumber: nextMatchNumber,
        },
        data: isPlayer1 
          ? { player1Wallet: normalizedWinner }
          : { player2Wallet: normalizedWinner },
      });
    } else {
      // Finals completed - end tournament
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          status: "completed",
          endTime: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Report result error:", error);
    return NextResponse.json({ error: "Failed to report result" }, { status: 500 });
  }
}
