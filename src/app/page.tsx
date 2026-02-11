"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createRoom = async () => {
    if (!address || !nickname.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, nickname: nickname.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem("playerId", data.playerId);
      localStorage.setItem("nickname", nickname.trim());
      router.push(`/room/${data.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!address || !nickname.trim() || !roomCode.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: roomCode.trim().toUpperCase(),
          wallet: address,
          nickname: nickname.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem("playerId", data.playerId);
      localStorage.setItem("nickname", nickname.trim());
      router.push(`/room/${data.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-12 animate-fadeIn">
          <h1 className="text-5xl font-bold mb-2">
            <span className="text-sv-accent">Shadow</span>Vote
          </h1>
          <p className="text-gray-400">Social deduction with onchain reputation</p>
        </div>

        {/* Connect or Play */}
        <div className="bg-sv-card rounded-xl p-6 shadow-xl border border-gray-800 animate-slideUp">
          {!isConnected ? (
            <div className="text-center">
              <p className="text-gray-400 mb-6">Connect your wallet to play</p>
              <ConnectButton />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Nickname */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Your Name</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Enter nickname"
                  maxLength={16}
                  className="w-full px-4 py-3 bg-sv-dark border border-gray-700 rounded-lg focus:outline-none focus:border-sv-accent"
                />
              </div>

              {/* Create Room */}
              <button
                onClick={createRoom}
                disabled={loading || !nickname.trim()}
                className="w-full py-4 bg-sv-accent hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {loading ? "Creating..." : "Create Room"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-gray-500 text-sm">or join</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>

              {/* Join Room */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Room Code"
                  maxLength={6}
                  className="flex-1 px-4 py-3 bg-sv-dark border border-gray-700 rounded-lg focus:outline-none focus:border-sv-accent uppercase tracking-wider"
                />
                <button
                  onClick={joinRoom}
                  disabled={loading || !nickname.trim() || !roomCode.trim()}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
                >
                  Join
                </button>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sv-red text-sm text-center">{error}</p>
              )}

              {/* Connected Address */}
              <div className="pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Connected</span>
                  <ConnectButton />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="mt-6 flex justify-center gap-6">
          <Link href="/stats" className="text-sv-accent hover:underline">
            Leaderboard
          </Link>
          <Link href="/tournaments" className="text-yellow-400 hover:underline">
            🏆 Tournaments
          </Link>
          <Link href="/achievements" className="text-green-400 hover:underline">
            🎖️ Achievements
          </Link>
        </div>

        {/* How to Play */}
        <div className="mt-12 bg-sv-card rounded-xl p-6 border border-gray-800 animate-slideUp">
          <h2 className="text-lg font-semibold mb-4">How to Play</h2>
          <div className="space-y-3 text-sm text-gray-400">
            <div className="flex gap-3">
              <span className="text-sv-red">🔪</span>
              <p><strong className="text-white">Impostors</strong> eliminate players at night</p>
            </div>
            <div className="flex gap-3">
              <span className="text-sv-detective">🔍</span>
              <p><strong className="text-white">Detective</strong> investigates one player per night</p>
            </div>
            <div className="flex gap-3">
              <span className="text-blue-400">💉</span>
              <p><strong className="text-white">Doctor</strong> protects one player from death each night</p>
            </div>
            <div className="flex gap-3">
              <span className="text-yellow-400">🃏</span>
              <p><strong className="text-white">Jester</strong> wins alone if voted out during the day</p>
            </div>
            <div className="flex gap-3">
              <span className="text-purple-400">👑</span>
              <p><strong className="text-white">Mayor</strong> their vote counts as 2</p>
            </div>
            <div className="flex gap-3">
              <span className="text-sv-citizen">🗳️</span>
              <p><strong className="text-white">Citizens</strong> vote during the day to find impostors</p>
            </div>
            <div className="flex gap-3">
              <span className="text-sv-gold">⭐</span>
              <p><strong className="text-white">Win</strong> to earn onchain reputation & achievements</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
