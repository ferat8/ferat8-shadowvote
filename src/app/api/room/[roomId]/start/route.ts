import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startGame } from "@/lib/game/engine";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { wallet } = await req.json();
    const { roomId } = params;

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();

    // Verify host
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { players: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.hostWallet !== normalizedWallet) {
      return NextResponse.json({ error: "Only host can start" }, { status: 403 });
    }

    if (room.players.length < 6) {
      return NextResponse.json({ error: "Need at least 6 players" }, { status: 400 });
    }

    // Check all players ready
    const notReady = room.players.filter((p) => !p.isReady);
    if (notReady.length > 0) {
      return NextResponse.json({ error: "Not all players ready" }, { status: 400 });
    }

    await startGame(roomId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Start game error:", error);
    return NextResponse.json({ error: "Failed to start game" }, { status: 500 });
  }
}
