"use client";

import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, REPUTATION_ABI } from "@/lib/contracts";
import { ConnectButton } from "@/components/ConnectButton";
import Link from "next/link";

export default function StatsPage() {
  const { address, isConnected } = useAccount();

  const { data: stats } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: REPUTATION_ABI,
    functionName: "getStats",
    args: address ? [address] : undefined,
  });

  const reputation = stats ? Number(stats[0]) : 0;
  const gamesPlayed = stats ? Number(stats[1]) : 0;
  const wins = stats ? Number(stats[2]) : 0;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-bold">
          <span className="text-sv-accent">Shadow</span>Vote
        </Link>
        <ConnectButton />
      </div>

      <h1 className="text-2xl font-bold mb-6">Your Stats</h1>

      {!isConnected ? (
        <div className="bg-sv-card rounded-xl p-8 text-center border border-gray-800">
          <p className="text-gray-400 mb-6">Connect wallet to view stats</p>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Reputation Card */}
          <div className="bg-gradient-to-br from-sv-accent/20 to-purple-900/20 rounded-xl p-6 border border-sv-accent/50">
            <p className="text-sm text-gray-400 mb-1">Reputation</p>
            <p className={`text-5xl font-bold ${reputation >= 0 ? "text-sv-green" : "text-sv-red"}`}>
              {reputation >= 0 ? "+" : ""}{reputation}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-sv-card rounded-lg p-4 text-center border border-gray-800">
              <p className="text-2xl font-bold">{gamesPlayed}</p>
              <p className="text-xs text-gray-400">Games</p>
            </div>
            <div className="bg-sv-card rounded-lg p-4 text-center border border-gray-800">
              <p className="text-2xl font-bold text-sv-green">{wins}</p>
              <p className="text-xs text-gray-400">Wins</p>
            </div>
            <div className="bg-sv-card rounded-lg p-4 text-center border border-gray-800">
              <p className="text-2xl font-bold text-sv-gold">{winRate}%</p>
              <p className="text-xs text-gray-400">Win Rate</p>
            </div>
          </div>

          {/* Rank */}
          <div className="bg-sv-card rounded-xl p-6 border border-gray-800">
            <h2 className="font-semibold mb-4">Rank</h2>
            <div className="flex items-center gap-4">
              <div className="text-4xl">
                {reputation >= 100 ? "🏆" : reputation >= 50 ? "⭐" : reputation >= 0 ? "🎮" : "💀"}
              </div>
              <div>
                <p className="font-semibold text-lg">
                  {reputation >= 100
                    ? "Master Detective"
                    : reputation >= 50
                    ? "Skilled Player"
                    : reputation >= 0
                    ? "Novice"
                    : "Suspicious"}
                </p>
                <p className="text-sm text-gray-400">
                  {reputation >= 100
                    ? "Top tier player"
                    : reputation >= 50
                    ? "Experienced voter"
                    : reputation >= 0
                    ? "Just starting out"
                    : "Many losses..."}
                </p>
              </div>
            </div>
          </div>

          {/* How Reputation Works */}
          <div className="bg-sv-card rounded-xl p-6 border border-gray-800">
            <h2 className="font-semibold mb-4">How Reputation Works</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Win as citizen/detective</span>
                <span className="text-sv-green">+10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Win as impostor</span>
                <span className="text-sv-green">+10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Survive as impostor</span>
                <span className="text-sv-green">+5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Lose</span>
                <span className="text-sv-red">-5</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="text-sv-accent hover:underline"
        >
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}
