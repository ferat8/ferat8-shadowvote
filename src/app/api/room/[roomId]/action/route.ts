import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { wallet, actionType, targetId } = await req.json();
    const { roomId } = params;

    if (!wallet || !actionType) {
      return NextResponse.json({ error: "Missing wallet or actionType" }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();

    // Get room and player
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || room.status !== "night") {
      return NextResponse.json({ error: "Not in night phase" }, { status: 400 });
    }

    const player = await prisma.player.findFirst({
      where: { roomId, wallet: normalizedWallet },
    });

    if (!player || !player.isAlive) {
      return NextResponse.json({ error: "Player not found or dead" }, { status: 400 });
    }

    // Validate action based on role
    if (actionType === "kill" && player.role !== "impostor") {
      return NextResponse.json({ error: "Only impostors can kill" }, { status: 403 });
    }

    if (actionType === "investigate" && player.role !== "detective") {
      return NextResponse.json({ error: "Only detective can investigate" }, { status: 403 });
    }

    // Validate target
    if (targetId) {
      const target = await prisma.player.findFirst({
        where: { id: targetId, roomId, isAlive: true },
      });

      if (!target) {
        return NextResponse.json({ error: "Invalid target" }, { status: 400 });
      }

      if (target.id === player.id) {
        return NextResponse.json({ error: "Cannot target yourself" }, { status: 400 });
      }
    }

    // Create or update action
    await prisma.action.upsert({
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
        actionType,
        targetId,
      },
      update: {
        targetId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Action error:", error);
    return NextResponse.json({ error: "Failed to submit action" }, { status: 500 });
  }
}
