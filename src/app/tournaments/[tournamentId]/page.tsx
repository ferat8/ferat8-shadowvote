"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Match {
  id: string;
  round: number;
  matchNumber: number;
  player1Wallet: string | null;
  player2Wallet: string | null;
  winnerWallet: string | null;
  status: string;
}

interface Participant {
  wallet: string;
  nickname: string;
  seed: number;
  eliminated: boolean;
  wins: number;
  losses: number;
}

interface Tournament {
  id: string;
  name: string;
  status: string;
  maxPlayers: number;
  prizePool: number;
  participants: Participant[];
  matches: Match[];
}

export default function TournamentBracketPage() {
  const params = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournament();
  }, [params.tournamentId]);

  const fetchTournament = async () => {
    try {
      const res = await fetch(`/api/tournament/${params.tournamentId}`);
      const data = await res.json();
      setTournament(data.tournament);
    } catch (error) {
      console.error("Failed to fetch tournament:", error);
    } finally {
      setLoading(false);
    }
  };

  const getNickname = (wallet: string | null) => {
    if (!wallet || !tournament) return "TBD";
    const player = tournament.participants.find(
      (p) => p.wallet.toLowerCase() === wallet.toLowerCase()
    );
    return player?.nickname || wallet.slice(0, 8);
  };

  const getRoundName = (round: number, maxRound: number) => {
    if (round === 1) return "Finals";
    if (round === 2) return "Semi-Finals";
    if (round === 3) return "Quarter-Finals";
    return `Round ${maxRound - round + 1}`;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
        <div className="text-center py-20">Loading tournament...</div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
        <div className="text-center py-20">Tournament not found</div>
      </main>
    );
  }

  // Group matches by round
  const matchesByRound: Record<number, Match[]> = {};
  tournament.matches.forEach((match) => {
    if (!matchesByRound[match.round]) matchesByRound[match.round] = [];
    matchesByRound[match.round].push(match);
  });

  const rounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => b - a);
  const maxRound = Math.max(...rounds, 1);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/tournaments" className="text-purple-400 hover:text-purple-300">
            ← Back to Tournaments
          </Link>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <span
            className={`px-3 py-1 rounded-full text-sm ${
              tournament.status === "active"
                ? "bg-yellow-500/20 text-yellow-400"
                : tournament.status === "completed"
                ? "bg-green-500/20 text-green-400"
                : "bg-gray-500/20 text-gray-400"
            }`}
          >
            {tournament.status.toUpperCase()}
          </span>
        </div>

        {/* Bracket View */}
        {tournament.matches.length > 0 ? (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-8 min-w-max">
              {rounds.map((round) => (
                <div key={round} className="flex flex-col gap-4">
                  <h3 className="text-center text-gray-400 font-medium mb-2">
                    {getRoundName(round, maxRound)}
                  </h3>
                  <div
                    className="flex flex-col gap-4"
                    style={{ marginTop: round === maxRound ? 0 : `${Math.pow(2, maxRound - round) * 30}px` }}
                  >
                    {matchesByRound[round]
                      ?.sort((a, b) => a.matchNumber - b.matchNumber)
                      .map((match) => (
                        <div
                          key={match.id}
                          className="bg-gray-800/50 rounded-lg p-3 w-48 border border-gray-700"
                          style={{
                            marginBottom: round === maxRound ? 0 : `${Math.pow(2, maxRound - round) * 60}px`,
                          }}
                        >
                          <div
                            className={`py-2 px-3 rounded mb-1 ${
                              match.winnerWallet === match.player1Wallet
                                ? "bg-green-900/30 border border-green-500/50"
                                : "bg-gray-700/50"
                            }`}
                          >
                            <span className="text-sm">
                              {getNickname(match.player1Wallet)}
                            </span>
                          </div>
                          <div className="text-center text-xs text-gray-500 my-1">VS</div>
                          <div
                            className={`py-2 px-3 rounded ${
                              match.winnerWallet === match.player2Wallet
                                ? "bg-green-900/30 border border-green-500/50"
                                : "bg-gray-700/50"
                            }`}
                          >
                            <span className="text-sm">
                              {getNickname(match.player2Wallet)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            Tournament hasn't started yet. Waiting for more players...
          </div>
        )}

        {/* Participants List */}
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Participants ({tournament.participants.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tournament.participants.map((participant) => (
              <div
                key={participant.wallet}
                className={`p-3 rounded-lg ${
                  participant.eliminated
                    ? "bg-red-900/20 border border-red-500/30"
                    : "bg-gray-800/50 border border-gray-700"
                }`}
              >
                <div className="font-medium">{participant.nickname}</div>
                <div className="text-xs text-gray-400">
                  {participant.wins}W - {participant.losses}L
                </div>
                {participant.eliminated && (
                  <div className="text-xs text-red-400 mt-1">Eliminated</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
