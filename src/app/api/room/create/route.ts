import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRoomCode } from "@/lib/game/engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { wallet, nickname } = await req.json();

    if (!wallet || !nickname) {
      return NextResponse.json({ error: "Missing wallet or nickname" }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();

    // Generate unique room code
    let code = generateRoomCode();
    let attempts = 0;
    while (await prisma.room.findUnique({ where: { code } })) {
      code = generateRoomCode();
      attempts++;
      if (attempts > 10) {
        return NextResponse.json({ error: "Failed to generate room code" }, { status: 500 });
      }
    }

    // Create room with host
    const room = await prisma.room.create({
      data: {
        code,
        hostWallet: normalizedWallet,
        players: {
          create: {
            wallet: normalizedWallet,
            nickname,
            isHost: true,
            isReady: true,
          },
        },
      },
      include: { players: true },
    });

    return NextResponse.json({
      roomId: room.id,
      code: room.code,
      playerId: room.players[0].id,
    });
  } catch (error) {
    console.error("Create room error:", error);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
