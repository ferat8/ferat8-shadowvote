import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { wallet, ready } = await req.json();
    const { roomId } = params;

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();

    const player = await prisma.player.findFirst({
      where: { roomId, wallet: normalizedWallet },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    await prisma.player.update({
      where: { id: player.id },
      data: { isReady: ready !== false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ready error:", error);
    return NextResponse.json({ error: "Failed to update ready state" }, { status: 500 });
  }
}
