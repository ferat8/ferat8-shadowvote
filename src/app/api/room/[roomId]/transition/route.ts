import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processNight, processVoting } from "@/lib/game/engine";

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
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.hostWallet !== normalizedWallet) {
      return NextResponse.json({ error: "Only host can transition" }, { status: 403 });
    }

    let result;

    switch (room.status) {
      case "night":
        result = await processNight(roomId);
        break;
      case "day":
        // Transition to voting
        await prisma.room.update({
          where: { id: roomId },
          data: { status: "voting" },
        });
        result = { status: "voting" };
        break;
      case "voting":
        result = await processVoting(roomId);
        break;
      default:
        return NextResponse.json({ error: "Invalid state for transition" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Transition error:", error);
    return NextResponse.json({ error: "Failed to transition" }, { status: 500 });
  }
}
