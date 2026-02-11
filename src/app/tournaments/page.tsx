"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";

interface Tournament {
  id: string;
  name: string;
  status: string;
  maxPlayers: number;
  prizePool: number;
  startTime: string | null;
  _count: {
    participants: number;
    matches: number;
  };
}

export default function TournamentsPage() {
  const { address, isConnected } = useAccount();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const res = await fetch("/api/tournament");
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
    } finally {
      setLoading(false);
    }
  };

  const joinTournament = async (tournamentId: string) => {
    if (!address || !nickname) return;
    setJoining(tournamentId);

    try {
      const res = await fetch(`/api/tournament/${tournamentId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, nickname }),
      });

      if (res.ok) {
        fetchTournaments();
        alert("Joined tournament!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to join");
      }
    } catch (error) {
      console.error("Join error:", error);
    } finally {
      setJoining(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "registration":
        return "text-green-400";
      case "active":
        return "text-yellow-400";
      case "completed":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-purple-400 hover:text-purple-300">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold text-center">🏆 Tournaments</h1>
          <ConnectButton />
        </div>

        {isConnected && (
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
            <label className="block text-sm text-gray-400 mb-2">Your Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter nickname to join"
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              maxLength={20}
            />
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading tournaments...</div>
        ) : tournaments.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No tournaments available</div>
        ) : (
          <div className="space-y-4">
            {tournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="bg-gray-800/50 rounded-lg p-6 border border-gray-700"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{tournament.name}</h2>
                    <span className={`text-sm ${getStatusColor(tournament.status)}`}>
                      {tournament.status.toUpperCase()}
                    </span>
                  </div>
                  {tournament.prizePool > 0 && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-yellow-400">
                        {tournament.prizePool}
                      </div>
                      <div className="text-xs text-gray-400">Prize Pool</div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">
                      {tournament._count.participants}/{tournament.maxPlayers}
                    </div>
                    <div className="text-xs text-gray-400">Players</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{tournament._count.matches}</div>
                    <div className="text-xs text-gray-400">Matches</div>
                  </div>
                  <div>
                    <div className="text-sm">
                      {tournament.startTime
                        ? new Date(tournament.startTime).toLocaleDateString()
                        : "TBD"}
                    </div>
                    <div className="text-xs text-gray-400">Start</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {tournament.status === "registration" && isConnected && nickname && (
                    <button
                      onClick={() => joinTournament(tournament.id)}
                      disabled={joining === tournament.id}
                      className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium disabled:opacity-50"
                    >
                      {joining === tournament.id ? "Joining..." : "Join Tournament"}
                    </button>
                  )}
                  <Link
                    href={`/tournaments/${tournament.id}`}
                    className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-center"
                  >
                    View Bracket
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
