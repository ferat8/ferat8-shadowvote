import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { wallet, targetId } = await req.json();
    const { roomId } = params;

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();

    // Get room and player
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || (room.status !== "voting" && room.status !== "day")) {
      return NextResponse.json({ error: "Not in voting phase" }, { status: 400 });
    }

    const player = await prisma.player.findFirst({
      where: { roomId, wallet: normalizedWallet },
    });

    if (!player || !player.isAlive) {
      return NextResponse.json({ error: "Player not found or dead" }, { status: 400 });
    }

    // Validate target if not skip
    if (targetId) {
      const target = await prisma.player.findFirst({
        where: { id: targetId, roomId, isAlive: true },
      });

      if (!target) {
        return NextResponse.json({ error: "Invalid target" }, { status: 400 });
      }

      if (target.id === player.id) {
        return NextResponse.json({ error: "Cannot vote yourself" }, { status: 400 });
      }
    }

    // Create or update vote
    await prisma.vote.upsert({
      where: {
        roomId_playerId_phase: {
          roomId,
          playerId: player.id,
          phase: room.phase,
        },
      },
      create: {
        roomId,
        playerId: player.id,
        phase: room.phase,
        targetId,
      },
      update: {
        targetId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json({ error: "Failed to submit vote" }, { status: 500 });
  }
}
