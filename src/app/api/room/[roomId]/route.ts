import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const { roomId } = params;

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        players: true,
        gameResult: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const normalizedWallet = wallet?.toLowerCase();
    const currentPlayer = room.players.find((p) => p.wallet === normalizedWallet);

    // Build response - hide other players' roles
    const players = room.players.map((p) => ({
      id: p.id,
      wallet: p.wallet,
      nickname: p.nickname,
      isAlive: p.isAlive,
      isReady: p.isReady,
      isHost: p.isHost,
      // Only reveal roles in ended state
      role: room.status === "ended" ? p.role : undefined,
    }));

    return NextResponse.json({
      id: room.id,
      code: room.code,
      status: room.status,
      phase: room.phase,
      hostWallet: room.hostWallet,
      players,
      myRole: currentPlayer?.role,
      myId: currentPlayer?.id,
      winnerTeam: room.gameResult?.winnerTeam,
      gameId: room.gameResult?.gameId,
    });
  } catch (error) {
    console.error("Get room error:", error);
    return NextResponse.json({ error: "Failed to get room" }, { status: 500 });
  }
}
