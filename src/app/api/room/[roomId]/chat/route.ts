import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const RATE_LIMIT_MS = 1000; // 1 message per second
const rateLimitMap = new Map<string, number>();

export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const { roomId } = params;
  const phase = req.nextUrl.searchParams.get("phase");

  try {
    const messages = await prisma.message.findMany({
      where: {
        roomId,
        ...(phase ? { phase: parseInt(phase) } : {}),
      },
      include: { player: { select: { nickname: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        playerId: m.playerId,
        nickname: m.player.nickname,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get chat error:", error);
    return NextResponse.json({ error: "Failed to get chat" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { wallet, content } = await req.json();
    const { roomId } = params;

    if (!wallet || !content) {
      return NextResponse.json({ error: "Missing wallet or content" }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();

    // Rate limiting
    const lastMessage = rateLimitMap.get(normalizedWallet) || 0;
    if (Date.now() - lastMessage < RATE_LIMIT_MS) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    rateLimitMap.set(normalizedWallet, Date.now());

    // Get room and player
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || room.status !== "day") {
      return NextResponse.json({ error: "Chat only available during day" }, { status: 400 });
    }

    const player = await prisma.player.findFirst({
      where: { roomId, wallet: normalizedWallet },
    });

    if (!player || !player.isAlive) {
      return NextResponse.json({ error: "Player not found or dead" }, { status: 400 });
    }

    // Sanitize and limit content
    const sanitizedContent = content.slice(0, 200).trim();
    if (!sanitizedContent) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        roomId,
        playerId: player.id,
        phase: room.phase,
        content: sanitizedContent,
      },
    });

    return NextResponse.json({
      id: message.id,
      playerId: player.id,
      nickname: player.nickname,
      content: sanitizedContent,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
