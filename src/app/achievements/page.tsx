"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract } from "wagmi";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { ACHIEVEMENTS } from "@/lib/game/types";

interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  killsAsImpostor: number;
  savesAsDoctor: number;
  correctDetects: number;
  jesterWins: number;
  mayorWins: number;
  maxSurviveStreak: number;
}

const ACHIEVEMENT_LIST = [
  { ...ACHIEVEMENTS.FIRST_BLOOD, icon: "🗡️", check: (s: PlayerStats) => s.killsAsImpostor >= 1 },
  { ...ACHIEVEMENTS.SHERLOCK, icon: "🔍", check: (s: PlayerStats) => s.correctDetects >= 3 },
  { ...ACHIEVEMENTS.SURVIVOR, icon: "⭐", check: (s: PlayerStats) => s.maxSurviveStreak >= 5 },
  { ...ACHIEVEMENTS.SAVIOR, icon: "💉", check: (s: PlayerStats) => s.savesAsDoctor >= 3 },
  { ...ACHIEVEMENTS.TRICKSTER, icon: "🃏", check: (s: PlayerStats) => s.jesterWins >= 1 },
  { ...ACHIEVEMENTS.LEADER, icon: "👑", check: (s: PlayerStats) => s.mayorWins >= 3 },
  { ...ACHIEVEMENTS.PERFECT_GAME, icon: "🏆", check: (s: PlayerStats) => s.gamesWon >= 10 },
  { ...ACHIEVEMENTS.TOURNAMENT_WINNER, icon: "🎖️", check: () => false },
];

export default function AchievementsPage() {
  const { address, isConnected } = useAccount();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [claimedOnchain, setClaimedOnchain] = useState<Set<number>>(new Set());
  const { writeContract, isPending } = useWriteContract();

  useEffect(() => {
    if (address) {
      fetchStats();
    }
  }, [address]);

  const fetchStats = async () => {
    // In production, fetch from API
    // For now, use mock data
    setStats({
      gamesPlayed: 15,
      gamesWon: 8,
      killsAsImpostor: 5,
      savesAsDoctor: 2,
      correctDetects: 4,
      jesterWins: 1,
      mayorWins: 2,
      maxSurviveStreak: 3,
    });
  };

  const claimAchievement = async (achievementId: number) => {
    if (!address) return;
    setClaiming(achievementId);

    try {
      const res = await fetch("/api/achievements/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, achievementId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to claim");
        return;
      }

      const { signature, expiry, contractAddress } = await res.json();

      // Call contract
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: [
          {
            name: "claimAchievement",
            type: "function",
            inputs: [
              { name: "achievementId", type: "uint256" },
              { name: "expiry", type: "uint256" },
              { name: "signature", type: "bytes" },
            ],
            outputs: [],
          },
        ],
        functionName: "claimAchievement",
        args: [BigInt(achievementId), BigInt(expiry), signature as `0x${string}`],
      });

      setClaimedOnchain((prev) => new Set([...prev, achievementId]));
    } catch (error) {
      console.error("Claim error:", error);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-purple-400 hover:text-purple-300">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold text-center">🎖️ Achievements</h1>
          <ConnectButton />
        </div>

        {!isConnected ? (
          <div className="text-center text-gray-400 py-8">
            Connect your wallet to view achievements
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            {stats && (
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{stats.gamesPlayed}</div>
                  <div className="text-xs text-gray-400">Games Played</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.gamesWon}</div>
                  <div className="text-xs text-gray-400">Wins</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">{stats.killsAsImpostor}</div>
                  <div className="text-xs text-gray-400">Kills</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{stats.savesAsDoctor}</div>
                  <div className="text-xs text-gray-400">Saves</div>
                </div>
              </div>
            )}

            {/* Achievement Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ACHIEVEMENT_LIST.map((achievement) => {
                const isEligible = stats ? achievement.check(stats) : false;
                const isClaimed = claimedOnchain.has(achievement.id);

                return (
                  <div
                    key={achievement.id}
                    className={`p-4 rounded-lg border ${
                      isClaimed
                        ? "bg-green-900/20 border-green-500/50"
                        : isEligible
                        ? "bg-purple-900/20 border-purple-500/50"
                        : "bg-gray-800/50 border-gray-700"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`text-4xl ${
                          isEligible || isClaimed ? "" : "grayscale opacity-50"
                        }`}
                      >
                        {achievement.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{achievement.name}</h3>
                        <p className="text-sm text-gray-400">{achievement.description}</p>
                        {isClaimed ? (
                          <div className="mt-2 text-green-400 text-sm">✓ Claimed as NFT</div>
                        ) : isEligible ? (
                          <button
                            onClick={() => claimAchievement(achievement.id)}
                            disabled={claiming === achievement.id || isPending}
                            className="mt-2 px-4 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm disabled:opacity-50"
                          >
                            {claiming === achievement.id ? "Claiming..." : "Claim NFT"}
                          </button>
                        ) : (
                          <div className="mt-2 text-gray-500 text-sm">🔒 Locked</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
