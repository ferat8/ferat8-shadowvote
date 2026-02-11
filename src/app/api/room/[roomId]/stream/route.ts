import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Simple in-memory store for room states (production would use Redis)
const roomStates = new Map<string, { status: string; phase: number; updatedAt: number }>();
const roomMessages = new Map<string, number>();

export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const { roomId } = params;
  const wallet = req.nextUrl.searchParams.get("wallet");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: unknown) => {
        const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial state
      try {
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          include: {
            players: true,
            gameResult: true,
          },
        });

        if (!room) {
          sendEvent("error", { message: "Room not found" });
          controller.close();
          return;
        }

        const normalizedWallet = wallet?.toLowerCase();
        const currentPlayer = room.players.find((p) => p.wallet === normalizedWallet);

        sendEvent("room_update", {
          id: room.id,
          code: room.code,
          status: room.status,
          phase: room.phase,
          hostWallet: room.hostWallet,
          players: room.players.map((p) => ({
            id: p.id,
            wallet: p.wallet,
            nickname: p.nickname,
            isAlive: p.isAlive,
            isReady: p.isReady,
            isHost: p.isHost,
            role: room.status === "ended" ? p.role : undefined,
          })),
          myRole: currentPlayer?.role,
          myId: currentPlayer?.id,
          winnerTeam: room.gameResult?.winnerTeam,
          gameId: room.gameResult?.gameId,
        });

        // Store initial state
        roomStates.set(roomId, {
          status: room.status,
          phase: room.phase,
          updatedAt: Date.now(),
        });

        // Get initial message count
        const messageCount = await prisma.message.count({ where: { roomId } });
        roomMessages.set(roomId, messageCount);
      } catch (error) {
        sendEvent("error", { message: "Failed to get room" });
        controller.close();
        return;
      }

      // Poll for updates
      const pollInterval = setInterval(async () => {
        try {
          const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: {
              players: true,
              gameResult: true,
            },
          });

          if (!room) {
            sendEvent("error", { message: "Room not found" });
            clearInterval(pollInterval);
            controller.close();
            return;
          }

          const prevState = roomStates.get(roomId);
          const hasChanged =
            !prevState ||
            prevState.status !== room.status ||
            prevState.phase !== room.phase;

          if (hasChanged) {
            const normalizedWallet = wallet?.toLowerCase();
            const currentPlayer = room.players.find((p) => p.wallet === normalizedWallet);

            sendEvent("room_update", {
              id: room.id,
              code: room.code,
              status: room.status,
              phase: room.phase,
              hostWallet: room.hostWallet,
              players: room.players.map((p) => ({
                id: p.id,
                wallet: p.wallet,
                nickname: p.nickname,
                isAlive: p.isAlive,
                isReady: p.isReady,
                isHost: p.isHost,
                role: room.status === "ended" ? p.role : undefined,
              })),
              myRole: currentPlayer?.role,
              myId: currentPlayer?.id,
              winnerTeam: room.gameResult?.winnerTeam,
              gameId: room.gameResult?.gameId,
            });

            roomStates.set(roomId, {
              status: room.status,
              phase: room.phase,
              updatedAt: Date.now(),
            });
          }

          // Check for new messages
          if (room.status === "day") {
            const messageCount = await prisma.message.count({ where: { roomId } });
            const prevCount = roomMessages.get(roomId) || 0;

            if (messageCount > prevCount) {
              const newMessages = await prisma.message.findMany({
                where: { roomId },
                include: { player: { select: { nickname: true } } },
                orderBy: { createdAt: "asc" },
                skip: prevCount,
              });

              for (const msg of newMessages) {
                sendEvent("chat", {
                  id: msg.id,
                  playerId: msg.playerId,
                  nickname: msg.player.nickname,
                  content: msg.content,
                  createdAt: msg.createdAt.toISOString(),
                });
              }

              roomMessages.set(roomId, messageCount);
            }
          }

          // Send heartbeat every 30 seconds
          if (Date.now() - (prevState?.updatedAt || 0) > 30000) {
            sendEvent("heartbeat", { timestamp: Date.now() });
          }
        } catch (error) {
          console.error("SSE poll error:", error);
        }
      }, 1000); // Poll every second

      // Handle client disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(pollInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
