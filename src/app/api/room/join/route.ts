import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code, wallet, nickname } = await req.json();

    if (!code || !wallet || !nickname) {
      return NextResponse.json({ error: "Missing code, wallet, or nickname" }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();
    const normalizedCode = code.toUpperCase();

    // Find room
    const room = await prisma.room.findUnique({
      where: { code: normalizedCode },
      include: { players: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status !== "lobby") {
      return NextResponse.json({ error: "Game already started" }, { status: 400 });
    }

    if (room.players.length >= 10) {
      return NextResponse.json({ error: "Room is full" }, { status: 400 });
    }

    // Check if already in room
    const existingPlayer = room.players.find((p) => p.wallet === normalizedWallet);
    if (existingPlayer) {
      return NextResponse.json({
        roomId: room.id,
        code: room.code,
        playerId: existingPlayer.id,
      });
    }

    // Add player
    const player = await prisma.player.create({
      data: {
        roomId: room.id,
        wallet: normalizedWallet,
        nickname,
      },
    });

    return NextResponse.json({
      roomId: room.id,
      code: room.code,
      playerId: player.id,
    });
  } catch (error) {
    console.error("Join room error:", error);
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }
}
