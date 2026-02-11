"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { useParams, useRouter } from "next/navigation";
import { RoomState, ChatMessage, Player, Role } from "@/lib/game/types";
import { CONTRACT_ADDRESS, REPUTATION_ABI } from "@/lib/contracts";

// Components for each phase
function LobbyPhase({
  room,
  onReady,
  onStart,
}: {
  room: RoomState;
  onReady: () => void;
  onStart: () => void;
}) {
  const isHost = room.players.find((p) => p.id === room.myId)?.isHost;
  const currentPlayer = room.players.find((p) => p.id === room.myId);
  const allReady = room.players.every((p) => p.isReady);
  const canStart = room.players.length >= 6 && allReady;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-gray-400 mb-2">Room Code</p>
        <p className="text-4xl font-mono font-bold tracking-wider text-sv-accent">
          {room.code}
        </p>
      </div>

      <div className="bg-sv-dark rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Players ({room.players.length}/10)</h3>
          {room.players.length < 6 && (
            <span className="text-sm text-sv-gold">Need {6 - room.players.length} more</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {room.players.map((player) => (
            <div
              key={player.id}
              className={`flex items-center gap-2 p-2 rounded-lg ${
                player.id === room.myId ? "bg-sv-accent/20 border border-sv-accent" : "bg-gray-800"
              }`}
            >
              <span className={player.isReady ? "text-sv-green" : "text-gray-500"}>
                {player.isReady ? "✓" : "○"}
              </span>
              <span className="flex-1 truncate">{player.nickname}</span>
              {player.isHost && <span className="text-xs text-sv-gold">HOST</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {!currentPlayer?.isReady ? (
          <button
            onClick={onReady}
            className="w-full py-4 bg-sv-green hover:bg-green-600 rounded-lg font-semibold transition-colors"
          >
            Ready
          </button>
        ) : isHost ? (
          <button
            onClick={onStart}
            disabled={!canStart}
            className="w-full py-4 bg-sv-accent hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            {canStart ? "Start Game" : `Waiting for players...`}
          </button>
        ) : (
          <div className="text-center text-gray-400 py-4">
            Waiting for host to start...
          </div>
        )}
      </div>
    </div>
  );
}

function NightPhase({
  room,
  onAction,
}: {
  room: RoomState;
  onAction: (targetId: string, actionType: string) => void;
}) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const alivePlayers = room.players.filter((p) => p.isAlive && p.id !== room.myId);

  const getRoleAction = (): { title: string; description: string; actionType: string; actionLabel: string; icon: string } => {
    switch (room.myRole) {
      case "impostor":
        return {
          title: "Choose your target",
          description: "Select a player to eliminate tonight",
          actionType: "kill",
          actionLabel: "Eliminate",
          icon: "🔪",
        };
      case "detective":
        return {
          title: "Investigate a player",
          description: "Choose someone to learn if they are an impostor",
          actionType: "investigate",
          actionLabel: "Investigate",
          icon: "🔍",
        };
      case "doctor":
        return {
          title: "Protect a player",
          description: "Choose someone to save from elimination tonight",
          actionType: "protect",
          actionLabel: "Protect",
          icon: "💉",
        };
      case "jester":
        return {
          title: "Night falls...",
          description: "Wait and plan your strategy to get voted out",
          actionType: "",
          actionLabel: "",
          icon: "🃏",
        };
      case "mayor":
        return {
          title: "Night falls...",
          description: "Your vote will count as 2 during the day",
          actionType: "",
          actionLabel: "",
          icon: "👑",
        };
      default:
        return {
          title: "Night falls...",
          description: "Wait while others act in the darkness",
          actionType: "",
          actionLabel: "",
          icon: "😴",
        };
    }
  };

  const action = getRoleAction();
  const canAct = room.myRole === "impostor" || room.myRole === "detective" || room.myRole === "doctor";

  const getRoleEmoji = (role: string) => {
    switch (role) {
      case "impostor": return "🔪";
      case "detective": return "🔍";
      case "doctor": return "💉";
      case "jester": return "🃏";
      case "mayor": return "👑";
      default: return "👤";
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">🌙</div>
        <h2 className="text-2xl font-bold mb-2">{action.title}</h2>
        <p className="text-gray-400">{action.description}</p>
        {room.myRole && (
          <p className={`mt-2 text-lg font-semibold role-${room.myRole}`}>
            {getRoleEmoji(room.myRole)} You are the {room.myRole.charAt(0).toUpperCase() + room.myRole.slice(1)}
          </p>
        )}
      </div>

      {canAct && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {alivePlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => setSelectedTarget(player.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedTarget === player.id
                    ? room.myRole === "doctor" 
                      ? "border-blue-500 bg-blue-500/20"
                      : "border-sv-accent bg-sv-accent/20"
                    : "border-gray-700 bg-sv-dark hover:border-gray-500"
                }`}
              >
                <span className="block font-semibold">{player.nickname}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => selectedTarget && onAction(selectedTarget, action.actionType)}
            disabled={!selectedTarget}
            className={`w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors ${
              room.myRole === "doctor" 
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-sv-red hover:bg-red-600"
            }`}
          >
            {action.icon} {action.actionLabel}
          </button>
        </>
      )}

      {!canAct && (
        <div className="flex flex-col items-center justify-center h-48 gap-4">
          <div className="text-4xl">{action.icon}</div>
          <div className="animate-pulse-slow text-gray-500 text-center">
            The night is dark and full of terrors...
          </div>
        </div>
      )}
    </div>
  );
}

function DayPhase({
  room,
  messages,
  onSendMessage,
  onVote,
  onTransition,
}: {
  room: RoomState;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onVote: (targetId: string | null) => void;
  onTransition: () => void;
}) {
  const [message, setMessage] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [showVoting, setShowVoting] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const isHost = room.players.find((p) => p.id === room.myId)?.isHost;
  const isAlive = room.players.find((p) => p.id === room.myId)?.isAlive;
  const alivePlayers = room.players.filter((p) => p.isAlive && p.id !== room.myId);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="text-center mb-4">
        <div className="text-4xl mb-2">☀️</div>
        <h2 className="text-xl font-bold">Day {room.phase}</h2>
        {room.lastKilled && (
          <p className="text-sv-red mt-2">
            {room.players.find((p) => p.id === room.lastKilled)?.nickname} was eliminated last night
          </p>
        )}
      </div>

      {!showVoting ? (
        <>
          {/* Chat */}
          <div
            ref={chatRef}
            className="flex-1 bg-sv-dark rounded-lg p-4 overflow-y-auto space-y-2 mb-4"
          >
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center">No messages yet...</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="animate-fadeIn">
                  <span className="font-semibold text-sv-accent">{msg.nickname}: </span>
                  <span className="text-gray-300">{msg.content}</span>
                </div>
              ))
            )}
          </div>

          {/* Message Input */}
          {isAlive && (
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message..."
                maxLength={200}
                className="flex-1 px-4 py-3 bg-sv-dark border border-gray-700 rounded-lg focus:outline-none focus:border-sv-accent"
              />
              <button
                onClick={handleSend}
                className="px-6 py-3 bg-sv-accent hover:bg-purple-600 rounded-lg font-semibold transition-colors"
              >
                Send
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowVoting(true)}
              className="flex-1 py-3 bg-sv-gold hover:bg-yellow-500 text-black rounded-lg font-semibold transition-colors"
            >
              Start Voting
            </button>
            {isHost && (
              <button
                onClick={onTransition}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
              >
                End Discussion
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Voting */}
          <div className="flex-1 space-y-4">
            <h3 className="font-semibold text-center">Vote to eliminate</h3>
            <div className="grid grid-cols-2 gap-3">
              {alivePlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedTarget(player.id)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedTarget === player.id
                      ? "border-sv-red bg-sv-red/20"
                      : "border-gray-700 bg-sv-dark hover:border-gray-500"
                  }`}
                >
                  {player.nickname}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => onVote(null)}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
            >
              Skip Vote
            </button>
            <button
              onClick={() => onVote(selectedTarget)}
              disabled={!selectedTarget}
              className="flex-1 py-3 bg-sv-red hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Vote
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EndPhase({ room }: { room: RoomState }) {
  const { address } = useAccount();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimData, setClaimData] = useState<{
    gameId: string;
    outcome: number;
    repDelta: number;
    expiry: string;
    signature: string;
  } | null>(null);

  const { writeContract, isPending } = useWriteContract();

  const { data: hasClaimed } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: REPUTATION_ABI,
    functionName: "hasClaimed",
    args: room.gameId && address ? [room.gameId as `0x${string}`, address] : undefined,
  });

  const isWinner = room.winnerTeam === "jester"
    ? room.myRole === "jester"
    : room.winnerTeam === "citizens"
      ? room.myRole !== "impostor" && room.myRole !== "jester"
      : room.myRole === "impostor";

  const fetchClaimData = async () => {
    if (!address || !room.gameId) return;
    setClaiming(true);

    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, gameId: room.gameId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setClaimData(data);
    } catch (err) {
      console.error("Claim error:", err);
    } finally {
      setClaiming(false);
    }
  };

  const claimOnchain = () => {
    if (!claimData) return;

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: REPUTATION_ABI,
      functionName: "claimResult",
      args: [
        claimData.gameId as `0x${string}`,
        claimData.outcome,
        claimData.repDelta,
        BigInt(claimData.expiry),
        claimData.signature as `0x${string}`,
      ],
    });
  };

  useEffect(() => {
    if (hasClaimed) {
      setClaimed(true);
    }
  }, [hasClaimed]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">{isWinner ? "🏆" : "💀"}</div>
        <h2 className="text-3xl font-bold mb-2">
          {room.winnerTeam === "jester" 
            ? "🃏 Jester Wins!" 
            : room.winnerTeam === "citizens" 
              ? "Citizens Win!" 
              : "Impostors Win!"}
        </h2>
        <p className="text-gray-400">
          {isWinner ? "Congratulations!" : "Better luck next time!"}
        </p>
      </div>

      {/* Reveal all roles */}
      <div className="bg-sv-dark rounded-lg p-4">
        <h3 className="font-semibold mb-3">Final Roles</h3>
        <div className="grid grid-cols-2 gap-2">
          {room.players.map((player) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-2 rounded-lg bg-gray-800 ${
                !player.isAlive ? "player-dead" : ""
              }`}
            >
              <span>{player.nickname}</span>
              <span className={`text-sm role-${player.role}`}>
                {player.role?.charAt(0).toUpperCase()}
                {player.role?.slice(1)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Claim Reputation */}
      {room.gameId && (
        <div className="bg-sv-card rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold mb-3">Claim Reputation</h3>
          
          {claimed || hasClaimed ? (
            <div className="text-center text-sv-green py-4">
              ✓ Reputation claimed!
            </div>
          ) : !claimData ? (
            <button
              onClick={fetchClaimData}
              disabled={claiming}
              className="w-full py-3 bg-sv-accent hover:bg-purple-600 disabled:opacity-50 rounded-lg font-semibold transition-colors"
            >
              {claiming ? "Preparing..." : "Get Claim"}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Reputation Change</span>
                <span className={claimData.repDelta >= 0 ? "text-sv-green" : "text-sv-red"}>
                  {claimData.repDelta >= 0 ? "+" : ""}{claimData.repDelta}
                </span>
              </div>
              <button
                onClick={claimOnchain}
                disabled={isPending}
                className="w-full py-3 bg-sv-gold hover:bg-yellow-500 text-black disabled:opacity-50 rounded-lg font-semibold transition-colors"
              >
                {isPending ? "Claiming..." : "Claim Onchain"}
              </button>
            </div>
          )}
        </div>
      )}

      <a
        href="/"
        className="block w-full py-3 text-center bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
      >
        Back to Home
      </a>
    </div>
  );
}

// Main Room Component
export default function RoomPage() {
  const { roomId } = useParams();
  const { address } = useAccount();
  const router = useRouter();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");

  // SSE connection
  useEffect(() => {
    if (!roomId || !address) return;

    const eventSource = new EventSource(
      `/api/room/${roomId}/stream?wallet=${address}`
    );

    eventSource.addEventListener("room_update", (e) => {
      const data = JSON.parse(e.data);
      setRoom(data);
    });

    eventSource.addEventListener("chat", (e) => {
      const msg = JSON.parse(e.data);
      setMessages((prev) => [...prev, msg]);
    });

    eventSource.addEventListener("error", (e) => {
      console.error("SSE error:", e);
    });

    return () => eventSource.close();
  }, [roomId, address]);

  // Load chat history
  useEffect(() => {
    if (!roomId || !room || room.status !== "day") return;

    const loadChat = async () => {
      const res = await fetch(`/api/room/${roomId}/chat?phase=${room.phase}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    };

    loadChat();
  }, [roomId, room?.phase, room?.status]);

  const handleReady = async () => {
    await fetch(`/api/room/${roomId}/ready`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address, ready: true }),
    });
  };

  const handleStart = async () => {
    await fetch(`/api/room/${roomId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address }),
    });
  };

  const handleAction = async (targetId: string, actionType: string) => {
    await fetch(`/api/room/${roomId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address, actionType, targetId }),
    });
  };

  const handleSendMessage = async (content: string) => {
    await fetch(`/api/room/${roomId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address, content }),
    });
  };

  const handleVote = async (targetId: string | null) => {
    await fetch(`/api/room/${roomId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address, targetId }),
    });
  };

  const handleTransition = async () => {
    await fetch(`/api/room/${roomId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address }),
    });
  };

  if (!address) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Please connect your wallet</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading room...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">
          <span className="text-sv-accent">Shadow</span>Vote
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {room.players.filter((p) => p.isAlive).length} alive
          </span>
          {room.myRole && room.status !== "lobby" && room.status !== "ended" && (
            <span className={`text-sm font-semibold role-${room.myRole}`}>
              {room.myRole.charAt(0).toUpperCase() + room.myRole.slice(1)}
            </span>
          )}
        </div>
      </div>

      {/* Phase Content */}
      <div className="bg-sv-card rounded-xl p-6 shadow-xl border border-gray-800 animate-slideUp">
        {room.status === "lobby" && (
          <LobbyPhase room={room} onReady={handleReady} onStart={handleStart} />
        )}
        {room.status === "night" && (
          <NightPhase room={room} onAction={handleAction} />
        )}
        {(room.status === "day" || room.status === "voting") && (
          <DayPhase
            room={room}
            messages={messages}
            onSendMessage={handleSendMessage}
            onVote={handleVote}
            onTransition={handleTransition}
          />
        )}
        {room.status === "ended" && <EndPhase room={room} />}
      </div>

      {error && (
        <p className="text-sv-red text-sm text-center mt-4">{error}</p>
      )}
    </main>
  );
}
